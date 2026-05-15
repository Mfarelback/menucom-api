import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TicketType } from '../entities/ticket-type.entity';

@Injectable()
export class TicketTypeRepository {
  constructor(
    @InjectRepository(TicketType)
    private readonly repository: Repository<TicketType>,
  ) {}

  async findOneWithLock(id: string, manager?: any): Promise<TicketType> {
    const repo = manager ? manager.getRepository(TicketType) : this.repository;
    return repo
      .createQueryBuilder('tt')
      .setLock('pessimistic_write')
      .where('tt.id = :id', { id })
      .getOne();
  }

  async save(ticketType: TicketType, manager?: any): Promise<TicketType> {
    const repo = manager ? manager.getRepository(TicketType) : this.repository;
    return repo.save(ticketType);
  }

  async findOne(options: any, manager?: any): Promise<TicketType> {
    const repo = manager ? manager.getRepository(TicketType) : this.repository;
    return repo.findOne(options);
  }

  async find(options: any): Promise<TicketType[]> {
    return this.repository.find(options);
  }

  create(data: any, manager?: any): TicketType {
    const repo = manager ? manager.getRepository(TicketType) : this.repository;
    return repo.create(data);
  }

  merge(ticketType: TicketType, data: any): TicketType {
    return this.repository.merge(ticketType, data);
  }

  async remove(ticketType: TicketType): Promise<TicketType> {
    return this.repository.remove(ticketType);
  }
}
