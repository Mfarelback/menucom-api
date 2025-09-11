import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { AppDataService } from '../services/app-data.service';
import { CreateAppDataDto } from '../dtos/create-app-data.dto';
import { UpdateAppDataDto } from '../dtos/update-app-data.dto';
import { AppData } from '../entities/app-data.entity';
import { JwtAuthGuard } from 'src/auth/guards/jwt.auth.gards';
import { RoleGuard } from 'src/auth/guards/role.guards';
import { Roles } from 'src/auth/decorators/role.decorator';
import { Public } from 'src/auth/decorators/public.decorator';
import { Role } from 'src/auth/models/roles.model';
import {
  SetMarketplaceFeeDto,
  MarketplaceFeeResponseDto,
} from '../dtos/marketplace-fee.dto';

@ApiTags('App Data')
@Controller('app-data')
@UseGuards(JwtAuthGuard)
export class AppDataController {
  constructor(private readonly appDataService: AppDataService) {}

  @Post()
  @UseGuards(RoleGuard)
  @Roles(Role.OPERADOR, Role.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Crear un nuevo dato de configuración (Solo Operadores/Admins)',
    description:
      'Crea un nuevo dato de configuración con una clave única y su valor correspondiente. Requiere rol de operador o admin.',
  })
  @ApiResponse({
    status: 201,
    description: 'Dato de configuración creado exitosamente.',
    type: AppData,
  })
  @ApiResponse({
    status: 409,
    description: 'Ya existe un dato de configuración con esa clave.',
  })
  @ApiResponse({
    status: 403,
    description: 'No tienes permisos para realizar esta acción.',
  })
  async create(@Body() createAppDataDto: CreateAppDataDto): Promise<AppData> {
    return this.appDataService.create(createAppDataDto);
  }

  @Get()
  @Public()
  @ApiOperation({
    summary: 'Obtener todos los datos de configuración (Público)',
    description:
      'Obtiene todos los datos de configuración. Por defecto solo muestra los activos. No requiere autenticación.',
  })
  @ApiQuery({
    name: 'includeInactive',
    required: false,
    type: Boolean,
    description: 'Incluir datos de configuración inactivos',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de datos de configuración obtenida exitosamente.',
    type: [AppData],
  })
  async findAll(
    @Query('includeInactive') includeInactive?: string,
  ): Promise<AppData[]> {
    const includeInactiveFlag = includeInactive === 'true';
    return this.appDataService.findAll(includeInactiveFlag);
  }

  @Get(':id')
  @Public()
  @ApiOperation({
    summary: 'Obtener un dato de configuración por ID (Público)',
    description:
      'Obtiene un dato de configuración específico por su ID. No requiere autenticación.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del dato de configuración',
    type: 'string',
  })
  @ApiResponse({
    status: 200,
    description: 'Dato de configuración encontrado.',
    type: AppData,
  })
  @ApiResponse({
    status: 404,
    description: 'Dato de configuración no encontrado.',
  })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<AppData> {
    return this.appDataService.findOne(id);
  }

  @Get('key/:key')
  @Public()
  @ApiOperation({
    summary: 'Obtener un dato de configuración por clave (Público)',
    description:
      'Obtiene un dato de configuración específico por su clave única. No requiere autenticación.',
  })
  @ApiParam({
    name: 'key',
    description: 'Clave del dato de configuración',
    type: 'string',
  })
  @ApiResponse({
    status: 200,
    description: 'Dato de configuración encontrado.',
    type: AppData,
  })
  @ApiResponse({
    status: 404,
    description: 'Dato de configuración no encontrado.',
  })
  async findByKey(@Param('key') key: string): Promise<AppData> {
    return this.appDataService.findByKey(key);
  }

  @Get('value/:key')
  @Public()
  @ApiOperation({
    summary: 'Obtener el valor de un dato de configuración por clave (Público)',
    description:
      'Obtiene solo el valor parseado de un dato de configuración por su clave. No requiere autenticación.',
  })
  @ApiParam({
    name: 'key',
    description: 'Clave del dato de configuración',
    type: 'string',
  })
  @ApiResponse({
    status: 200,
    description: 'Valor del dato de configuración obtenido exitosamente.',
  })
  @ApiResponse({
    status: 404,
    description: 'Dato de configuración no encontrado.',
  })
  async getValueByKey(@Param('key') key: string): Promise<any> {
    return { value: await this.appDataService.getValueByKey(key) };
  }

  @Patch(':id')
  @UseGuards(RoleGuard)
  @Roles(Role.OPERADOR, Role.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Actualizar un dato de configuración (Solo Operadores/Admins)',
    description:
      'Actualiza un dato de configuración existente por su ID. Requiere rol de operador o admin.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del dato de configuración',
    type: 'string',
  })
  @ApiResponse({
    status: 200,
    description: 'Dato de configuración actualizado exitosamente.',
    type: AppData,
  })
  @ApiResponse({
    status: 404,
    description: 'Dato de configuración no encontrado.',
  })
  @ApiResponse({
    status: 403,
    description: 'No tienes permisos para realizar esta acción.',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateAppDataDto: UpdateAppDataDto,
  ): Promise<AppData> {
    return this.appDataService.update(id, updateAppDataDto);
  }

  @Patch(':id/toggle-active')
  @UseGuards(RoleGuard)
  @Roles(Role.OPERADOR, Role.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary:
      'Activar/Desactivar un dato de configuración (Solo Operadores/Admins)',
    description:
      'Cambia el estado activo/inactivo de un dato de configuración. Requiere rol de operador o admin.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del dato de configuración',
    type: 'string',
  })
  @ApiResponse({
    status: 200,
    description: 'Estado del dato de configuración actualizado exitosamente.',
    type: AppData,
  })
  @ApiResponse({
    status: 404,
    description: 'Dato de configuración no encontrado.',
  })
  @ApiResponse({
    status: 403,
    description: 'No tienes permisos para realizar esta acción.',
  })
  async toggleActive(@Param('id', ParseUUIDPipe) id: string): Promise<AppData> {
    return this.appDataService.toggleActive(id);
  }

  @Delete(':id')
  @UseGuards(RoleGuard)
  @Roles(Role.OPERADOR, Role.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Eliminar un dato de configuración (Solo Operadores/Admins)',
    description:
      'Elimina permanentemente un dato de configuración por su ID. Requiere rol de operador o admin.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del dato de configuración',
    type: 'string',
  })
  @ApiResponse({
    status: 200,
    description: 'Dato de configuración eliminado exitosamente.',
  })
  @ApiResponse({
    status: 404,
    description: 'Dato de configuración no encontrado.',
  })
  @ApiResponse({
    status: 403,
    description: 'No tienes permisos para realizar esta acción.',
  })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.appDataService.remove(id);
  }

  @Get('marketplace-fee')
  @Public()
  @ApiOperation({
    summary: 'Obtener el porcentaje de comisión del marketplace (Público)',
    description:
      'Obtiene el porcentaje de comisión que cobra el marketplace por cada transacción. No requiere autenticación.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Porcentaje de comisión del marketplace obtenido exitosamente.',
    type: MarketplaceFeeResponseDto,
  })
  async getMarketplaceFee(): Promise<MarketplaceFeeResponseDto> {
    try {
      const percentage = await this.appDataService.getValueByKey(
        'marketplace_fee_percentage',
      );
      return { percentage: percentage || 0 };
    } catch (error) {
      // Si no existe el dato, retornar 0% como valor por defecto
      return { percentage: 0 };
    }
  }

  @Post('marketplace-fee')
  @UseGuards(RoleGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary:
      'Configurar el porcentaje de comisión del marketplace (Solo Admins)',
    description:
      'Configura el porcentaje de comisión que cobra el marketplace por cada transacción. Requiere rol de administrador.',
  })
  @ApiResponse({
    status: 200,
    description: 'Porcentaje de comisión configurado exitosamente.',
    type: AppData,
  })
  @ApiResponse({
    status: 400,
    description: 'Porcentaje inválido. Debe estar entre 0 y 100.',
  })
  @ApiResponse({
    status: 403,
    description: 'No tienes permisos para realizar esta acción.',
  })
  async setMarketplaceFee(
    @Body() setMarketplaceFeeDto: SetMarketplaceFeeDto,
  ): Promise<AppData> {
    const { percentage } = setMarketplaceFeeDto;

    try {
      // Intentar actualizar si ya existe
      const existingData = await this.appDataService.findByKey(
        'marketplace_fee_percentage',
      );
      return await this.appDataService.update(existingData.id, {
        value: percentage.toString(),
      });
    } catch (error) {
      // Si no existe, crear uno nuevo
      return await this.appDataService.create({
        key: 'marketplace_fee_percentage',
        value: percentage.toString(),
        dataType: 'number' as any,
        description: 'Porcentaje de comisión del marketplace por transacción',
        isActive: true,
      });
    }
  }
}
