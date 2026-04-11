import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppData } from '../entities/app-data.entity';
import { CreateAppDataDto, DataType } from '../dtos/create-app-data.dto';
import { UpdateAppDataDto } from '../dtos/update-app-data.dto';

@Injectable()
export class AppDataService {
  constructor(
    @InjectRepository(AppData)
    private readonly appDataRepository: Repository<AppData>,
  ) {}

  /**
   * Crear un nuevo dato de configuración
   */
  async create(createAppDataDto: CreateAppDataDto): Promise<AppData> {
    const existingData = await this.appDataRepository.findOne({
      where: { key: createAppDataDto.key },
    });

    if (existingData) {
      throw new ConflictException(
        `Ya existe un dato de configuración con la clave: ${createAppDataDto.key}`,
      );
    }

    // Validar el valor según el tipo de dato
    this.validateValueByType(createAppDataDto.value, createAppDataDto.dataType);

    const appData = this.appDataRepository.create({
      ...createAppDataDto,
      isActive: createAppDataDto.isActive ?? true,
    });

    return await this.appDataRepository.save(appData);
  }

  /**
   * Obtener todos los datos de configuración
   */
  async findAll(includeInactive = false): Promise<AppData[]> {
    const whereCondition = includeInactive ? {} : { isActive: true };
    return await this.appDataRepository.find({
      where: whereCondition,
      order: { key: 'ASC' },
    });
  }

  /**
   * Obtener un dato de configuración por ID
   */
  async findOne(id: string): Promise<AppData> {
    const appData = await this.appDataRepository.findOne({
      where: { id },
    });

    if (!appData) {
      throw new NotFoundException(
        `Dato de configuración con ID ${id} no encontrado`,
      );
    }

    return appData;
  }

  /**
   * Obtener un dato de configuración por clave
   */
  async findByKey(key: string): Promise<AppData> {
    const appData = await this.appDataRepository.findOne({
      where: { key, isActive: true },
    });

    if (!appData) {
      throw new NotFoundException(
        `Dato de configuración con clave '${key}' no encontrado`,
      );
    }

    return appData;
  }

  /**
   * Obtener el valor de un dato de configuración por clave
   */
  async getValueByKey(key: string): Promise<any> {
    const appData = await this.findByKey(key);
    return this.parseValue(appData.value, appData.dataType);
  }

  /**
   * Obtener el porcentaje de comisión del marketplace
   * @returns El porcentaje de comisión (0-100) o 0 si no está configurado
   */
  async getMarketplaceFeePercentage(): Promise<number> {
    try {
      const percentage = await this.getValueByKey('marketplace_fee_percentage');
      return typeof percentage === 'number' ? percentage : 0;
    } catch (error) {
      // Si no existe la configuración, retornar 0%
      return 0;
    }
  }

  /**
   * Actualizar un dato de configuración
   */
  async update(
    id: string,
    updateAppDataDto: UpdateAppDataDto,
  ): Promise<AppData> {
    const appData = await this.findOne(id);

    // Si se está actualizando el valor, validar según el tipo
    if (updateAppDataDto.value && updateAppDataDto.dataType) {
      this.validateValueByType(
        updateAppDataDto.value,
        updateAppDataDto.dataType,
      );
    } else if (updateAppDataDto.value) {
      this.validateValueByType(updateAppDataDto.value, appData.dataType);
    }

    // Verificar si la nueva clave ya existe (si se está cambiando)
    if (updateAppDataDto.key && updateAppDataDto.key !== appData.key) {
      const existingData = await this.appDataRepository.findOne({
        where: { key: updateAppDataDto.key },
      });

      if (existingData) {
        throw new ConflictException(
          `Ya existe un dato de configuración con la clave: ${updateAppDataDto.key}`,
        );
      }
    }

    Object.assign(appData, updateAppDataDto);
    return await this.appDataRepository.save(appData);
  }

  /**
   * Eliminar un dato de configuración
   */
  async remove(id: string): Promise<void> {
    const appData = await this.findOne(id);
    await this.appDataRepository.remove(appData);
  }

  /**
   * Activar/Desactivar un dato de configuración
   */
  async toggleActive(id: string): Promise<AppData> {
    const appData = await this.findOne(id);
    appData.isActive = !appData.isActive;
    return await this.appDataRepository.save(appData);
  }

  /**
   * Validar valor según tipo de dato
   */
  private validateValueByType(value: string, dataType: string): void {
    try {
      switch (dataType) {
        case DataType.NUMBER:
          if (isNaN(Number(value))) {
            throw new BadRequestException('El valor debe ser un número válido');
          }
          break;

        case DataType.BOOLEAN:
          if (!['true', 'false'].includes(value.toLowerCase())) {
            throw new BadRequestException('El valor debe ser true o false');
          }
          break;

        case DataType.JSON:
          JSON.parse(value);
          break;

        case DataType.ARRAY:
          const parsed = JSON.parse(value);
          if (!Array.isArray(parsed)) {
            throw new BadRequestException(
              'El valor debe ser un array válido en formato JSON',
            );
          }
          break;

        case DataType.STRING:
        default:
          // No se necesita validación adicional para string
          break;
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al validar el valor para el tipo ${dataType}: ${error.message}`,
      );
    }
  }

  /**
   * Parsear valor según tipo de dato
   */
  private parseValue(value: string, dataType: string): any {
    switch (dataType) {
      case DataType.NUMBER:
        return Number(value);

      case DataType.BOOLEAN:
        return value.toLowerCase() === 'true';

      case DataType.JSON:
      case DataType.ARRAY:
        return JSON.parse(value);

      case DataType.STRING:
      default:
        return value;
    }
  }
}
