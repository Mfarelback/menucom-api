import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TicketRepository } from '../repository/ticket.repository';
import { TicketTypeRepository } from '../repository/ticket-type.repository';
import { TicketPurchaseRepository } from '../repository/ticket-purchase.repository';
import { LoggerService } from '../../core/logger';
import { Ticket } from '../entities/ticket.entity';
import { TicketStatus } from '../enums/ticket-status.enum';
import { TicketPurchaseStatus } from '../enums/ticket-purchase-status.enum';
import { QRCodeSecureService } from './qrcode-secure.service';
import { TicketValidationService } from './ticket-validation.service';

@Injectable()
export class TicketsService {
  constructor(
    private readonly ticketRepo: TicketRepository,
    private readonly ticketTypeRepo: TicketTypeRepository,
    private readonly purchaseRepo: TicketPurchaseRepository,
    private readonly logger: LoggerService,
    private readonly dataSource: DataSource,
    private readonly qrService: QRCodeSecureService,
    private readonly validationService: TicketValidationService,
  ) {
    this.logger.setContext('TicketsService');
  }

  async createPendingPurchase(
    ticketTypeId: string,
    quantity: number,
    customerName: string,
    customerEmail: string,
    tenantId: string,
    commerceId?: string | null,
  ): Promise<any> {
    return await this.dataSource.transaction(async (manager) => {
      const ticketType = await this.ticketTypeRepo.findOneWithLock(
        ticketTypeId,
        manager,
      );

      if (!ticketType) {
        throw new NotFoundException('Tipo de ticket no encontrado');
      }

      const totalSold = Number(ticketType.soldQuantity) + quantity;
      if (totalSold > ticketType.totalQuantity) {
        throw new BadRequestException(
          'Lo sentimos, no hay suficiente stock disponible',
        );
      }

      // 1. Crear el registro de la compra PENDING
      const purchaseData: any = {
        tenantId: tenantId || 'system',
        totalAmount: Number(ticketType.price) * quantity,
        quantity,
        paymentStatus: TicketPurchaseStatus.PENDING,
        event: ticketType.event,
        ticketType,
        appliedFeePercentage: 0,
        feeAmount: 0,
        customerName,
        customerEmail,
      };

      if (commerceId) {
        purchaseData.commerceId = commerceId;
      }

      const purchase = this.purchaseRepo.create(purchaseData, manager);

      const savedPurchase = await this.purchaseRepo.save(purchase, manager);

      // 2. "Reservar" stock incrementando soldQuantity
      ticketType.soldQuantity = totalSold;
      await this.ticketTypeRepo.save(ticketType, manager);

      return savedPurchase;
    });
  }

  async completePurchase(purchaseId: string): Promise<any> {
    return await this.dataSource.transaction(async (manager) => {
      const purchase = await this.purchaseRepo.findOne(
        {
          where: { id: purchaseId },
          relations: ['event', 'ticketType', 'tickets'],
        },
        manager,
      );

      if (!purchase) {
        throw new NotFoundException('Compra no encontrada');
      }

      if (purchase.paymentStatus === TicketPurchaseStatus.COMPLETED) {
        return purchase;
      }

      // 1. Actualizar estado de la compra
      purchase.paymentStatus = TicketPurchaseStatus.COMPLETED;
      const savedPurchase = await this.purchaseRepo.save(purchase, manager);

      // 2. Generar los tickets con QR seguro (HMAC)
      const tickets: Ticket[] = [];
      for (let i = 0; i < purchase.quantity; i++) {
        // Crear ticket primero para obtener el ID
        const tempTicket = this.ticketRepo.create(
          {
            ticketType: purchase.ticketType,
            purchase: savedPurchase,
            ownerName: purchase.customerName,
            ownerEmail: purchase.customerEmail,
            qrCode: '', // Placeholder, se actualizará después
            status: TicketStatus.ACTIVE,
          },
          manager,
        );

        const savedTicket = await this.ticketRepo.save(tempTicket, manager);

        // Generar QR seguro con el ID real del ticket
        const qrCode = this.qrService.generateSecureQR({
          ticketId: savedTicket.id,
          purchaseId: savedPurchase.id,
          ticketTypeId: purchase.ticketType.id,
          eventId: purchase.event.id,
        });

        // Actualizar el ticket con el QR seguro
        savedTicket.qrCode = qrCode;
        await this.ticketRepo.save(savedTicket, manager);

        tickets.push(savedTicket);
      }

      this.logger.log(
        `Compra finalizada: ${savedPurchase.id}. Generados ${tickets.length} tickets con QR seguro.`,
      );

      return {
        purchase: savedPurchase,
        tickets: tickets,
      };
    });
  }

  /**
   * Genera tickets para una compra inmediata (ej: tickets gratuitos o internos)
   */
  async generateTickets(
    ticketTypeId: string,
    quantity: number,
    customerName: string,
    customerEmail: string,
    buyerId?: string,
    tenantId?: string,
  ): Promise<any> {
    const purchase = await this.createPendingPurchase(
      ticketTypeId,
      quantity,
      customerName,
      customerEmail,
      tenantId,
    );
    return await this.completePurchase(purchase.id);
  }

  /**
   * Busca un ticket por su código QR seguro
   * Valida la firma HMAC antes de retornar
   */
  async findByCode(qrCode: string): Promise<Ticket> {
    // Validar el QR seguro primero
    const qrData = this.qrService.validateSecureQR(qrCode);
    if (!qrData) {
      throw new BadRequestException('Código QR inválido o alterado');
    }

    // Buscar el ticket por ID extraído del QR
    const ticket = await this.ticketRepo.findOne({
      where: { id: qrData.ticketId },
      relations: [
        'ticketType',
        'ticketType.event',
        'ticketType.event.venue',
        'purchase',
      ],
    });

    if (!ticket) throw new NotFoundException('Ticket no encontrado');

    // Verificar que el QR coincida con el almacenado
    if (ticket.qrCode !== qrCode) {
      throw new BadRequestException('Código QR no coincide con el ticket');
    }

    return ticket;
  }

  /**
   * Valida un ticket por su código QR (usado en escáner offline/online)
   *
   * @param qrCode Código QR seguro
   * @param validatorId ID del usuario que valida
   * @returns Ticket validado
   */
  async validateByQRCode(
    qrCode: string,
    validatorId?: string,
  ): Promise<Ticket> {
    const ticket = await this.findByCode(qrCode);
    return this.validateAndUseTicket(ticket, validatorId);
  }

  /**
   * Método interno para validar y marcar como usado un ticket
   */
  private async validateAndUseTicket(
    ticket: Ticket,
    validatorId?: string,
  ): Promise<Ticket> {
    if (ticket.status === TicketStatus.USED) {
      throw new BadRequestException('El ticket ya ha sido utilizado');
    }

    if (ticket.status !== TicketStatus.ACTIVE) {
      throw new BadRequestException(
        `El ticket no está activo (Estado: ${ticket.status})`,
      );
    }

    ticket.status = TicketStatus.USED;
    ticket.usedAt = new Date();
    ticket.validatedAt = new Date();

    // Registrar quién validó el ticket
    if (validatorId) {
      ticket.validatedBy = { id: validatorId } as any;
    }

    const savedTicket = await this.ticketRepo.save(ticket);

    this.logger.log(
      `Ticket ${ticket.id} validado${validatorId ? ` por usuario ${validatorId}` : ''}`,
    );

    return savedTicket;
  }

  async findOneWithPurchase(id: string): Promise<Ticket> {
    const ticket = await this.ticketRepo.findOne({
      where: { id },
      relations: [
        'ticketType',
        'ticketType.event',
        'ticketType.event.venue',
        'purchase',
        'purchase.buyer',
      ],
    });
    if (!ticket) throw new NotFoundException('Ticket no encontrado');
    return ticket;
  }

  async activateTicket(id: string): Promise<Ticket> {
    const ticket = await this.ticketRepo.findOne({
      where: { id },
      relations: ['ticketType', 'ticketType.event', 'ticketType.event.venue'],
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    ticket.status = TicketStatus.ACTIVE;
    return this.ticketRepo.save(ticket);
  }

  /**
   * Valida y marca como usado un ticket por su código (legacy - mantenido para compatibilidad)
   * @deprecated Usar validateByQRCode para nueva validación segura
   */
  async validateAndUse(code: string, validatorId?: string): Promise<Ticket> {
    // Si el código parece un QR seguro (base64url), usar validación segura
    if (code.length > 50 && (code.includes('-') || code.includes('_'))) {
      return this.validateByQRCode(code, validatorId);
    }

    // Código antiguo (hex de 32 chars) - buscar directo
    const ticket = await this.ticketRepo.findOne({
      where: { qrCode: code },
      relations: [
        'ticketType',
        'ticketType.event',
        'ticketType.event.venue',
        'purchase',
      ],
    });

    if (!ticket) throw new NotFoundException('Ticket no encontrado');

    return this.validateAndUseTicket(ticket, validatorId);
  }

  /**
   * Obtiene los datos completos de un ticket con su QR seguro
   * Incluye token JWT para validación offline
   */
  async getTicketWithOfflineData(ticketId: string): Promise<{
    ticket: Ticket;
    secureQR: string;
    offlineToken: string;
    combinedQR: string;
  }> {
    const ticket = await this.ticketRepo.findOne({
      where: { id: ticketId },
      relations: ['ticketType', 'ticketType.event', 'purchase'],
    });

    if (!ticket) throw new NotFoundException('Ticket no encontrado');

    // Generar QR híbrido con datos offline
    const hybrid = this.validationService.generateHybridQRCode(
      {
        ticketId: ticket.id,
        purchaseId: ticket.purchase.id,
        ticketTypeId: ticket.ticketType.id,
        eventId: ticket.ticketType.event.id,
      },
      {
        ticketId: ticket.id,
        purchaseId: ticket.purchase.id,
        ticketTypeId: ticket.ticketType.id,
        ticketTypeName: ticket.ticketType.name,
        eventId: ticket.ticketType.event.id,
        eventName: ticket.ticketType.event.name,
        eventDate: ticket.ticketType.event.startDate,
        ownerName: ticket.ownerName,
        ownerEmail: ticket.ownerEmail,
      },
    );

    return {
      ticket,
      secureQR: hybrid.secureQR,
      offlineToken: hybrid.offlineToken,
      combinedQR: hybrid.combinedQR,
    };
  }

  /**
   * Regenera el código QR de un ticket (útil si se perdió o comprometió)
   * Solo organizadores pueden hacer esto
   */
  async regenerateQRCode(ticketId: string): Promise<Ticket> {
    const ticket = await this.ticketRepo.findOne({
      where: { id: ticketId },
      relations: ['ticketType', 'ticketType.event', 'purchase'],
    });

    if (!ticket) throw new NotFoundException('Ticket no encontrado');

    // Generar nuevo QR seguro
    const newQRCode = this.qrService.generateSecureQR({
      ticketId: ticket.id,
      purchaseId: ticket.purchase.id,
      ticketTypeId: ticket.ticketType.id,
      eventId: ticket.ticketType.event.id,
    });

    ticket.qrCode = newQRCode;

    this.logger.log(`QR regenerado para ticket: ${ticketId}`);

    return this.ticketRepo.save(ticket);
  }
}
