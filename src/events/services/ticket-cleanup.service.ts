import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource, LessThan } from 'typeorm';
import { TicketPurchaseStatus } from '../enums/ticket-purchase-status.enum';

@Injectable()
export class TicketCleanupService {
  private readonly logger = new Logger(TicketCleanupService.name);

  constructor(private readonly dataSource: DataSource) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async cleanupExpiredPendingPurchases(): Promise<void> {
    const cutoff = new Date(Date.now() - 30 * 60 * 1000);

    const pendingPurchases = await this.dataSource.query(
      `SELECT id, quantity, "ticketTypeId" FROM ticket_purchases WHERE "paymentStatus" = $1 AND "createdAt" < $2`,
      [TicketPurchaseStatus.PENDING, cutoff],
    );

    if (pendingPurchases.length === 0) return;

    this.logger.log(
      `Liberando ${pendingPurchases.length} reservas PENDING expiradas...`,
    );

    for (const purchase of pendingPurchases) {
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        await queryRunner.manager.update(
          'ticket_purchases',
          { id: purchase.id },
          { paymentStatus: TicketPurchaseStatus.FAILED },
        );

        if (purchase.ticketTypeId) {
          await queryRunner.manager.query(
            `UPDATE ticket_types SET "soldQuantity" = GREATEST(0, "soldQuantity" - $1) WHERE id = $2`,
            [purchase.quantity, purchase.ticketTypeId],
          );
        }

        await queryRunner.commitTransaction();
        this.logger.log(`Reserva liberada: ${purchase.id}`);
      } catch (error) {
        await queryRunner.rollbackTransaction();
        this.logger.error(
          `Error liberando reserva ${purchase.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      } finally {
        await queryRunner.release();
      }
    }

    this.logger.log(
      `Limpieza completada: ${pendingPurchases.length} reservas liberadas`,
    );
  }
}
