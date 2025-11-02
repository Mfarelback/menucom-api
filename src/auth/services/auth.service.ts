import {
  HttpException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UserService } from 'src/user/user.service';
import { JwtService } from '@nestjs/jwt';
import { CreateUserDto } from 'src/user/dto/create-user.dto';
import { LoggerService } from 'src/core/logger/logger.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UserService,
    private jwtService: JwtService,
    private logger: LoggerService,
  ) {
    this.logger.setContext('AuthService');
  }

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);
    if (user) {
      const isMatch = await bcrypt.compare(pass, user.password);
      if (isMatch) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password, ...result } = user;
        return result;
      } else {
        throw new UnauthorizedException('Contraseña no válida');
      }
    } else {
      throw new NotFoundException('No se encontró un usuario con este email');
    }
  }

  async login(user: any) {
    const payload = {
      username: user['user']['role'],
      sub: user['user']['id'],
    };

    const userLog = await this.usersService.findOne(payload.sub);
    return {
      access_token: this.jwtService.sign(payload),
      needToChangePassword: userLog.needToChangepassword,
    };
  }

  async registerUser(userData: CreateUserDto) {
    try {
      const userRegister = await this.usersService.create(userData);
      const payload = {
        username: userRegister.role,
        sub: userRegister.id,
      };
      return {
        access_token: this.jwtService.sign(payload),
        needToChangePassword: userRegister.needToChangepassword,
      };
    } catch (error) {
      throw new HttpException(error.message, error.status);
    }
  }

  /**
   * Autenticación social mejorada con Firebase
   * @param firebaseUserData - Datos del usuario extraídos del token de Firebase
   * @returns Token JWT y datos del usuario
   */
  async loginSocial(firebaseUserData: any) {
    this.logger.debug('Iniciando loginSocial');
    this.logger.logObject('Datos recibidos de Firebase', {
      uid: firebaseUserData?.uid,
      email: firebaseUserData?.email,
      name: firebaseUserData?.name,
      email_verified: firebaseUserData?.email_verified,
    });

    try {
      this.logger.debug(
        `Buscando usuario por socialToken (uid): ${firebaseUserData.uid}`,
      );
      // Buscar usuario existente por token social (Firebase UID)
      let user = await this.usersService.findBySocialToken(
        firebaseUserData.uid,
      );

      if (!user) {
        this.logger.debug('Usuario no encontrado por socialToken');
        this.logger.debug(
          `Buscando usuario por email: ${firebaseUserData.email}`,
        );

        // Si no existe, buscar por email
        user = await this.usersService.findByEmail(firebaseUserData.email);
        if (user) {
          this.logger.log(
            'Usuario encontrado por email, actualizando socialToken',
          );
          // Usuario existe pero no tiene socialToken, actualizar
          user = await this.usersService.updateSocialToken(
            user.id,
            firebaseUserData.uid,
          );
          this.logger.log('SocialToken actualizado exitosamente');
        } else {
          this.logger.debug('Usuario no encontrado por email tampoco');
          this.logger.log('Creando nuevo usuario social...');
          // Usuario no existe, crear nuevo
          user = await this.registerUserSocial(firebaseUserData);

          // Verificación crítica: asegurar que registerUserSocial retornó un usuario
          if (!user) {
            this.logger.error(
              'CRÍTICO: registerUserSocial retornó null',
              new Error('User creation failed').stack,
            );
            throw new HttpException(
              'Error crítico: no se pudo crear el nuevo usuario social',
              500,
            );
          }

          this.logger.log(`Nuevo usuario social creado con ID: ${user.id}`);
        }
      } else {
        this.logger.log('Usuario encontrado por socialToken');
        this.logger.logObject('Datos del usuario', {
          id: user.id,
          email: user.email,
          name: user.name,
        });
      }

      this.logger.debug('Generando JWT token...');

      // Verificación de seguridad: asegurar que user no sea null
      if (!user) {
        this.logger.error(
          'ERROR CRÍTICO: user es null después de todos los intentos',
          new Error('User is null').stack,
        );
        throw new HttpException(
          'Error interno: no se pudo crear o encontrar el usuario',
          500,
        );
      }

      // Generar JWT
      const payload = {
        username: user.role,
        sub: user.id,
      };

      const jwtToken = this.jwtService.sign(payload);
      this.logger.log('JWT token generado exitosamente');

      const response = {
        access_token: jwtToken,
        needToChangePassword: user.needToChangepassword || false,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          photoURL: user.photoURL || firebaseUserData.picture,
          phone: user.phone || firebaseUserData.phone,
          role: user.role,
          socialToken: user.socialToken,
        },
      };

      this.logger.log(
        `LoginSocial completado exitosamente para usuario: ${user.email}`,
      );
      return response;
    } catch (error) {
      this.logger.error(`Error en loginSocial: ${error.message}`, error.stack);
      this.logger.logObject('Contexto del error', {
        firebaseUid: firebaseUserData?.uid,
        firebaseEmail: firebaseUserData?.email,
      });
      throw new HttpException(
        'Error en autenticación social: ' + error.message,
        error.status || 500,
      );
    }
  }

  /**
   * Registro de usuario social mejorado
   * @param firebaseUserData - Datos del usuario de Firebase
   * @returns Usuario creado
   */
  async registerUserSocial(firebaseUserData: any) {
    this.logger.log('Iniciando registro de usuario social');
    this.logger.logObject('Datos para registro', {
      email: firebaseUserData.email,
      uid: firebaseUserData.uid,
      name: firebaseUserData.name,
      email_verified: firebaseUserData.email_verified,
    });

    try {
      const newUserData = {
        email: firebaseUserData.email,
        name: firebaseUserData.name || firebaseUserData.email?.split('@')[0],
        socialToken: firebaseUserData.uid,
        photoURL: firebaseUserData.picture,
        phone: firebaseUserData.phone,
        role: 'customer', // Rol por defecto para usuarios sociales
        needToChangepassword: false, // No necesitan cambiar contraseña los usuarios sociales
        password: null, // No tienen contraseña local
        isEmailVerified: firebaseUserData.email_verified || false,
        // Datos adicionales de Firebase
        firebaseProvider: firebaseUserData.firebaseProvider,
        lastLoginAt: new Date(),
      };

      this.logger.debug('Creando usuario en base de datos...');
      const userRegister = await this.usersService.createOfSocial(newUserData);

      // Verificación crítica: asegurar que createOfSocial retornó un usuario válido
      if (!userRegister) {
        this.logger.error(
          'CRÍTICO: createOfSocial retornó null',
          new Error('User creation failed').stack,
        );
        throw new HttpException(
          'Error crítico: el servicio de usuarios no pudo crear el usuario',
          500,
        );
      }

      this.logger.log('Usuario social registrado exitosamente');
      this.logger.logObject('Datos del usuario registrado', {
        id: userRegister.id,
        email: userRegister.email,
        role: userRegister.role,
      });

      return userRegister;
    } catch (error) {
      this.logger.error(
        `Error en registerUserSocial: ${error.message}`,
        error.stack,
      );
      this.logger.logObject('Contexto del error', {
        firebaseEmail: firebaseUserData?.email,
        firebaseUid: firebaseUserData?.uid,
      });
      throw new HttpException(
        'Error al registrar usuario social: ' + error.message,
        500,
      );
    }
  }

  /**
   * Método mejorado para registro social con datos adicionales
   * @param socialData - Datos del formulario de registro social
   * @param firebaseUserData - Datos verificados de Firebase
   * @returns Token JWT y datos del usuario
   */
  async registerSocialWithData(socialData: any, firebaseUserData: any) {
    this.logger.log('Iniciando registerSocialWithData');
    this.logger.logObject('Datos de Firebase', {
      uid: firebaseUserData?.uid,
      email: firebaseUserData?.email,
      name: firebaseUserData?.name,
      email_verified: firebaseUserData?.email_verified,
    });
    this.logger.logObject('Datos del formulario social', socialData);

    try {
      const userData = {
        ...firebaseUserData,
        ...socialData, // Los datos del formulario sobreescriben los de Firebase
        socialToken: firebaseUserData.uid,
        isEmailVerified: firebaseUserData.email_verified,
        firebaseProvider: firebaseUserData.firebaseProvider,
      };

      this.logger.logObject('Datos combinados para registro', {
        email: userData.email,
        name: userData.name,
        socialToken: userData.socialToken,
        role: userData.role,
      });

      this.logger.debug('Enviando datos a UserService...');
      const userRegister = await this.usersService.createOfSocial(userData);
      this.logger.log('Usuario registrado, generando JWT...');

      const payload = {
        username: userRegister.role,
        sub: userRegister.id,
      };

      const response = {
        access_token: this.jwtService.sign(payload),
        needToChangePassword: userRegister.needToChangepassword || false,
        user: userRegister,
      };

      this.logger.log(
        `RegisterSocialWithData completado para: ${userRegister.email}`,
      );
      return response;
    } catch (error) {
      this.logger.error(
        `Error en registerSocialWithData: ${error.message}`,
        error.stack,
      );
      this.logger.logObject('Contexto del error', {
        message: error.message,
        stack: error.stack?.substring(0, 200) + '...',
        firebaseUid: firebaseUserData?.uid,
        socialDataKeys: Object.keys(socialData || {}),
      });
      throw new HttpException(
        'Error al registrar usuario con datos sociales: ' + error.message,
        500,
      );
    }
  }
}
