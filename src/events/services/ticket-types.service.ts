import { Injectable, NotFoundException } from '@nestjs/common';
import { TicketType } from '../entities/ticket-type.entity';
import { Event } from '../entities/event.entity';
import { CreateTicketTypeDto, UpdateTicketTypeDto } from '../dto/event.dto';
import { LoggerService } from '../../core/logger';
import { TicketTypeRepository } from '../repository/ticket-type.repository';
import { EventRepository } from '../repository/event.repository';
import { TenantContext } from '../../auth/types/tenant-context.types';
import { TenantResolutionService } from '../../auth/services/tenant-resolution.service';

@Injectable()
export class TicketTypesService {
  constructor(
    private readonly ticketTypeRepo: TicketTypeRepository,
    private readonly eventRepo: EventRepository,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext('TicketTypesService');
  }

  async create(
    createDto: CreateTicketTypeDto,
    tenant: TenantContext,
  ): Promise<TicketType> {
    if (new Date(createDto.saleStartDate) >= new Date(createDto.saleEndDate)) {
      throw new Error(
        'La fecha de inicio de venta debe ser anterior a la de fin',
      );
    }

    const where = TenantResolutionService.buildTenantFilter<Event>(tenant);
    const event = await this.eventRepo.findOne({
      where: { id: createDto.eventId, ...where },
    });
    if (!event) throw new NotFoundException('Event not found or unauthorized');

    const ticketType = this.ticketTypeRepo.create({
      ...createDto,
      event,
    });
    return this.ticketTypeRepo.save(ticketType);
  }

  async findAllByEvent(
    eventId: string,
    tenant: TenantContext,
  ): Promise<TicketType[]> {
    const where = TenantResolutionService.buildTenantFilter<Event>(tenant);
    const event = await this.eventRepo.findOne({
      where: { id: eventId, ...where },
    });
    if (!event) throw new NotFoundException('Event not found or unauthorized');

    return this.ticketTypeRepo.find({
      where: { event: { id: eventId } },
    });
  }

  async update(
    id: string,
    updateDto: UpdateTicketTypeDto,
    tenant: TenantContext,
  ): Promise<TicketType> {
    const ticketType = await this.ticketTypeRepo.findOne({
      where: { id },
      relations: ['event'],
    });

    if (!ticketType) {
      throw new NotFoundException('Ticket type not found');
    }

    this.validateTicketTypeTenant(ticketType, tenant);

    const updatedTicketType = this.ticketTypeRepo.merge(ticketType, updateDto);
    return this.ticketTypeRepo.save(updatedTicketType);
  }

  async remove(id: string, tenant: TenantContext): Promise<void> {
    const ticketType = await this.ticketTypeRepo.findOne({
      where: { id },
      relations: ['event'],
    });

    if (!ticketType) {
      throw new NotFoundException('Ticket type not found');
    }

    this.validateTicketTypeTenant(ticketType, tenant);

    await this.ticketTypeRepo.remove(ticketType);
  }

  private validateTicketTypeTenant(
    ticketType: TicketType,
    tenant: TenantContext,
  ): void {
    if (!ticketType.event) {
      throw new NotFoundException('Ticket type not found or unauthorized');
    }

    const filter = TenantResolutionService.buildTenantFilter<any>(tenant);

    if (filter.commerceId !== undefined) {
      if (ticketType.event.commerceId !== filter.commerceId) {
        throw new NotFoundException('Ticket type not found or unauthorized');
      }
    } else if (ticketType.event.tenantId !== tenant.userId) {
      throw new NotFoundException('Ticket type not found or unauthorized');
    }
  }
}
