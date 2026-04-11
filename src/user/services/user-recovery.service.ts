import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { RecoveryPassword } from '../entities/recovery-password.entity';
import { ChangePasswordDto } from '../dto/password.dto';
import { LoggerService } from '../../core/logger';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

/**
 * UserRecoveryService - Maneja recuperación de contraseñas
 * Responsabilidad: Códigos de verificación, cambio de contraseñas, validaciones
 */
@Injectable()
export class UserRecoveryService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(RecoveryPassword)
    private readonly restoreRepo: Repository<RecoveryPassword>,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext('UserRecoveryService');
  }

  /**
   * Maneja el flujo completo de recuperación de contraseña
   * 1. Valida email
   * 2. Envía código de verificación
   * 3. Valida código
   * 4. Cambia contraseña
   * @param newPassword - DTO con email, código y nueva contraseña
   */
  async changePasswordByUser(newPassword: ChangePasswordDto) {
    try {
      if (newPassword.emailRecovery == '') {
        throw new BadRequestException('Se necesita un email para empezar.');
      }
      const userFind = await this.userRepo.findOne({
        where: { email: newPassword.emailRecovery },
      });
      if (userFind == null) {
        throw new NotFoundException('El usuario no se encuentra registrado');
      }
      const findCode = await this.restoreRepo.findOne({
        where: { userId: userFind.id },
      });

      if (findCode == null) {
        this.sendVerificationCode(userFind);
      } else {
        if (newPassword.code != null) {
          const isValidCode = newPassword.code == findCode.codeValidation;
          if (isValidCode) {
            if (newPassword.newPassword != null) {
              await this.changePassword(userFind, newPassword);
              await this.restoreRepo.remove([findCode]);
              return {
                message: 'Contraseña cambiada',
              };
            }

            return {
              message: 'Codigo validado',
            };
          }
          throw new ConflictException('Código invalido');
        }
        await this.restoreRepo.remove([findCode]);
        this.logger.debug('Código de recuperación removido');
        this.sendVerificationCode(userFind);
      }
      return [];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Cambia la contraseña de un usuario
   * @param user - Usuario a actualizar
   * @param pass - DTO con la nueva contraseña
   * @returns Usuario actualizado
   */
  async changePassword(user: User, pass: ChangePasswordDto) {
    try {
      if (pass.newPassword == '') {
        throw new ConflictException('La contraseña no puede estár vacía');
      }
      const passhash = await bcrypt.hash(pass.newPassword, 10);
      user.password = passhash;
      user.needToChangepassword = false;
      const newUser = await this.userRepo.save(user);
      return newUser;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Genera y envía código de verificación de 4 dígitos
   * @param userDestine - Usuario que recibirá el código
   */
  async sendVerificationCode(userDestine: User) {
    try {
      const codeVerification = this.generateRandomFourDigitNumber();

      const newCodeVerification = new RecoveryPassword();
      newCodeVerification.id = uuidv4();
      newCodeVerification.userId = userDestine.id;
      newCodeVerification.codeValidation = codeVerification;

      const codeCreated = this.restoreRepo.create(newCodeVerification);
      await this.restoreRepo.save(codeCreated);
      this.logger.debug(
        `Código de verificación creado: ${codeCreated.codeValidation}`,
      );
      return [];
    } catch (error) {
      this.logger.error(
        `Error al enviar código: ${error.message}`,
        error.stack,
      );
      throw new ServiceUnavailableException('Error al enviar código');
    }
  }

  /**
   * Genera un número aleatorio de 4 dígitos (1000-9999)
   * @returns Número de 4 dígitos
   */
  private generateRandomFourDigitNumber(): number {
    const min = 1000; // El valor mínimo (1000) para asegurar 4 dígitos
    const max = 9999; // El valor máximo (9999) para 4 dígitos

    // Genera un número aleatorio entre min y max (ambos incluidos)
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}
