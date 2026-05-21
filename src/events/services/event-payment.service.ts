import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { MercadopagoService } from '../../payments/services/mercado_pago.service';
import { TicketsService } from './tickets.service';
import { TicketTypeRepository } from '../repository/ticket-type.repository';
import { TicketPurchaseRepository } from '../repository/ticket-purchase.repository';
import { TicketPurchaseStatus } from '../enums/ticket-purchase-status.enum';
import { PaymentIntentService } from '../../payments/services/payment-intent.service';
import { LoggerService } from '../../core/logger';
import { DataSource } from 'typeorm';
import { CreatePreferenceOptions } from '../../payments/interfaces/mercado-pago.interfaces';
import { MarketplaceFeeResolverService } from '../../payments/services/marketplace-fee-resolver.service';

@Injectable()
export class EventPaymentService {
  private readonly logger = new Logger(EventPaymentService.name);

  constructor(
    private readonly mercadopagoService: MercadopagoService,
    private readonly ticketsService: TicketsService,
    private readonly ticketTypeRepo: TicketTypeRepository,
    private readonly purchaseRepo: TicketPurchaseRepository,
    private readonly paymentIntentService: PaymentIntentService,
    private readonly internalLogger: LoggerService,
    private readonly dataSource: DataSource,
    private readonly feeResolver: MarketplaceFeeResolverService,
  ) {
    this.internalLogger.setContext('EventPaymentService');
  }

  /**
   * Crea una preferencia de pago para la compra de tickets
   */
  async createTicketPreference(
    ticketTypeId: string,
    quantity: number,
    customerName: string,
    customerEmail: string,
  ): Promise<any> {
    const ticketType = await this.ticketTypeRepo.findOne({
      where: { id: ticketTypeId },
      relations: ['event'],
    });

    if (!ticketType) {
      throw new NotFoundException('Tipo de ticket no encontrado');
    }

    // Verificar stock inicial (sin lock por ahora, solo para fallar rápido)
    if (Number(ticketType.soldQuantity) + quantity > ticketType.totalQuantity) {
      throw new BadRequestException('No hay suficiente stock disponible');
    }

    if (quantity > ticketType.maxPerUser) {
      throw new BadRequestException(
        `Máximo ${ticketType.maxPerUser} tickets por compra`,
      );
    }

    // 1. Crear el TicketPurchase en estado PENDING usando el servicio de tickets
    const savedPurchase = await this.ticketsService.createPendingPurchase(
      ticketTypeId,
      quantity,
      customerName,
      customerEmail,
      ticketType.event.tenantId,
    );

    // 2. Calcular fee dinámico usando el FeeResolver (3 niveles de prioridad)
    const feeCalculation = await this.feeResolver.calculateFee(
      savedPurchase.totalAmount,
      ticketType.event.tenantId,
    );

    this.logger.log(
      `Fee resolved for tenant ${ticketType.event.tenantId}: ${feeCalculation.feePercentage}% ` +
        `(${feeCalculation.feeSource} - ${feeCalculation.feeDescription})`,
    );

    // 3. Crear la preferencia en MercadoPago
    const externalReference = `TICKET_${savedPurchase.id}`;

    const items = [
      {
        id: ticketType.id,
        title: `${ticketType.name} - ${ticketType.event.name}`,
        unit_price: Number(ticketType.price),
        quantity: quantity,
        currency_id: 'ARS', // TODO: Configurable
      },
    ];

    // Construir preferencia con metadata discriminador
    const preferenceOptions: CreatePreferenceOptions = {
      items,
      external_reference: externalReference,
      payer: {
        email: customerEmail,
        name: customerName,
      },
      notification_url:
        process.env.MP_TICKET_NOTIFICATION_URL ||
        process.env.MP_NOTIFICATION_URL,
      statement_descriptor: 'Menucom Tickets',
      // Metadata discriminador CRÍTICO para el webhook
      metadata: {
        type: 'TICKET_PURCHASE',
        eventId: ticketType.event.id,
        ticketTypeId: ticketType.id,
        buyerEmail: customerEmail,
        purchaseId: savedPurchase.id,
        tenantId: ticketType.event.tenantId,
      },
      // Comisión del marketplace (calculada dinámicamente)
      marketplace_fee: feeCalculation.feeAmount,
    };

    this.logger.log(
      `Creating ticket preference with fee: ${feeCalculation.feeAmount} ` +
        `(${feeCalculation.feePercentage}%) - Net for organizer: ${feeCalculation.netAmount}`,
    );
    const preference =
      await this.mercadopagoService.createPreference(preferenceOptions);

    // 4. Actualizar el TicketPurchase con los datos del fee calculado
    savedPurchase.appliedFeePercentage = feeCalculation.feePercentage;
    savedPurchase.feeAmount = feeCalculation.feeAmount;
    savedPurchase.netAmount = feeCalculation.netAmount;
    await this.purchaseRepo.save(savedPurchase);

    // 5. Registrar el PaymentIntent para rastrear el pago
    await this.paymentIntentService.createPaymentIntent({
      id: externalReference,
      transaction_id: preference.id,
      user_id: customerEmail, // Usamos email como ID de usuario temporal si no está logueado
      state: 'PENDING',
      amount: savedPurchase.totalAmount,
      init_point: preference.init_point,
    });

    return {
      preferenceId: preference.id,
      initPoint: preference.init_point,
      purchaseId: savedPurchase.id,
    };
  }

  /**
   * Procesa la confirmación de pago de un ticket (llamado desde el webhook)
   */
  async confirmTicketPayment(purchaseId: string): Promise<void> {
    try {
      await this.ticketsService.completePurchase(purchaseId);
      this.logger.log(
        `Pago de ticket confirmado para la compra: ${purchaseId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error confirmando pago de ticket ${purchaseId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }
}
