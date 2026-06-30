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
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiBody,
  ApiTags,
} from '@nestjs/swagger';
import { OrdersService } from '../services/orders.service';
import { CreateOrderDto } from '../dtos/create.order.dto';
import { UpdateOrderStatusDto } from '../dtos/update-order-status.dto';
import { Order } from '../entities/order.entity';
import { PaginatedResult } from '../../core/interceptors/response-transform.interceptor';
import {
  OrderResponseDto,
  OrderForBuyerDto,
  OrderForSellerDto,
} from '../dtos/order-response.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt.auth.gards';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequireContextPermissions } from '../../auth/decorators/permissions.decorator';
import {
  Permission,
  BusinessContext,
} from '../../auth/models/permissions.model';
import { AuthenticatedRequest } from '../../auth/types/request.types';

/** Campos financieros que nunca deben exponerse a compradores */
const BUYER_SENSITIVE_FIELDS = [
  'marketplaceFeePercentage',
  'marketplaceFeeAmount',
  'mpProcessingFee',
  'netAmount',
] as const;

function sanitizeForBuyer(order: Order): Order {
  for (const field of BUYER_SENSITIVE_FIELDS) {
    delete (order as any)[field];
  }
  return order;
}

function sanitizeListForBuyer(orders: Order[]): Order[] {
  return orders.map(sanitizeForBuyer);
}

function sanitizePaginatedForBuyer(
  result: PaginatedResult<Order>,
): PaginatedResult<Order> {
  result.data = sanitizeListForBuyer(result.data);
  return result;
}

@ApiTags('orders')
@ApiBearerAuth('JWT-auth')
@ApiExtraModels(OrderForBuyerDto, OrderForSellerDto, OrderResponseDto)
@Controller('orders')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class OrdersController {
  constructor(private readonly orderService: OrdersService) {}

  @Get('byOwner')
  @ApiOperation({
    summary: 'Obtener todas las órdenes del usuario autenticado con paginación',
  })
  @ApiOkResponse({ type: OrderForBuyerDto, isArray: true })
  async findAll(
    @Req() req: AuthenticatedRequest,
  ): Promise<PaginatedResult<Order>> {
    const userId = req.user.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const result = await this.orderService.findByUserId(userId, page, limit);
    return sanitizePaginatedForBuyer(result);
  }

  @Get('byAnonymous')
  @ApiOperation({
    summary: 'Obtener todas las órdenes creadas por un usuario anónimo',
  })
  @ApiOkResponse({ type: OrderForBuyerDto, isArray: true })
  async findByAnonymous(
    @Headers('x-anonymous-id') anonymousId: string,
  ): Promise<Order[]> {
    if (!anonymousId) {
      throw new BadRequestException('x-anonymous-id header is required');
    }
    const orders = await this.orderService.findByCreator(anonymousId);
    return sanitizeListForBuyer(orders);
  }

  @Get('byBusinessOwner/:ownerId')
  @ApiOperation({
    summary:
      'Obtener todas las órdenes recibidas por un propietario de negocio con paginación',
  })
  @ApiOkResponse({ type: OrderForSellerDto, isArray: true })
  async findByOwnerId(
    @Param('ownerId') ownerId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<PaginatedResult<Order>> {
    const tenant = {
      userId: req.user.userId,
      commerceId: req.tenantId,
    };
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    return this.orderService.findByOwnerId(ownerId, page, limit, tenant);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear una nueva orden con ítems' })
  @ApiOkResponse({ type: OrderForBuyerDto })
  async create(
    @Body() createOrderDto: CreateOrderDto,
    @Headers('x-anonymous-id') anonymousId?: string,
    @Req() req?: AuthenticatedRequest,
  ): Promise<Order> {
    const userId = req?.user && (req.user.userId || (req.user as any).id);
    const orderWithCreator = {
      ...createOrderDto,
      createdBy: userId || anonymousId,
    };

    const order = await this.orderService.create(
      orderWithCreator,
      req?.tenantId,
    );
    return sanitizeForBuyer(order);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() updateOrderDto: Partial<CreateOrderDto>,
  ) {
    return this.orderService.update(id, updateOrderDto);
  }

  @Put(':id/status')
  @ApiOperation({
    summary: 'Actualizar estado de cumplimiento de una orden (vendedor)',
    description:
      'Permite al vendedor avanzar la orden a processing, shipped o delivered. Rechaza si el pago no está aprobado.',
  })
  @ApiBody({ type: UpdateOrderStatusDto })
  @ApiOkResponse({ type: OrderForSellerDto })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
  ): Promise<Order> {
    return this.orderService.updateOrderFulfillmentStatus(id, dto.status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener los detalles de una orden por su ID' })
  @ApiOkResponse({ type: OrderForBuyerDto })
  async findOne(@Param('id') id: string): Promise<Order> {
    const order = await this.orderService.findOne(id);
    return sanitizeForBuyer(order);
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
  @ApiOkResponse({ type: OrderResponseDto, isArray: true })
  async findAllAdmin(
    @Req() req: AuthenticatedRequest,
  ): Promise<PaginatedResult<Order>> {
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
