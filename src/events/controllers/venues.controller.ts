import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt.auth.gards';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import {
  RequirePermissions,
  InBusinessContext,
} from '../../auth/decorators/permissions.decorator';
import {
  Permission,
  BusinessContext,
} from '../../auth/models/permissions.model';
import { VenuesService } from '../services/venues.service';
import { CreateVenueDto } from '../dto/event.dto';

@ApiTags('Venues')
@Controller('venues')
export class VenuesController {
  constructor(private readonly venuesService: VenuesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @InBusinessContext(BusinessContext.EVENTS)
  @RequirePermissions(Permission.CREATE_EVENT, Permission.MANAGE_TICKETS)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Crear una nueva locación' })
  async create(@Body() createDto: CreateVenueDto) {
    return await this.venuesService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todas las locaciones' })
  async findAll() {
    return await this.venuesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una locación por ID' })
  async findOne(@Param('id') id: string) {
    return await this.venuesService.findOne(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @InBusinessContext(BusinessContext.EVENTS)
  @RequirePermissions(Permission.DELETE_EVENT, Permission.MANAGE_TICKETS)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Eliminar una locación' })
  async remove(@Param('id') id: string) {
    return await this.venuesService.remove(id);
  }
}
