import { Injectable, NotFoundException } from '@nestjs/common';
import { Event } from '../entities/event.entity';
import { CreateEventDto, UpdateEventDto } from '../dto/event.dto';
import { LoggerService } from '../../core/logger';
import { EventRepository } from '../repository/event.repository';
import { VenueRepository } from '../repository/venue.repository';
import { CloudinaryService } from '../../cloudinary/services/cloudinary.service';

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
    tenantId: string,
    organizerId: string,
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
      tenantId,
      organizer: { id: organizerId } as any,
    });

    if (venueId) {
      event.venue = await this.venueRepo.findOne({ where: { id: venueId } });
      if (!event.venue) throw new NotFoundException('Venue not found');
    } else if (venueDto) {
      event.venue = await this.venueRepo.save(this.venueRepo.create(venueDto));
    }

    return this.eventRepo.save(event);
  }

  async findAll(tenantId: string): Promise<Event[]> {
    return this.eventRepo.find({
      where: { tenantId },
      relations: ['venue', 'ticketTypes'],
    });
  }

  async findOne(id: string, tenantId: string): Promise<Event> {
    const event = await this.eventRepo.findOne({
      where: { id, tenantId },
      relations: ['venue', 'ticketTypes'],
    });
    if (!event) throw new NotFoundException(`Event #${id} not found`);
    return event;
  }

  async update(
    id: string,
    updateEventDto: UpdateEventDto,
    tenantId: string,
    imageFile?: Express.Multer.File,
  ): Promise<Event> {
    const event = await this.findOne(id, tenantId);
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

  async remove(id: string, tenantId: string): Promise<void> {
    const event = await this.findOne(id, tenantId);
    await this.eventRepo.remove(event);
  }
}
