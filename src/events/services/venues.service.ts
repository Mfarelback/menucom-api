import { Injectable, NotFoundException } from '@nestjs/common';
import { Venue } from '../entities/venue.entity';
import { CreateVenueDto } from '../dto/event.dto';
import { LoggerService } from '../../core/logger';
import { VenueRepository } from '../repository/venue.repository';

@Injectable()
export class VenuesService {
  constructor(
    private readonly venueRepo: VenueRepository,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext('VenuesService');
  }

  async create(createDto: CreateVenueDto): Promise<Venue> {
    const venue = this.venueRepo.create(createDto);
    return this.venueRepo.save(venue);
  }

  async findAll(): Promise<Venue[]> {
    return this.venueRepo.find({});
  }

  async findOne(id: string): Promise<Venue> {
    const venue = await this.venueRepo.findOne({ where: { id } });
    if (!venue) throw new NotFoundException(`Venue #${id} not found`);
    return venue;
  }

  async remove(id: string): Promise<void> {
    const venue = await this.findOne(id);
    await this.venueRepo.remove(venue);
  }
}
