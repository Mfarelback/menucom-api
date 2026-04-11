import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { CatalogService } from '../../catalog/services/catalog.service';
import { CatalogType } from '../../catalog/enums/catalog-type.enum';
import { UrlTransformService } from '../../image-proxy/services/url-transform.service';
import { LoggerService } from '../../core/logger';

/**
 * UserQueryService - Maneja consultas especializadas de usuarios
 * Responsabilidad: Búsquedas complejas con joins, agregaciones, integraciones externas
 */
@Injectable()
export class UserQueryService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly catalogService: CatalogService,
    private readonly urlTransformService: UrlTransformService,
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext('UserQueryService');
  }

  /**
   * Obtiene usuarios filtrados por roles y opcionalmente por vinculación con MercadoPago
   * @param roles - Array de roles para filtrar
   * @param withVinculedAccount - Si es true, solo usuarios con cuenta MP vinculada
   * @param includeMenus - Si es true, incluye menús y sus items para cada usuario
   * @returns Lista de usuarios filtrados con menús opcionales
   */
  async getUsersByRoles(
    roles: string[],
    withVinculedAccount: boolean = false,
    includeMenus: boolean = false,
  ): Promise<any[]> {
    try {
      const queryBuilder = this.userRepo
        .createQueryBuilder('user')
        .leftJoinAndSelect('user.membership', 'membership')
        .where('user.role IN (:...roles)', { roles });

      if (withVinculedAccount) {
        // Solo usuarios con paymentId o subscriptionId en su membership
        queryBuilder.andWhere(
          '(membership.paymentId IS NOT NULL OR membership.subscriptionId IS NOT NULL)',
        );
      }

      const users = await queryBuilder.getMany();

      // Transformar URLs y excluir passwords
      const usersWithoutPassword = users.map((user) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password, ...userWithoutPassword } = user;
        const transformedUser =
          this.urlTransformService.transformDataUrls(userWithoutPassword);

        // Agregar storeURL usando MP_BACK_URL + id del usuario
        const mpBackUrl = this.configService.get<string>(
          'config.mercadoPago.backUrl',
        );
        const storeURL = mpBackUrl ? `${mpBackUrl}/${user.id}` : null;

        return {
          ...transformedUser,
          storeURL,
        };
      });

      // Si se solicitan menús, agregarlos a cada usuario
      if (includeMenus) {
        const usersWithMenus = await Promise.all(
          usersWithoutPassword.map(async (user) => {
            const menus = await this.catalogService.getCatalogsByOwner(
              user.id,
              CatalogType.MENU,
              true,
            );
            return {
              ...user,
              menus: menus,
            };
          }),
        );
        return usersWithMenus;
      }

      return usersWithoutPassword;
    } catch (error) {
      this.logger.error(
        `Error en getUsersByRoles: ${error.message}`,
        error.stack,
      );
      this.logger.logObject('Parámetros de búsqueda', {
        roles,
        withVinculedAccount,
        includeMenus,
      });
      throw new HttpException(
        'Error al obtener usuarios por roles: ' + error.message,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
