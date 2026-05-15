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
import { VenuesService } from '../services/venues.service';
import { CreateVenueDto } from '../dto/event.dto';

@ApiTags('Venues')
@Controller('venues')
export class VenuesController {
  constructor(private readonly venuesService: VenuesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Eliminar una locación' })
  async remove(@Param('id') id: string) {
    return await this.venuesService.remove(id);
  }
}
