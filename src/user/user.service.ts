import {
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { User } from './entities/user.entity';
import { Membership } from '../membership/entities/membership.entity';

import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { UrlTransformService } from 'src/image-proxy/services/url-transform.service';
import { LoggerService } from '../core/logger';
import { QueryUsersAdminDto } from './dto/query-users-admin.dto';
import { MembershipPlan } from '../membership/enums/membership-plan.enum';

/**
 * UserService - CRUD básico de usuarios
 * Responsabilidad: Crear, buscar, eliminar usuarios
 *
 * Servicios especializados:
 * - UserAuthService: Autenticación social (Firebase)
 * - UserProfileService: Actualización de perfil e imágenes
 * - UserRecoveryService: Recuperación de contraseñas
 * - UserQueryService: Consultas complejas con joins
 */
@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly urlTransformService: UrlTransformService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext('UserService');
  }

  async create(data: CreateUserDto) {
    // Verifica si la tabla 'user' existe
    const tableExists = await this.userRepo.query(`
      SELECT to_regclass('public.user');
    `);

    // Si la tabla no existe, créala
    if (!tableExists[0].to_regclass) {
      await this.userRepo.query(`
        CREATE TABLE "user" (
          id UUID NOT NULL PRIMARY KEY,
          "photoURL" VARCHAR(255),
          name VARCHAR(255),
          email VARCHAR(255) UNIQUE,
          phone VARCHAR(255),
          password VARCHAR(255),
          "needToChangepassword" BOOLEAN DEFAULT true,
          role VARCHAR(100),
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
    }

    if (data.email.length == 0) {
      throw new HttpException(
        'Verifica que sea un email válido',
        HttpStatus.BAD_REQUEST,
      );
    }
    const newUser = this.userRepo.create(data);

    const userCreate = await this.userRepo.findOne({
      where: { email: newUser.email },
    });

    if (userCreate) {
      if ((data as any).role == 'client') {
        return userCreate;
      } else {
        throw new HttpException(
          'Este usario ya se registró',
          HttpStatus.CONFLICT,
        );
      }
    }
    const passhash = await bcrypt.hash(newUser.password, 10);
    newUser.password = passhash;
    newUser.id = uuidv4();
    return this.userRepo.save(newUser);
  }

  async findOne(id: string) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User #${id} not found`);
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...result } = user;

    // Transformar las URLs de imágenes usando el proxy
    return this.urlTransformService.transformDataUrls(result);
  }

  async findByEmail(email: string) {
    this.logger.debug(`Buscando usuario por email: ${email}`);
    const user = await this.userRepo.findOne({ where: { email: email } });
    if (user) {
      this.logger.debug(`Usuario encontrado por email: ${user.id}`);
    } else {
      this.logger.debug('Usuario no encontrado por email');
    }
    return user;
  }

  async remove(id: string): Promise<void> {
    try {
      const user = await this.userRepo.findOne({
        where: { id: id },
        relations: ['membership'],
      });

      if (!user) {
        throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
      }

      // Eliminación del usuario (cascada automática por configuración de entidad)
      await this.userRepo.delete(id);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(
        `Error al eliminar usuario ${id}: ${error.message}`,
        error.stack,
      );

      // Lanzar error genérico o personalizado
      throw new InternalServerErrorException(
        'No se pudo eliminar el usuario. Intenta nuevamente o contacta soporte.',
      );
    }
  }

  async getadminUser(email: string) {
    const user = await this.findByEmail(email);
    if (!user) {
      throw new HttpException('Users not found', 302);
    }
    user.role = 'admin';

    await this.userRepo.save(user);

    return {
      message: 'User Admin success',
    };
  }

  async deleteAllusers() {
    const users = await this.userRepo.clear();
    return users;
  }

  async queryAdmin(query: QueryUsersAdminDto) {
    const { page = 1, limit = 20, search, plan, createdAfter, createdBefore, withActiveMembership, withVinculedAccount, sortBy = 'createdAt', sortOrder = 'DESC' } = query;

    const qb = this.userRepo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.membership', 'membership');

    if (search) {
      qb.andWhere(
        '(user.name ILIKE :search OR user.email ILIKE :search)',
        { search: `%${search}%` }
      );
    }

    if (plan) {
      qb.andWhere('membership.plan = :plan', { plan });
    }

    if (createdAfter) {
      qb.andWhere('user.createdAt >= :createdAfter', { createdAfter: new Date(createdAfter) });
    }

    if (createdBefore) {
      qb.andWhere('user.createdAt <= :createdBefore', { createdBefore: new Date(createdBefore) });
    }

    if (withActiveMembership) {
      qb.andWhere('membership.isActive = :isActive', { isActive: true });
    }

    if (withVinculedAccount) {
      qb.andWhere(
        '(membership.paymentId IS NOT NULL OR membership.subscriptionId IS NOT NULL OR membership.mpPreapprovalId IS NOT NULL)'
      );
    }

    const validSortFields = ['createdAt', 'name', 'email', 'plan'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    
    if (sortField === 'plan') {
      qb.orderBy('membership.plan', sortOrder);
    } else {
      qb.orderBy(`user.${sortField}`, sortOrder);
    }

    const total = await qb.getCount();
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;

    qb.skip(offset).take(limit);

    const users = await qb.getMany();

    const data = users.map(user => {
      const { password, ...userWithoutPassword } = user;
      return this.urlTransformService.transformDataUrls(userWithoutPassword);
    });

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  async countAdmin(filters: { plan?: string; withActiveMembership?: boolean; withVinculedAccount?: boolean }) {
    const qb = this.userRepo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.membership', 'membership');

    if (filters.plan) {
      qb.andWhere('membership.plan = :plan', { plan: filters.plan });
    }
    if (filters.withActiveMembership) {
      qb.andWhere('membership.isActive = :isActive', { isActive: true });
    }
    if (filters.withVinculedAccount) {
      qb.andWhere(
        '(membership.paymentId IS NOT NULL OR membership.subscriptionId IS NOT NULL OR membership.mpPreapprovalId IS NOT NULL)',
      );
    }

    return { total: await qb.getCount() };
  }
}