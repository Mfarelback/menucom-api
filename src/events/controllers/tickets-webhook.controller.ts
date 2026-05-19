import {
  Controller,
  Post,
  Body,
  Headers,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiTags, ApiHeader } from '@nestjs/swagger';
import * as crypto from 'crypto';
import { TicketsService } from '../services/tickets.service';
import { TicketPurchaseRepository } from '../repository/ticket-purchase.repository';
import { TicketPurchaseStatus } from '../enums/ticket-purchase-status.enum';
import { TicketStatus } from '../enums/ticket-status.enum';
import { TicketRepository } from '../repository/ticket.repository';
import { TicketTypeRepository } from '../repository/ticket-type.repository';
import { DataSource } from 'typeorm';

@ApiTags('Webhooks - Tickets')
@Controller('webhooks')
export class TicketsWebhookController {
  private readonly logger = new Logger(TicketsWebhookController.name);

  constructor(
    private readonly ticketsService: TicketsService,
    private readonly purchaseRepo: TicketPurchaseRepository,
    private readonly ticketRepo: TicketRepository,
    private readonly ticketTypeRepo: TicketTypeRepository,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Webhook dedicado para notificaciones de MercadoPago relacionadas con tickets.
   * No requiere autenticación JWT - MercadoPago necesita acceso público.
   *
   * Procesa eventos de tipo 'order' para pagos de tickets.
   */
  @ApiOperation({
    summary: 'Webhook de MercadoPago para pagos de tickets (público)',
    description:
      'Recibe notificaciones de MercadoPago para pagos de tickets. Valida firma HMAC SHA256.',
  })
  @ApiHeader({
    name: 'x-signature',
    description: 'Firma HMAC SHA256 de MercadoPago',
    required: true,
  })
  @ApiHeader({
    name: 'x-request-id',
    description: 'ID de request de MercadoPago',
    required: true,
  })
  @Post('tickets')
  @HttpCode(HttpStatus.OK)
  async handleTicketWebhook(
    @Body() body: any,
    @Headers('x-signature') xSignature: string,
    @Headers('x-request-id') xRequestId: string,
    @Query('data.id') dataId: string,
    @Query('type') type: string,
    @Query('client') organizerId?: string,
  ): Promise<{ status: string; reason?: string }> {
    this.logger.log(
      `[Tickets Webhook] Received: type=${type}, data.id=${dataId}`,
    );

    // 1. Validar parámetros requeridos
    if (!dataId || !type) {
      this.logger.error(
        '[Tickets Webhook] Missing required query params: data.id or type',
      );
      throw new UnauthorizedException('Missing required parameters');
    }

    // 2. Validar firma HMAC (CRÍTICO)
    const isValid = this.validateSignature(xSignature, xRequestId, dataId);
    if (!isValid) {
      this.logger.error('[Tickets Webhook] Invalid signature detected');
      throw new UnauthorizedException('Invalid webhook signature');
    }

    this.logger.log('[Tickets Webhook] Signature validated successfully');

    // 3. Verificar que sea evento de order
    if (type !== 'order') {
      this.logger.log(`[Tickets Webhook] Ignoring non-order event: ${type}`);
      return { status: 'ignored', reason: 'Not an order event' };
    }

    // 4. Extraer external_reference del body
    const externalReference = body?.data?.external_reference;
    if (!externalReference) {
      this.logger.error(
        '[Tickets Webhook] Missing external_reference in payload',
      );
      return { status: 'error', reason: 'Missing external_reference' };
    }

    // 5. Verificar que sea un pago de tickets (discriminador)
    if (!externalReference.startsWith('TICKET_')) {
      this.logger.log(
        `[Tickets Webhook] Not a ticket purchase: ${externalReference}`,
      );
      return { status: 'delegated', reason: 'Not a ticket purchase' };
    }

    // 6. Extraer purchaseId del external_reference
    const purchaseId = externalReference.replace('TICKET_', '');
    this.logger.log(
      `[Tickets Webhook] Processing ticket purchase: ${purchaseId}`,
    );

    // 7. Procesar según la acción
    const action = body?.action || 'order.processed';
    await this.processOrderAction(action, purchaseId, body.data);

    this.logger.log(`[Tickets Webhook] Successfully processed: ${purchaseId}`);
    return { status: 'ok' };
  }

  /**
   * Valida la firma HMAC SHA256 de MercadoPago
   * Según documentación oficial de MP para webhooks
   */
  private validateSignature(
    xSignature: string,
    xRequestId: string,
    dataId: string,
  ): boolean {
    const secret = process.env.MP_WEBHOOK_SECRET;

    if (!secret) {
      this.logger.warn(
        'MP_WEBHOOK_SECRET no está configurado. Saltando validación de firma (NO RECOMENDADO en producción).',
      );
      return true;
    }

    if (!xSignature || !xRequestId) {
      this.logger.error('Missing x-signature or x-request-id headers');
      return false;
    }

    try {
      // Parsear el header x-signature: "ts=123456789,v1=abc123..."
      const parts = xSignature.split(',');
      let ts: string | undefined;
      let v1: string | undefined;

      parts.forEach((part) => {
        const [key, value] = part.split('=');
        if (key?.trim() === 'ts') ts = value?.trim();
        if (key?.trim() === 'v1') v1 = value?.trim();
      });

      if (!ts || !v1) {
        this.logger.error('Invalid signature format: missing ts or v1');
        return false;
      }

      // dataId debe estar en minúsculas según docs de MP
      const manifest = `id:${dataId.toLowerCase()};request-id:${xRequestId};ts:${ts};`;

      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(manifest);
      const sha = hmac.digest('hex');

      const isValid = sha === v1;
      if (!isValid) {
        this.logger.debug(`Expected: ${sha}, Received: ${v1}`);
      }

      return isValid;
    } catch (error) {
      this.logger.error('Error validating signature:', error.stack);
      return false;
    }
  }

  /**
   * Procesa la acción de la orden según el tipo de evento
   */
  private async processOrderAction(
    action: string,
    purchaseId: string,
    orderData: any,
  ): Promise<void> {
    this.logger.log(
      `[Tickets Webhook] Processing action: ${action} for purchase: ${purchaseId}`,
    );

    // Verificar que la compra existe
    const purchase = await this.purchaseRepo.findOne({
      where: { id: purchaseId },
      relations: ['ticketType', 'tickets'],
    });

    if (!purchase) {
      this.logger.error(`[Tickets Webhook] Purchase not found: ${purchaseId}`);
      throw new Error(`Purchase not found: ${purchaseId}`);
    }

    switch (action) {
      case 'order.processed':
        await this.handleOrderProcessed(purchase, orderData);
        break;

      case 'order.refunded':
        await this.handleOrderRefunded(purchase, orderData);
        break;

      case 'order.expired':
      case 'order.failed':
        await this.handleOrderFailed(purchase, orderData);
        break;

      case 'order.cancelled':
        await this.handleOrderCancelled(purchase, orderData);
        break;

      default:
        this.logger.warn(`[Tickets Webhook] Unknown action: ${action}`);
    }
  }

  /**
   * Maneja pago exitoso - genera tickets
   */
  private async handleOrderProcessed(
    purchase: any,
    orderData: any,
  ): Promise<void> {
    this.logger.log(
      `[Tickets Webhook] Payment processed for purchase: ${purchase.id}`,
    );

    // Solo procesar si está pendiente
    if (purchase.paymentStatus !== TicketPurchaseStatus.PENDING) {
      this.logger.log(
        `[Tickets Webhook] Purchase ${purchase.id} already processed (status: ${purchase.paymentStatus})`,
      );
      return;
    }

    // Usar transacción para asegurar consistencia
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Actualizar estado de la compra
      purchase.paymentStatus = TicketPurchaseStatus.COMPLETED;
      await queryRunner.manager.save(purchase);

      // 2. Generar tickets individuales si no existen
      if (!purchase.tickets || purchase.tickets.length === 0) {
        await this.ticketsService.completePurchase(purchase.id);
      }

      // 3. Actualizar tickets a estado ACTIVE
      await queryRunner.manager
        .createQueryBuilder()
        .update('tickets')
        .set({ status: TicketStatus.ACTIVE })
        .where('purchaseId = :purchaseId', { purchaseId: purchase.id })
        .execute();

      await queryRunner.commitTransaction();
      this.logger.log(
        `[Tickets Webhook] Tickets generated successfully for purchase: ${purchase.id}`,
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `[Tickets Webhook] Error processing payment: ${error.message}`,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Maneja reembolso - cancela tickets y libera inventario
   */
  private async handleOrderRefunded(
    purchase: any,
    orderData: any,
  ): Promise<void> {
    this.logger.log(
      `[Tickets Webhook] Refund received for purchase: ${purchase.id}`,
    );

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Actualizar estado de la compra
      purchase.paymentStatus = TicketPurchaseStatus.REFUNDED;
      await queryRunner.manager.save(purchase);

      // 2. Actualizar tickets a REFUNDED
      await queryRunner.manager
        .createQueryBuilder()
        .update('tickets')
        .set({ status: TicketStatus.REFUNDED })
        .where('purchaseId = :purchaseId', { purchaseId: purchase.id })
        .execute();

      // 3. Liberar inventario
      await this.releaseInventory(purchase, queryRunner);

      await queryRunner.commitTransaction();
      this.logger.log(
        `[Tickets Webhook] Refund processed for purchase: ${purchase.id}`,
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `[Tickets Webhook] Error processing refund: ${error.message}`,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Maneja pago fallido o expirado
   */
  private async handleOrderFailed(
    purchase: any,
    orderData: any,
  ): Promise<void> {
    this.logger.log(
      `[Tickets Webhook] Payment failed/expired for purchase: ${purchase.id}`,
    );

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Actualizar estado de la compra
      purchase.paymentStatus = TicketPurchaseStatus.FAILED;
      await queryRunner.manager.save(purchase);

      // 2. Actualizar tickets a CANCELLED
      await queryRunner.manager
        .createQueryBuilder()
        .update('tickets')
        .set({ status: TicketStatus.CANCELLED })
        .where('purchaseId = :purchaseId', { purchaseId: purchase.id })
        .execute();

      // 3. Liberar inventario
      await this.releaseInventory(purchase, queryRunner);

      await queryRunner.commitTransaction();
      this.logger.log(
        `[Tickets Webhook] Failed payment processed for purchase: ${purchase.id}`,
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `[Tickets Webhook] Error processing failed payment: ${error.message}`,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Maneja orden cancelada
   */
  private async handleOrderCancelled(
    purchase: any,
    orderData: any,
  ): Promise<void> {
    this.logger.log(
      `[Tickets Webhook] Order cancelled for purchase: ${purchase.id}`,
    );
    // Mismo tratamiento que failed
    await this.handleOrderFailed(purchase, orderData);
  }

  /**
   * Libera el inventario de tickets reservados
   */
  private async releaseInventory(
    purchase: any,
    queryRunner: any,
  ): Promise<void> {
    if (!purchase.ticketType) {
      this.logger.warn(
        `[Tickets Webhook] No ticketType found for purchase: ${purchase.id}`,
      );
      return;
    }

    const ticketType = await queryRunner.manager.findOne('TicketType', {
      where: { id: purchase.ticketType.id },
    });

    if (ticketType) {
      // Reducir la cantidad vendida
      const newSoldQuantity = Math.max(
        0,
        Number(ticketType.soldQuantity) - purchase.quantity,
      );
      ticketType.soldQuantity = newSoldQuantity;
      await queryRunner.manager.save(ticketType);

      this.logger.log(
        `[Tickets Webhook] Inventory released: ${purchase.quantity} tickets for type: ${ticketType.id}`,
      );
    }
  }
}
