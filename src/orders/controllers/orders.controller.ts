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
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { OrdersService } from '../services/orders.service';
import { CreateOrderDto } from '../dtos/create.order.dto';
import { Order } from '../entities/order.entity';
import { JwtAuthGuard } from 'src/auth/guards/jwt.auth.gards';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly orderService: OrdersService) {}

  @Get('byOwner')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Obtener todas las órdenes del usuario autenticado',
  })
  async findAll(@Req() req: Request): Promise<Order[]> {
    const userId = req['user']['userId'];
    return this.orderService.findByUserId(userId);
  }

  @Post()
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
