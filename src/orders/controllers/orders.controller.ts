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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { OrdersService } from '../services/orders.service';
import { CreateOrderDto } from '../dtos/create.order.dto';
import { Order } from '../entities/order.entity';
import { JwtAuthGuard } from 'src/auth/guards/jwt.auth.gards';

@ApiTags('orders')
@ApiBearerAuth('JWT-auth')
@Controller('orders')
export class OrdersController {
  constructor(private readonly orderService: OrdersService) {}

  @Get('byOwner')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Obtener todas las órdenes del usuario autenticado con paginación',
  })
  async findAll(@Req() req: Request): Promise<Order[]> {
    const userId = req['user']['userId'];
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    return this.orderService.findByUserId(userId, page, limit);
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
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary:
      'Obtener todas las órdenes recibidas por un propietario de negocio con paginación',
  })
  async findByOwnerId(
    @Param('ownerId') ownerId: string,
    @Req() req: Request,
  ): Promise<Order[]> {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    return this.orderService.findByOwnerId(ownerId, page, limit);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear una nueva orden con ítems' })
  async create(
    @Body() createOrderDto: CreateOrderDto,
    @Headers('x-anonymous-id') anonymousId?: string,
    @Req() req?: Request,
  ): Promise<Order> {
    // Prioriza el usuario autenticado, si no existe usa el anonymousId
    const userId =
      req?.['user'] && (req['user']['userId'] || req['user']['id']);
    const orderWithCreator = {
      ...createOrderDto,
      createdBy: userId || anonymousId,
    };

    return this.orderService.create(orderWithCreator);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  update(@Param('id') id: string) {
    return `This action updates order #${id}`;
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return `This action removes order #${id}`;
  }
}
