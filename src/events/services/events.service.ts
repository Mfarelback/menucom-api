import { Injectable, NotFoundException } from '@nestjs/common';
import { Event } from '../entities/event.entity';
import { CreateEventDto, UpdateEventDto } from '../dto/event.dto';
import { LoggerService } from '../../core/logger';
import { EventRepository } from '../repository/event.repository';
import { VenueRepository } from '../repository/venue.repository';
import { CloudinaryService } from '../../cloudinary/services/cloudinary.service';
import { TenantContext } from '../../auth/types/tenant-context.types';
import { TenantResolutionService } from '../../auth/services/tenant-resolution.service';

@Injectable()
export class EventsService {
  constructor(
    private readonly eventRepo: EventRepository,
    private readonly venueRepo: VenueRepository,
    private readonly cloudinaryService: CloudinaryService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext('EventsService');
  }

  async create(
    createEventDto: CreateEventDto,
    tenant: TenantContext,
    imageFile?: Express.Multer.File,
  ): Promise<Event> {
    const { venueId, venue: venueDto, ...eventData } = createEventDto;

    if (new Date(eventData.startDate) >= new Date(eventData.endDate)) {
      throw new Error('La fecha de inicio debe ser anterior a la de fin');
    }

    let imageUrl: string | undefined = undefined;
    if (imageFile) {
      const uploadResult = await this.cloudinaryService.uploadImage(imageFile);
      if (typeof uploadResult === 'string') {
        imageUrl = uploadResult;
      }
    }

    const event = this.eventRepo.create({
      ...eventData,
      imageUrl,
      tenantId: tenant.userId,
      commerceId: tenant.commerceId || null,
      organizer: { id: tenant.userId } as any,
    });

    if (venueId) {
      event.venue = await this.venueRepo.findOne({ where: { id: venueId } });
      if (!event.venue) throw new NotFoundException('Venue not found');
    } else if (venueDto) {
      event.venue = await this.venueRepo.save(this.venueRepo.create(venueDto));
    }

    return this.eventRepo.save(event);
  }

  async findAll(tenant: TenantContext): Promise<Event[]> {
    const where = TenantResolutionService.buildTenantFilter<Event>(tenant);
    return this.eventRepo.find({
      where,
      relations: ['venue', 'ticketTypes'],
    });
  }

  async findOne(id: string, tenant: TenantContext): Promise<Event> {
    const where = TenantResolutionService.buildTenantFilter<Event>(tenant);
    const event = await this.eventRepo.findOne({
      where: { id, ...where },
      relations: ['venue', 'ticketTypes'],
    });
    if (!event) throw new NotFoundException(`Event #${id} not found`);
    return event;
  }

  async update(
    id: string,
    updateEventDto: UpdateEventDto,
    tenant: TenantContext,
    imageFile?: Express.Multer.File,
  ): Promise<Event> {
    const event = await this.findOne(id, tenant);
    const { venueId, ...eventData } = updateEventDto;

    if (imageFile) {
      const uploadResult = await this.cloudinaryService.uploadImage(imageFile);
      if (typeof uploadResult === 'string') {
        eventData.imageUrl = uploadResult;
      }
    }

    if (venueId) {
      event.venue = await this.venueRepo.findOne({ where: { id: venueId } });
      if (!event.venue) throw new NotFoundException('Venue not found');
    }

    const updatedEvent = this.eventRepo.merge(event, eventData);
    return this.eventRepo.save(updatedEvent);
  }

  async remove(id: string, tenant: TenantContext): Promise<void> {
    const event = await this.findOne(id, tenant);
    await this.eventRepo.remove(event);
  }
}
