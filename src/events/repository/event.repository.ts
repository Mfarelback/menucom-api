import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { Event } from '../entities/event.entity';

@Injectable()
export class EventRepository {
  constructor(
    @InjectRepository(Event)
    private readonly repository: Repository<Event>,
  ) {}

  async save(event: Event, manager?: EntityManager): Promise<Event> {
    const repo = manager ? manager.getRepository(Event) : this.repository;
    return repo.save(event);
  }

  async findOne(options: any, manager?: EntityManager): Promise<Event> {
    const repo = manager ? manager.getRepository(Event) : this.repository;
    return repo.findOne(options);
  }

  async find(options: any, manager?: EntityManager): Promise<Event[]> {
    const repo = manager ? manager.getRepository(Event) : this.repository;
    return repo.find(options);
  }

  create(data: any, manager?: EntityManager): Event {
    const repo = manager ? manager.getRepository(Event) : this.repository;
    return repo.create(data) as any;
  }



  merge(event: Event, data: any, manager?: EntityManager): Event {
    const repo = manager ? manager.getRepository(Event) : this.repository;
    return repo.merge(event, data);
  }

  async remove(event: Event, manager?: EntityManager): Promise<Event> {
    const repo = manager ? manager.getRepository(Event) : this.repository;
    return repo.remove(event);
  }
}

