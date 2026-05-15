import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TicketPurchase } from '../entities/ticket-purchase.entity';

@Injectable()
export class TicketPurchaseRepository {
  constructor(
    @InjectRepository(TicketPurchase)
    private readonly repository: Repository<TicketPurchase>,
  ) {}

  async save(purchase: TicketPurchase, manager?: any): Promise<TicketPurchase> {
    const repo = manager ? manager.getRepository(TicketPurchase) : this.repository;
    return repo.save(purchase);
  }

  async findOne(options: any, manager?: any): Promise<TicketPurchase> {
    const repo = manager ? manager.getRepository(TicketPurchase) : this.repository;
    return repo.findOne(options);
  }

  async find(options: any): Promise<TicketPurchase[]> {
    return this.repository.find(options);
  }

  create(data: any, manager?: any): TicketPurchase {
    const repo = manager ? manager.getRepository(TicketPurchase) : this.repository;
    return repo.create(data);
  }
}
