import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Venue } from '../entities/venue.entity';

@Injectable()
export class VenueRepository {
  constructor(
    @InjectRepository(Venue)
    private readonly repository: Repository<Venue>,
  ) {}

  async save(venue: Venue, manager?: any): Promise<Venue> {
    const repo = manager ? manager.getRepository(Venue) : this.repository;
    return repo.save(venue);
  }

  async findOne(options: any, manager?: any): Promise<Venue> {
    const repo = manager ? manager.getRepository(Venue) : this.repository;
    return repo.findOne(options);
  }

  async find(options: any): Promise<Venue[]> {
    return this.repository.find(options);
  }

  create(data: any, manager?: any): Venue {
    const repo = manager ? manager.getRepository(Venue) : this.repository;
    return repo.create(data);
  }

  async remove(venue: Venue): Promise<Venue> {
    return this.repository.remove(venue);
  }
}
