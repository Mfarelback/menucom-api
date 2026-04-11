import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { LoggerService } from '../../core/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * UserAuthService - Maneja autenticación social (Firebase)
 * Responsabilidad: Crear y gestionar usuarios con login social (Google, etc.)
 */
@Injectable()
export class UserAuthService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext('UserAuthService');
  }

  /**
   * Crea o actualiza un usuario mediante autenticación social
   * @param data - Datos del usuario social (email, name, socialToken, firebaseProvider)
   * @returns Usuario creado o actualizado
   */
  async createOfSocial(data: any) {
    this.logger.debug('Iniciando creación de usuario social');
    this.logger.logObject('Datos recibidos para createOfSocial', {
      email: data.email,
      name: data.name,
      socialToken: data.socialToken,
      role: data.role,
      firebaseProvider: data.firebaseProvider,
    });

    try {
      // Crear el usuario con los datos sociales
      const newUser = this.userRepo.create({
        id: uuidv4(), // Generar nuevo UUID
        email: data.email,
        name: data.name,
        photoURL: data.photoURL,
        phone: data.phone || '',
        password: null, // Los usuarios sociales no tienen contraseña local
        role: data.role || 'customer',
        needToChangepassword: false, // Los usuarios sociales no necesitan cambiar contraseña
        socialToken: data.socialToken,
        firebaseProvider: data.firebaseProvider,
        isEmailVerified: data.isEmailVerified || false,
        lastLoginAt: new Date(),
      });

      this.logger.debug(
        `Verificando si existe usuario con email: ${data.email}`,
      );
      // Verificar si ya existe un usuario con el mismo email
      const existingUser = await this.userRepo.findOne({
        where: { email: newUser.email },
      });

      if (existingUser) {
        this.logger.debug(`Usuario existente encontrado: ${existingUser.id}`);
        // Si existe pero no tiene socialToken, actualizar
        if (!existingUser.socialToken) {
          this.logger.debug(
            'Actualizando usuario existente con datos sociales',
          );
          existingUser.socialToken = data.socialToken;
          existingUser.firebaseProvider = data.firebaseProvider;
          existingUser.isEmailVerified = data.isEmailVerified || false;
          existingUser.lastLoginAt = new Date();
          const updated = await this.userRepo.save(existingUser);
          this.logger.log('Usuario existente actualizado con datos sociales');
          return updated;
        } else {
          this.logger.debug(
            'Usuario ya tiene socialToken, retornando existente',
          );
          // Si ya tiene socialToken, retornar el existente
          return existingUser;
        }
      }

      this.logger.debug('Creando nuevo usuario social en base de datos...');
      // Si no existe, crear nuevo
      const savedUser = await this.userRepo.save(newUser);
      this.logger.log(
        `Nuevo usuario social creado exitosamente: ${savedUser.id}`,
      );

      // Verificación crítica final
      if (!savedUser) {
        this.logger.error('CRÍTICO: savedUser es null después de save', '');
        throw new HttpException(
          'Error crítico: no se pudo guardar el usuario en la base de datos',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      return savedUser;
    } catch (error) {
      this.logger.error(
        `Error en createOfSocial: ${error.message}`,
        error.stack,
      );
      this.logger.logObject('Datos del error', {
        email: data?.email,
        role: data?.role,
      });
      throw new HttpException(
        'Error al crear usuario social: ' + error.message,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Busca un usuario por su token social (Firebase UID)
   * @param socialToken - UID de Firebase
   * @returns Usuario encontrado o null
   */
  async findBySocialToken(socialToken: string): Promise<User | null> {
    this.logger.debug('Buscando usuario por socialToken');
    try {
      const user = await this.userRepo.findOne({ where: { socialToken } });
      if (user) {
        this.logger.debug(
          `Usuario encontrado por socialToken: ${user.id} (${user.email})`,
        );
      } else {
        this.logger.debug('Usuario no encontrado por socialToken');
      }
      return user;
    } catch (error) {
      this.logger.error(
        `Error buscando usuario por socialToken: ${error.message}`,
        error.stack,
      );
      return null;
    }
  }

  /**
   * Actualiza el token social de un usuario existente
   * @param userId - ID del usuario
   * @param socialToken - Nuevo token social
   * @returns Usuario actualizado
   */
  async updateSocialToken(userId: string, socialToken: string): Promise<User> {
    this.logger.debug(`Actualizando socialToken para usuario: ${userId}`);
    try {
      const user = await this.userRepo.findOne({ where: { id: userId } });
      if (!user) {
        this.logger.warn(
          `Usuario #${userId} no encontrado para actualizar socialToken`,
        );
        throw new NotFoundException(`Usuario #${userId} no encontrado`);
      }

      user.socialToken = socialToken;
      const updatedUser = await this.userRepo.save(user);
      this.logger.log(
        `SocialToken actualizado exitosamente para usuario: ${user.email}`,
      );
      return updatedUser;
    } catch (error) {
      this.logger.error(
        `Error actualizando socialToken para userId ${userId}: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        'Error al actualizar token social: ' + error.message,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
