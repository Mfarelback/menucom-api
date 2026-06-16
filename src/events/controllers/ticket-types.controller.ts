import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt.auth.gards';
import { TicketTypesService } from '../services/ticket-types.service';
import { CreateTicketTypeDto, UpdateTicketTypeDto } from '../dto/event.dto';
import { AuthenticatedRequest } from '../../auth/types/request.types';

@ApiTags('Ticket Types')
@Controller('ticket-types')
export class TicketTypesController {
  constructor(private readonly ticketTypesService: TicketTypesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Crear un tipo de ticket para un evento' })
  async create(
    @Request() req: AuthenticatedRequest,
    @Body() createDto: CreateTicketTypeDto,
  ) {
    const tenant = {
      userId: req.user.userId,
      commerceId: req.tenantId,
    };
    return await this.ticketTypesService.create(createDto, tenant);
  }

  @Get('event/:eventId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar tipos de tickets por evento' })
  async findByEvent(
    @Request() req: AuthenticatedRequest,
    @Param('eventId') eventId: string,
  ) {
    const tenant = {
      userId: req.user.userId,
      commerceId: req.tenantId,
    };
    return await this.ticketTypesService.findAllByEvent(eventId, tenant);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Actualizar un tipo de ticket' })
  async update(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() updateDto: UpdateTicketTypeDto,
  ) {
    const tenant = {
      userId: req.user.userId,
      commerceId: req.tenantId,
    };
    return await this.ticketTypesService.update(id, updateDto, tenant);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Eliminar un tipo de ticket' })
  async remove(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    const tenant = {
      userId: req.user.userId,
      commerceId: req.tenantId,
    };
    return await this.ticketTypesService.remove(id, tenant);
  }
}
