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
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt.auth.gards';
import { EventsService } from '../services/events.service';
import {
  CreateEventDto,
  UpdateEventDto,
  CreateEventWithFileDto,
  UpdateEventWithFileDto,
} from '../dto/event.dto';
import { AuthenticatedRequest } from '../../auth/types/request.types';

@ApiTags('Events')
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('image'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Crear un nuevo evento' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Datos del evento con imagen opcional',
    type: CreateEventWithFileDto,
  })
  @ApiResponse({ status: 201, description: 'Evento creado exitosamente' })
  async create(
    @Request() req: AuthenticatedRequest,
    @Body() createEventDto: CreateEventDto,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    const tenant = {
      userId: req.user.userId,
      commerceId: req.tenantId,
    };

    if (typeof createEventDto.venue === 'string') {
      createEventDto.venue = JSON.parse(createEventDto.venue);
    }

    return await this.eventsService.create(createEventDto, tenant, image);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar todos los eventos del tenant' })
  async findAll(@Request() req: AuthenticatedRequest) {
    const tenant = {
      userId: req.user.userId,
      commerceId: req.tenantId,
    };
    return await this.eventsService.findAll(tenant);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener un evento por ID' })
  async findOne(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    const tenant = {
      userId: req.user.userId,
      commerceId: req.tenantId,
    };
    return await this.eventsService.findOne(id, tenant);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('image'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Actualizar un evento' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Datos del evento con imagen opcional',
    type: UpdateEventWithFileDto,
  })
  async update(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() updateEventDto: UpdateEventDto,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    const tenant = {
      userId: req.user.userId,
      commerceId: req.tenantId,
    };

    if (typeof (updateEventDto as any).venue === 'string') {
      (updateEventDto as any).venue = JSON.parse((updateEventDto as any).venue);
    }

    return await this.eventsService.update(id, updateEventDto, tenant, image);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Eliminar un evento' })
  async remove(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    const tenant = {
      userId: req.user.userId,
      commerceId: req.tenantId,
    };
    return await this.eventsService.remove(id, tenant);
  }
}
