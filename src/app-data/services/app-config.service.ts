import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AppDataService } from './app-data.service';

/**
 * Servicio simplificado para acceso rápido a configuraciones
 * desde cualquier módulo de la aplicación
 */
@Injectable()
export class AppConfigService {
  private readonly logger = new Logger(AppConfigService.name);

  constructor(private readonly appDataService: AppDataService) {}

  /**
   * Obtiene un valor de configuración por su clave
   * @param key Clave de la configuración
   * @param defaultValue Valor por defecto si no se encuentra la configuración
   * @returns El valor parseado de la configuración o el valor por defecto
   */
  async get<T = any>(key: string, defaultValue?: T): Promise<T> {
    try {
      const value = await this.appDataService.getValueByKey(key);
      return value as T;
    } catch (error) {
      if (error instanceof NotFoundException && defaultValue !== undefined) {
        this.logger.warn(
          `Configuración '${key}' no encontrada, usando valor por defecto: ${defaultValue}`,
        );
        return defaultValue;
      }
      throw error;
    }
  }

  /**
   * Obtiene un valor de configuración de tipo string
   * @param key Clave de la configuración
   * @param defaultValue Valor por defecto
   */
  async getString(key: string, defaultValue?: string): Promise<string> {
    return this.get<string>(key, defaultValue);
  }

  /**
   * Obtiene un valor de configuración de tipo number
   * @param key Clave de la configuración
   * @param defaultValue Valor por defecto
   */
  async getNumber(key: string, defaultValue?: number): Promise<number> {
    return this.get<number>(key, defaultValue);
  }

  /**
   * Obtiene un valor de configuración de tipo boolean
   * @param key Clave de la configuración
   * @param defaultValue Valor por defecto
   */
  async getBoolean(key: string, defaultValue?: boolean): Promise<boolean> {
    return this.get<boolean>(key, defaultValue);
  }

  /**
   * Obtiene un valor de configuración de tipo array
   * @param key Clave de la configuración
   * @param defaultValue Valor por defecto
   */
  async getArray<T = any>(key: string, defaultValue?: T[]): Promise<T[]> {
    return this.get<T[]>(key, defaultValue);
  }

  /**
   * Obtiene un valor de configuración de tipo objeto JSON
   * @param key Clave de la configuración
   * @param defaultValue Valor por defecto
   */
  async getObject<T = any>(key: string, defaultValue?: T): Promise<T> {
    return this.get<T>(key, defaultValue);
  }

  /**
   * Verifica si una configuración existe
   * @param key Clave de la configuración
   */
  async exists(key: string): Promise<boolean> {
    try {
      await this.appDataService.findByKey(key);
      return true;
    } catch (error) {
      if (error instanceof NotFoundException) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Obtiene múltiples configuraciones de una vez
   * @param keys Array de claves
   * @returns Objeto con las configuraciones encontradas
   */
  async getMultiple(keys: string[]): Promise<Record<string, any>> {
    const result: Record<string, any> = {};

    await Promise.all(
      keys.map(async (key) => {
        try {
          result[key] = await this.get(key);
        } catch (error) {
          if (!(error instanceof NotFoundException)) {
            throw error;
          }
          // Si no se encuentra, simplemente no se incluye en el resultado
        }
      }),
    );

    return result;
  }
}
