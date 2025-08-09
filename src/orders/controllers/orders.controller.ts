import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrdersService } from '../services/orders.service';
import { CreateOrderDto } from '../dtos/create.order.dto';
import { Order } from '../entities/order.entity';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly orderService: OrdersService) {}

  @Get()
  findAll() {
    return 'This action returns all orders';
  }

  @Post()
  // @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear una nueva orden con ítems' })
  async create(@Body() createOrderDto: CreateOrderDto): Promise<Order> {
    return this.orderService.create(createOrderDto);
  }

  @Put(':id')
  update(@Param('id') id: string) {
    return `This action updates order #${id}`;
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return `This action removes order #${id}`;
  }
}
