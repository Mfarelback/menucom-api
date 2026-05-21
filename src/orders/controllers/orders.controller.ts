import {
  BadRequestException,
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
import { JwtAuthGuard } from '../../auth/guards/jwt.auth.gards';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequireContextPermissions } from '../../auth/decorators/permissions.decorator';
import { Permission, BusinessContext } from '../../auth/models/permissions.model';

@ApiTags('orders')
@ApiBearerAuth('JWT-auth')
@Controller('orders')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class OrdersController {
  constructor(private readonly orderService: OrdersService) {}

  @Get('byOwner')
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
      throw new BadRequestException('x-anonymous-id header is required');
    }
    return this.orderService.findByCreator(anonymousId);
  }

  @Get('byBusinessOwner/:ownerId')
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

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() updateOrderDto: Partial<CreateOrderDto>,
  ) {
    return this.orderService.update(id, updateOrderDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener los detalles de una orden por su ID' })
  async findOne(@Param('id') id: string): Promise<Order> {
    return this.orderService.findOne(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.orderService.delete(id);
  }

  @Get('admin/all')
  @RequireContextPermissions(BusinessContext.GENERAL, Permission.READ_ORDER)
  @ApiOperation({
    summary: 'Obtener todas las órdenes del sistema (admin)',
    description:
      'Lista todas las órdenes realizadas en el sistema con paginación. Requiere permiso READ_ORDER en el contexto GENERAL.',
  })
  async findAllAdmin(@Req() req: Request): Promise<Order[]> {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    return this.orderService.findAll(page, limit);
  }

  @Get('admin/count')
  @RequireContextPermissions(BusinessContext.GENERAL, Permission.READ_ORDER)
  @ApiOperation({
    summary: 'Contar órdenes (admin)',
    description:
      'Retorna el total de órdenes en el sistema. Requiere permiso READ_ORDER.',
  })
  async countAdmin() {
    return await this.orderService.countAll();
  }

  @Get('admin/revenue')
  @RequireContextPermissions(BusinessContext.GENERAL, Permission.READ_ORDER)
  @ApiOperation({
    summary: 'Obtener ingresos totales (admin)',
    description:
      'Calcula la suma de todos los totales de las órdenes. Requiere permiso READ_ORDER.',
  })
  async getRevenueAdmin() {
    return await this.orderService.getTotalRevenue();
  }
}
