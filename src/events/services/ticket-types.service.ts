import { Injectable, NotFoundException } from '@nestjs/common';
import { TicketType } from '../entities/ticket-type.entity';
import { CreateTicketTypeDto, UpdateTicketTypeDto } from '../dto/event.dto';
import { LoggerService } from '../../core/logger';
import { TicketTypeRepository } from '../repository/ticket-type.repository';
import { EventRepository } from '../repository/event.repository';

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
    tenantId: string,
  ): Promise<TicketType> {
    if (new Date(createDto.saleStartDate) >= new Date(createDto.saleEndDate)) {
      throw new Error(
        'La fecha de inicio de venta debe ser anterior a la de fin',
      );
    }

    const event = await this.eventRepo.findOne({
      where: { id: createDto.eventId, tenantId },
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
    tenantId: string,
  ): Promise<TicketType[]> {
    const event = await this.eventRepo.findOne({
      where: { id: eventId, tenantId },
    });
    if (!event) throw new NotFoundException('Event not found or unauthorized');

    return this.ticketTypeRepo.find({
      where: { event: { id: eventId } },
    });
  }

  async update(
    id: string,
    updateDto: UpdateTicketTypeDto,
    tenantId: string,
  ): Promise<TicketType> {
    const ticketType = await this.ticketTypeRepo.findOne({
      where: { id },
      relations: ['event'],
    });

    if (!ticketType || ticketType.event.tenantId !== tenantId) {
      throw new NotFoundException('Ticket type not found or unauthorized');
    }

    const updatedTicketType = this.ticketTypeRepo.merge(ticketType, updateDto);
    return this.ticketTypeRepo.save(updatedTicketType);
  }

  async remove(id: string, tenantId: string): Promise<void> {
    const ticketType = await this.ticketTypeRepo.findOne({
      where: { id },
      relations: ['event'],
    });

    if (!ticketType || ticketType.event.tenantId !== tenantId) {
      throw new NotFoundException('Ticket type not found or unauthorized');
    }

    await this.ticketTypeRepo.remove(ticketType);
  }
}
