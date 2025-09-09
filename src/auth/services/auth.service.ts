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

@Injectable()
export class AuthService {
  constructor(
    private usersService: UserService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);
    if (user) {
      const isMatch = await bcrypt.compare(pass, user.password);
      if (isMatch) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password, ...result } = user;
        // console.log(result);
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
    console.log('🔄 [AUTH SERVICE] Iniciando loginSocial');
    console.log('📊 [AUTH SERVICE] Datos recibidos de Firebase:', {
      uid: firebaseUserData?.uid,
      email: firebaseUserData?.email,
      name: firebaseUserData?.name,
      email_verified: firebaseUserData?.email_verified,
    });

    try {
      console.log(
        '🔍 [AUTH SERVICE] Buscando usuario por socialToken (uid):',
        firebaseUserData.uid,
      );
      // Buscar usuario existente por token social (Firebase UID)
      let user = await this.usersService.findBySocialToken(
        firebaseUserData.uid,
      );

      if (!user) {
        console.log('❌ [AUTH SERVICE] Usuario no encontrado por socialToken');
        console.log(
          '🔍 [AUTH SERVICE] Buscando usuario por email:',
          firebaseUserData.email,
        );

        // Si no existe, buscar por email
        user = await this.usersService.findByEmail(firebaseUserData.email);
        if (user) {
          console.log(
            '✅ [AUTH SERVICE] Usuario encontrado por email, actualizando socialToken',
          );
          // Usuario existe pero no tiene socialToken, actualizar
          user = await this.usersService.updateSocialToken(
            user.id,
            firebaseUserData.uid,
          );
          console.log('🔄 [AUTH SERVICE] SocialToken actualizado exitosamente');
        } else {
          console.log(
            '❌ [AUTH SERVICE] Usuario no encontrado por email tampoco',
          );
          console.log('🆕 [AUTH SERVICE] Creando nuevo usuario social...');
          // Usuario no existe, crear nuevo
          user = await this.registerUserSocial(firebaseUserData);

          // Verificación crítica: asegurar que registerUserSocial retornó un usuario
          if (!user) {
            console.error(
              '❌ [AUTH SERVICE] CRÍTICO: registerUserSocial retornó null',
            );
            throw new HttpException(
              'Error crítico: no se pudo crear el nuevo usuario social',
              500,
            );
          }

          console.log(
            '✅ [AUTH SERVICE] Nuevo usuario social creado con ID:',
            user.id,
          );
        }
      } else {
        console.log('✅ [AUTH SERVICE] Usuario encontrado por socialToken:', {
          id: user.id,
          email: user.email,
          name: user.name,
        });
      }

      console.log('🎫 [AUTH SERVICE] Generando JWT token...');

      // Verificación de seguridad: asegurar que user no sea null
      if (!user) {
        console.error(
          '❌ [AUTH SERVICE] ERROR CRÍTICO: user es null después de todos los intentos',
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
      console.log('✅ [AUTH SERVICE] JWT token generado exitosamente');

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

      console.log(
        '🎉 [AUTH SERVICE] LoginSocial completado exitosamente para usuario:',
        user.email,
      );
      return response;
    } catch (error) {
      console.error('❌ [AUTH SERVICE] Error en loginSocial:', {
        message: error.message,
        stack: error.stack,
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
    console.log('🆕 [AUTH SERVICE] Iniciando registro de usuario social');
    console.log('📊 [AUTH SERVICE] Datos para registro:', {
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

      console.log('💾 [AUTH SERVICE] Creando usuario en base de datos...');
      const userRegister = await this.usersService.createOfSocial(newUserData);

      // Verificación crítica: asegurar que createOfSocial retornó un usuario válido
      if (!userRegister) {
        console.error('❌ [AUTH SERVICE] CRÍTICO: createOfSocial retornó null');
        throw new HttpException(
          'Error crítico: el servicio de usuarios no pudo crear el usuario',
          500,
        );
      }

      console.log('✅ [AUTH SERVICE] Usuario social registrado exitosamente:', {
        id: userRegister.id,
        email: userRegister.email,
        role: userRegister.role,
      });

      return userRegister;
    } catch (error) {
      console.error('❌ [AUTH SERVICE] Error en registerUserSocial:', {
        message: error.message,
        stack: error.stack,
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
    console.log('🆕 [AUTH SERVICE] Iniciando registerSocialWithData');
    console.log('🔥 [AUTH SERVICE] Datos de Firebase:', {
      uid: firebaseUserData?.uid,
      email: firebaseUserData?.email,
      name: firebaseUserData?.name,
      email_verified: firebaseUserData?.email_verified,
    });
    console.log('📝 [AUTH SERVICE] Datos del formulario social:', socialData);

    try {
      const userData = {
        ...firebaseUserData,
        ...socialData, // Los datos del formulario sobreescriben los de Firebase
        socialToken: firebaseUserData.uid,
        isEmailVerified: firebaseUserData.email_verified,
        firebaseProvider: firebaseUserData.firebaseProvider,
      };

      console.log('🔗 [AUTH SERVICE] Datos combinados para registro:', {
        email: userData.email,
        name: userData.name,
        socialToken: userData.socialToken,
        role: userData.role,
      });

      console.log('💾 [AUTH SERVICE] Enviando datos a UserService...');
      const userRegister = await this.usersService.createOfSocial(userData);
      console.log('✅ [AUTH SERVICE] Usuario registrado, generando JWT...');

      const payload = {
        username: userRegister.role,
        sub: userRegister.id,
      };

      const response = {
        access_token: this.jwtService.sign(payload),
        needToChangePassword: userRegister.needToChangepassword || false,
        user: userRegister,
      };

      console.log(
        '🎉 [AUTH SERVICE] RegisterSocialWithData completado para:',
        userRegister.email,
      );
      return response;
    } catch (error) {
      console.error('❌ [AUTH SERVICE] Error en registerSocialWithData:', {
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

  async loginSocial_OLD(userData: CreateUserDto) {
    return this.usersService
      .findOne(userData.id)
      .then((user) => {
        if (user) {
          const payload = { username: user.role, sub: user.id };
          return {
            access_token: this.jwtService.sign(payload),
          };
        } else {
          return this.registerUserSocial_OLD(userData);
        }
      })
      .catch((err) => {
        if (err.status === 404) {
          return this.registerUserSocial_OLD(userData);
        }
        console.log('coltala', err.status);
      });
  }

  async registerUserSocial_OLD(userData: CreateUserDto) {
    const userRegister = await this.usersService.createOfSocial(userData);
    const payload = { username: userRegister.role, sub: userRegister.id };

    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}
