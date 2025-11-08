import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { UpdateUserDto } from '../dto/update-user.dto';
import { CloudinaryService } from '../../cloudinary/services/cloudinary.service';
import { LoggerService } from '../../core/logger';

/**
 * UserProfileService - Maneja gestión de perfiles de usuario
 * Responsabilidad: Actualización de datos, imágenes, FCM tokens
 */
@Injectable()
export class UserProfileService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly cloudinaryService: CloudinaryService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext('UserProfileService');
  }

  /**
   * Actualiza información del usuario
   * @param id - ID del usuario
   * @param changes - Cambios a aplicar
   * @param photoFile - Archivo de foto opcional (sube a Cloudinary)
   * @returns Usuario actualizado
   */
  async update(
    id: string,
    changes: UpdateUserDto,
    photoFile?: Express.Multer.File,
  ) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User #${id} not found`);
    }

    // Si se proporciona un archivo de foto, subirlo a Cloudinary
    if (photoFile) {
      this.logger.debug('Subiendo nueva foto de usuario...');
      try {
        const uploadedUrl = await this.cloudinaryService.uploadImage(photoFile);
        if (typeof uploadedUrl === 'string') {
          changes = { ...changes, photoURL: uploadedUrl };
          this.logger.log(`Foto subida exitosamente: ${uploadedUrl}`);
        } else {
          this.logger.error(`Error al subir imagen: ${uploadedUrl}`);
          throw new HttpException(
            'Error al subir la imagen',
            HttpStatus.BAD_REQUEST,
          );
        }
      } catch (error) {
        this.logger.logError('Error en uploadImage', error);
        throw new HttpException(
          'Error al procesar la imagen: ' + error.message,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }

    // Merging changes directly since password field is not allowed in UpdateUserDto
    this.userRepo.merge(user, changes);
    return this.userRepo.save(user);
  }

  /**
   * Actualiza el FCM token de un usuario para notificaciones push
   * @param userId - ID del usuario
   * @param fcmToken - Token FCM de Firebase Cloud Messaging
   * @returns Usuario actualizado
   */
  async updateFcmToken(userId: string, fcmToken: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
    user.fcmToken = fcmToken;
    return this.userRepo.save(user);
  }
}
