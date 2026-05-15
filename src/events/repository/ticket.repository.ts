import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket } from '../entities/ticket.entity';

@Injectable()
export class TicketRepository {
  constructor(
    @InjectRepository(Ticket)
    private readonly repository: Repository<Ticket>,
  ) {}

  async save(ticket: Ticket | Ticket[], manager?: any): Promise<any> {
    const repo = manager ? manager.getRepository(Ticket) : this.repository;
    return repo.save(ticket);
  }

  async findOne(options: any, manager?: any): Promise<Ticket> {
    const repo = manager ? manager.getRepository(Ticket) : this.repository;
    return repo.findOne(options);
  }

  async find(options: any): Promise<Ticket[]> {
    return this.repository.find(options);
  }

  create(data: any, manager?: any): Ticket {
    const repo = manager ? manager.getRepository(Ticket) : this.repository;
    return repo.create(data);
  }
}
