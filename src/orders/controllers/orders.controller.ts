import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
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

  @Get('byAnonymous')
  @ApiOperation({
    summary: 'Obtener todas las órdenes creadas por un usuario anónimo',
  })
  async findByAnonymous(
    @Headers('x-anonymous-id') anonymousId: string,
  ): Promise<Order[]> {
    if (!anonymousId) {
      throw new Error('x-anonymous-id header is required');
    }
    return this.orderService.findByCreator(anonymousId);
  }

  @Get('byBusinessOwner/:ownerId')
  @ApiOperation({
    summary:
      'Obtener todas las órdenes recibidas por un propietario de negocio',
  })
  async findByOwnerId(@Param('ownerId') ownerId: string): Promise<Order[]> {
    return this.orderService.findByOwnerId(ownerId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear una nueva orden con ítems' })
  async create(
    @Body() createOrderDto: CreateOrderDto,
    @Headers('x-anonymous-id') anonymousId?: string,
  ): Promise<Order> {
    // Agregar el ID del creador al DTO si está presente en el header
    const orderWithCreator = {
      ...createOrderDto,
      createdBy: anonymousId,
    };

    return this.orderService.create(orderWithCreator);
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
