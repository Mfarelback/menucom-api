import {
  HttpException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UserService } from '../../user/user.service';
import { UserAuthService } from '../../user/services/user-auth.service';
import { JwtService } from '@nestjs/jwt';
import { CreateUserDto } from '../../user/dto/create-user.dto';
import { LoggerService } from '../../core/logger/logger.service';
import { UserRoleService } from './user-role.service';
import { RoleType, BusinessContext } from '../models/permissions.model';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UserService,
    private userAuthService: UserAuthService,
    private jwtService: JwtService,
    private logger: LoggerService,
    private userRoleService: UserRoleService,
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

      // NUEVO: Mapeo completo de businessType a (role, context)
      const businessTypeMapping: Record<
        string,
        {
          role: RoleType;
          context: BusinessContext;
          needsCustomerRole: boolean;
        }
      > = {
        // Cliente final - solo compra
        customer: {
          role: RoleType.CUSTOMER,
          context: BusinessContext.GENERAL,
          needsCustomerRole: false,
        },

        // Comerciantes - OWNER en su contexto + CUSTOMER para comprar en otros
        food: {
          role: RoleType.OWNER,
          context: BusinessContext.RESTAURANT,
          needsCustomerRole: true,
        },
        dinning: {
          role: RoleType.OWNER,
          context: BusinessContext.RESTAURANT,
          needsCustomerRole: true,
        },
        clothes: {
          role: RoleType.OWNER,
          context: BusinessContext.WARDROBE,
          needsCustomerRole: true,
        },
        retail: {
          role: RoleType.OWNER,
          context: BusinessContext.MARKETPLACE,
          needsCustomerRole: true,
        },
        grocery: {
          role: RoleType.OWNER,
          context: BusinessContext.MARKETPLACE,
          needsCustomerRole: true,
        },
        electronics: {
          role: RoleType.OWNER,
          context: BusinessContext.MARKETPLACE,
          needsCustomerRole: true,
        },
        accessories: {
          role: RoleType.OWNER,
          context: BusinessContext.MARKETPLACE,
          needsCustomerRole: true,
        },
        pharmacy: {
          role: RoleType.OWNER,
          context: BusinessContext.GENERAL,
          needsCustomerRole: true,
        },
        beauty: {
          role: RoleType.OWNER,
          context: BusinessContext.GENERAL,
          needsCustomerRole: true,
        },
        construction: {
          role: RoleType.OWNER,
          context: BusinessContext.GENERAL,
          needsCustomerRole: true,
        },
        automotive: {
          role: RoleType.OWNER,
          context: BusinessContext.GENERAL,
          needsCustomerRole: true,
        },
        pets: {
          role: RoleType.OWNER,
          context: BusinessContext.MARKETPLACE,
          needsCustomerRole: true,
        },
        water_distributor: {
          role: RoleType.OWNER,
          context: BusinessContext.MARKETPLACE,
          needsCustomerRole: true,
        },
        events: {
          // NUEVO: Organizador de eventos
          role: RoleType.OWNER,
          context: BusinessContext.EVENTS,
          needsCustomerRole: true,
        },

        // Administradores del sistema
        admin: {
          role: RoleType.ADMIN,
          context: BusinessContext.GENERAL,
          needsCustomerRole: false,
        },
        operador: {
          role: RoleType.OPERATOR,
          context: BusinessContext.GENERAL,
          needsCustomerRole: false,
        },
      };

      // Usar businessType (nuevo) o role (legacy) para determinar el tipo
      const typeKey = userData.businessType || userData.role || 'customer';
      const mapping =
        businessTypeMapping[typeKey] || businessTypeMapping['customer'];

      this.logger.log(
        `Registrando usuario ${userRegister.email} con businessType: ${typeKey} → ` +
          `rol: ${mapping.role}, contexto: ${mapping.context}`,
      );

      // 1. Asignar rol principal (OWNER/ADMIN/CUSTOMER en su contexto)
      try {
        await this.userRoleService.assignRole(
          userRegister.id,
          mapping.role,
          mapping.context,
          {
            grantedBy: 'system',
            metadata: {
              source: 'registration-v2',
              businessType: typeKey,
              registeredAt: new Date().toISOString(),
            },
          },
        );
        this.logger.log(
          `✅ Rol ${mapping.role} asignado en ${mapping.context} a ${userRegister.email}`,
        );
      } catch (roleError) {
        this.logger.warn(
          `No se pudo asignar rol principal a ${userRegister.id}: ${roleError instanceof Error ? roleError.message : String(roleError)}`,
        );
      }

      // 2. Si es comerciante, también darle CUSTOMER para que pueda comprar en otros negocios
      if (mapping.needsCustomerRole) {
        try {
          await this.userRoleService.assignRole(
            userRegister.id,
            RoleType.CUSTOMER,
            BusinessContext.GENERAL,
            {
              grantedBy: 'system',
              metadata: {
                source: 'registration-dual-role',
                reason: 'merchant_can_also_buy_as_customer',
              },
            },
          );
          this.logger.log(
            `✅ Rol dual CUSTOMER asignado a ${userRegister.email}`,
          );
        } catch (roleError) {
          this.logger.warn(
            `No se pudo asignar rol CUSTOMER a ${userRegister.id}: ${roleError instanceof Error ? roleError.message : String(roleError)}`,
          );
        }
      }

      const payload = {
        username: userRegister.role,
        sub: userRegister.id,
      };

      return {
        access_token: this.jwtService.sign(payload),
        needToChangePassword: userRegister.needToChangepassword,
      };
    } catch (error) {
      this.logger.error(
        `Error en registerUser: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new HttpException(
        error instanceof Error ? error.message : String(error),
        (error as any).status || 500,
      );
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
      let user = await this.userAuthService.findBySocialToken(
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
          user = await this.userAuthService.updateSocialToken(
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
      this.logger.error(
        `Error en loginSocial: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : String(error),
      );
      this.logger.logObject('Contexto del error', {
        firebaseUid: firebaseUserData?.uid,
        firebaseEmail: firebaseUserData?.email,
      });
      throw new HttpException(
        'Error en autenticación social: ' +
          (error instanceof Error ? error.message : String(error)),
        (error as any).status || 500,
      );
    }
  }

  /**
   * Refresca el token JWT para el usuario actual
   * @param userId - ID del usuario extraído del token actual
   * @returns Nuevo token JWT y datos del usuario actualizados
   */
  async refresh(userId: string) {
    this.logger.debug(`Refrescando token para usuario: ${userId}`);
    const user = await this.usersService.findOne(userId);

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    const payload = {
      username: user.role,
      sub: user.id,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        photoURL: user.photoURL,
        role: user.role,
      },
    };
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
      // Obtener el businessType de los datos sociales si existe
      const businessType = firebaseUserData.businessType || 'customer';

      const newUserData = {
        email: firebaseUserData.email,
        name: firebaseUserData.name || firebaseUserData.email?.split('@')[0],
        socialToken: firebaseUserData.uid,
        photoURL: firebaseUserData.picture,
        phone: firebaseUserData.phone,
        role: businessType === 'customer' ? 'customer' : 'owner',
        needToChangepassword: false,
        password: null,
        isEmailVerified: firebaseUserData.email_verified || false,
        firebaseProvider: firebaseUserData.firebaseProvider,
        lastLoginAt: new Date(),
      };

      this.logger.debug('Creando usuario en base de datos...');
      const userRegister =
        await this.userAuthService.createOfSocial(newUserData);

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

      // NUEVO: Usar el mismo mapeo que el registro tradicional
      const businessTypeMapping: Record<
        string,
        {
          role: RoleType;
          context: BusinessContext;
          needsCustomerRole: boolean;
        }
      > = {
        customer: {
          role: RoleType.CUSTOMER,
          context: BusinessContext.GENERAL,
          needsCustomerRole: false,
        },
        events: {
          role: RoleType.OWNER,
          context: BusinessContext.EVENTS,
          needsCustomerRole: true,
        },
        food: {
          role: RoleType.OWNER,
          context: BusinessContext.RESTAURANT,
          needsCustomerRole: true,
        },
        dinning: {
          role: RoleType.OWNER,
          context: BusinessContext.RESTAURANT,
          needsCustomerRole: true,
        },
        clothes: {
          role: RoleType.OWNER,
          context: BusinessContext.WARDROBE,
          needsCustomerRole: true,
        },
        retail: {
          role: RoleType.OWNER,
          context: BusinessContext.MARKETPLACE,
          needsCustomerRole: true,
        },
        grocery: {
          role: RoleType.OWNER,
          context: BusinessContext.MARKETPLACE,
          needsCustomerRole: true,
        },
        electronics: {
          role: RoleType.OWNER,
          context: BusinessContext.MARKETPLACE,
          needsCustomerRole: true,
        },
        accessories: {
          role: RoleType.OWNER,
          context: BusinessContext.MARKETPLACE,
          needsCustomerRole: true,
        },
        pharmacy: {
          role: RoleType.OWNER,
          context: BusinessContext.GENERAL,
          needsCustomerRole: true,
        },
        beauty: {
          role: RoleType.OWNER,
          context: BusinessContext.GENERAL,
          needsCustomerRole: true,
        },
        construction: {
          role: RoleType.OWNER,
          context: BusinessContext.GENERAL,
          needsCustomerRole: true,
        },
        automotive: {
          role: RoleType.OWNER,
          context: BusinessContext.GENERAL,
          needsCustomerRole: true,
        },
        pets: {
          role: RoleType.OWNER,
          context: BusinessContext.MARKETPLACE,
          needsCustomerRole: true,
        },
        water_distributor: {
          role: RoleType.OWNER,
          context: BusinessContext.MARKETPLACE,
          needsCustomerRole: true,
        },
        admin: {
          role: RoleType.ADMIN,
          context: BusinessContext.GENERAL,
          needsCustomerRole: false,
        },
        operador: {
          role: RoleType.OPERATOR,
          context: BusinessContext.GENERAL,
          needsCustomerRole: false,
        },
      };

      const mapping =
        businessTypeMapping[businessType] || businessTypeMapping['customer'];

      this.logger.log(
        `Registrando usuario social ${userRegister.email} con businessType: ${businessType} → ` +
          `rol: ${mapping.role}, contexto: ${mapping.context}`,
      );

      // Asignar rol principal
      try {
        await this.userRoleService.assignRole(
          userRegister.id,
          mapping.role,
          mapping.context,
          {
            grantedBy: 'system',
            metadata: {
              source: 'social-registration-v2',
              provider: firebaseUserData.firebaseProvider,
              businessType: businessType,
            },
          },
        );
        this.logger.log(
          `✅ Rol ${mapping.role} en ${mapping.context} asignado a usuario social`,
        );
      } catch (roleError) {
        this.logger.warn(
          `No se pudo asignar rol a usuario social: ${roleError instanceof Error ? roleError.message : String(roleError)}`,
        );
      }

      // Asignar CUSTOMER adicional si es comerciante
      if (mapping.needsCustomerRole) {
        try {
          await this.userRoleService.assignRole(
            userRegister.id,
            RoleType.CUSTOMER,
            BusinessContext.GENERAL,
            {
              grantedBy: 'system',
              metadata: { source: 'social-registration-dual-role' },
            },
          );
          this.logger.log(`✅ Rol dual CUSTOMER asignado a usuario social`);
        } catch (roleError) {
          this.logger.warn(
            `No se pudo asignar rol CUSTOMER: ${roleError instanceof Error ? roleError.message : String(roleError)}`,
          );
        }
      }

      return userRegister;
    } catch (error) {
      this.logger.error(
        `Error en registerUserSocial: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : String(error),
      );
      this.logger.logObject('Contexto del error', {
        firebaseEmail: firebaseUserData?.email,
        firebaseUid: firebaseUserData?.uid,
      });
      throw new HttpException(
        'Error al registrar usuario social: ' +
          (error instanceof Error ? error.message : String(error)),
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
      const userRegister = await this.userAuthService.createOfSocial(userData);
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
        `Error en registerSocialWithData: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : String(error),
      );
      this.logger.logObject('Contexto del error', {
        message: error instanceof Error ? error.message : String(error),
        stack:
          (error instanceof Error ? error.stack : String(error))?.substring(
            0,
            200,
          ) + '...',
        firebaseUid: firebaseUserData?.uid,
        socialDataKeys: Object.keys(socialData || {}),
      });
      throw new HttpException(
        'Error al registrar usuario con datos sociales: ' +
          (error instanceof Error ? error.message : String(error)),
        500,
      );
    }
  }
}
