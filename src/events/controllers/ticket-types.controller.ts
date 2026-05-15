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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt.auth.gards';
import { TicketTypesService } from '../services/ticket-types.service';
import { CreateTicketTypeDto, UpdateTicketTypeDto } from '../dto/event.dto';

@ApiTags('Ticket Types')
@Controller('ticket-types')
export class TicketTypesController {
  constructor(private readonly ticketTypesService: TicketTypesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Crear un tipo de ticket para un evento' })
  async create(@Request() req, @Body() createDto: CreateTicketTypeDto) {
    const tenantId = req.user.userId;
    return await this.ticketTypesService.create(createDto, tenantId);
  }

  @Get('event/:eventId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar tipos de tickets por evento' })
  async findByEvent(@Request() req, @Param('eventId') eventId: string) {
    const tenantId = req.user.userId;
    return await this.ticketTypesService.findAllByEvent(eventId, tenantId);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Actualizar un tipo de ticket' })
  async update(
    @Request() req,
    @Param('id') id: string,
    @Body() updateDto: UpdateTicketTypeDto,
  ) {
    const tenantId = req.user.userId;
    return await this.ticketTypesService.update(id, updateDto, tenantId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Eliminar un tipo de ticket' })
  async remove(@Request() req, @Param('id') id: string) {
    const tenantId = req.user.userId;
    return await this.ticketTypesService.remove(id, tenantId);
  }
}
