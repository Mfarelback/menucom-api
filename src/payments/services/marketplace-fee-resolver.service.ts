import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MerchantConfig } from '../entities/merchant-config.entity';
import { AppDataService } from '../../app-data/services/app-data.service';
import { User } from '../../user/entities/user.entity';
import { InjectRepository as InjectUserRepo } from '@nestjs/typeorm';

/**
 * Fee Resolution Result
 * Contiene el porcentaje y el origen/nivel del fee resuelto
 */
export interface FeeResolutionResult {
  percentage: number;
  source: 'custom' | 'membership' | 'global';
  description: string;
}

/**
 * Servicio para resolver el marketplace fee dinámicamente
 * 
 * Jerarquía de resolución (según DYNAMIC_MARKETPLACE_FEE.md):
 * 1. Fee personalizado del comercio (MerchantConfig)
 * 2. Fee por tipo de membresía (Membership.plan)
 * 3. Fee global de AppData (MARKETPLACE_FEE_PERCENTAGE)
 * 
 * Valor por defecto si ninguno está configurado: 5%
 */
@Injectable()
export class MarketplaceFeeResolverService {
  private readonly logger = new Logger(MarketplaceFeeResolverService.name);
  private readonly DEFAULT_FEE_PERCENTAGE = 5.0;

  // Fee por tipo de membresía (según documentación)
  private readonly MEMBERSHIP_FEE_RATES: Record<string, number> = {
    'ENTERPRISE': 3.0,   // 3% para plan Enterprise
    'PREMIUM': 5.0,      // 5% para plan Premium
    'FREE': 7.0,         // 7% para plan Free
  };

  constructor(
    @InjectRepository(MerchantConfig)
    private readonly merchantConfigRepo: Repository<MerchantConfig>,
    @InjectUserRepo(User)
    private readonly userRepo: Repository<User>,
    private readonly appDataService: AppDataService,
  ) {}

  /**
   * Resuelve el porcentaje de marketplace fee para un tenant específico
   * 
   * @param tenantId - ID del tenant/comercio
   * @returns FeeResolutionResult con el porcentaje y origen
   */
  async resolveFeePercentage(tenantId: string): Promise<FeeResolutionResult> {
    this.logger.log(`Resolving marketplace fee for tenant: ${tenantId}`);

    // Nivel 1: Fee personalizado del comercio
    const customFee = await this.getCustomFee(tenantId);
    if (customFee !== null) {
      this.logger.log(`Using custom fee for tenant ${tenantId}: ${customFee}%`);
      return {
        percentage: customFee,
        source: 'custom',
        description: 'Fee personalizado del comercio',
      };
    }

    // Nivel 2: Fee por tipo de membresía
    const membershipFee = await this.getMembershipFee(tenantId);
    if (membershipFee !== null) {
      this.logger.log(`Using membership fee for tenant ${tenantId}: ${membershipFee}%`);
      return {
        percentage: membershipFee,
        source: 'membership',
        description: 'Fee basado en plan de membresía',
      };
    }

    // Nivel 3: Fee global de AppData
    const globalFee = await this.getGlobalFee();
    if (globalFee !== null) {
      this.logger.log(`Using global fee for tenant ${tenantId}: ${globalFee}%`);
      return {
        percentage: globalFee,
        source: 'global',
        description: 'Fee global de la plataforma',
      };
    }

    // Valor por defecto
    this.logger.log(`Using default fee for tenant ${tenantId}: ${this.DEFAULT_FEE_PERCENTAGE}%`);
    return {
      percentage: this.DEFAULT_FEE_PERCENTAGE,
      source: 'global',
      description: 'Fee por defecto (no configurado)',
    };
  }

  /**
   * Calcula el monto del fee basado en el total y el tenant
   * 
   * @param totalAmount - Monto total de la transacción
   * @param tenantId - ID del tenant
   * @returns Objeto con monto del fee, monto neto, y detalles de resolución
   */
  async calculateFee(
    totalAmount: number,
    tenantId: string,
  ): Promise<{
    feeAmount: number;
    netAmount: number;
    feePercentage: number;
    feeSource: string;
    feeDescription: string;
  }> {
    const feeResolution = await this.resolveFeePercentage(tenantId);
    const feeAmount = Number(((totalAmount * feeResolution.percentage) / 100).toFixed(2));
    const netAmount = Number((totalAmount - feeAmount).toFixed(2));

    return {
      feeAmount,
      netAmount,
      feePercentage: feeResolution.percentage,
      feeSource: feeResolution.source,
      feeDescription: feeResolution.description,
    };
  }

  /**
   * Nivel 1: Obtiene el fee personalizado del comercio
   */
  private async getCustomFee(tenantId: string): Promise<number | null> {
    try {
      const config = await this.merchantConfigRepo.findOne({
        where: { tenantId, isActive: true },
      });

      if (config?.customMarketplaceFee !== null && config?.customMarketplaceFee !== undefined) {
        return Number(config.customMarketplaceFee);
      }

      return null;
    } catch (error) {
      this.logger.warn(`Error fetching custom fee for tenant ${tenantId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Nivel 2: Obtiene el fee basado en el tipo de membresía del usuario
   */
  private async getMembershipFee(tenantId: string): Promise<number | null> {
    try {
      // Buscar usuario por tenantId (asumiendo que el tenant es un usuario OWNER/EVENT_ORGANIZER)
      const user = await this.userRepo.findOne({
        where: { id: tenantId },
        relations: ['membership'],
      });

      if (user?.membership?.plan) {
        const planFee = this.MEMBERSHIP_FEE_RATES[user.membership.plan.toUpperCase()];
        if (planFee !== undefined) {
          return planFee;
        }
      }

      return null;
    } catch (error) {
      this.logger.warn(`Error fetching membership fee for tenant ${tenantId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Nivel 3: Obtiene el fee global de AppData
   */
  private async getGlobalFee(): Promise<number | null> {
    try {
      const globalFee = await this.appDataService.getMarketplaceFeePercentage();
      return globalFee ?? null;
    } catch (error) {
      this.logger.warn(`Error fetching global fee: ${error.message}`);
      return null;
    }
  }

  /**
   * Crea o actualiza la configuración de fee personalizado para un tenant
   * 
   * @param tenantId - ID del tenant
   * @param feePercentage - Porcentaje de fee (ej: 2.5 para 2.5%)
   * @returns La configuración creada/actualizada
   */
  async setCustomFee(tenantId: string, feePercentage: number): Promise<MerchantConfig> {
    // Validaciones de entrada
    if (!tenantId || typeof tenantId !== 'string') {
      throw new BadRequestException('Tenant ID es requerido y debe ser un string');
    }

    if (feePercentage === null || feePercentage === undefined) {
      throw new BadRequestException('El porcentaje de fee es requerido');
    }

    if (typeof feePercentage !== 'number' || isNaN(feePercentage)) {
      throw new BadRequestException('El porcentaje debe ser un número válido');
    }

    if (feePercentage < 0 || feePercentage > 100) {
      throw new BadRequestException('El porcentaje debe estar entre 0 y 100');
    }

    let config = await this.merchantConfigRepo.findOne({
      where: { tenantId },
    });

    if (config) {
      config.customMarketplaceFee = feePercentage;
      config.isActive = true;
    } else {
      config = this.merchantConfigRepo.create({
        tenantId,
        customMarketplaceFee: feePercentage,
        isActive: true,
      });
    }

    return await this.merchantConfigRepo.save(config);
  }

  /**
   * Obtiene la configuración de fee personalizado para un tenant
   */
  async getMerchantConfig(tenantId: string): Promise<MerchantConfig | null> {
    return await this.merchantConfigRepo.findOne({
      where: { tenantId, isActive: true },
    });
  }

  /**
   * Desactiva el fee personalizado para un tenant (vuelve a usar membresía/global)
   */
  async disableCustomFee(tenantId: string): Promise<void> {
    const config = await this.merchantConfigRepo.findOne({
      where: { tenantId },
    });

    if (config) {
      config.isActive = false;
      await this.merchantConfigRepo.save(config);
    }
  }
}
