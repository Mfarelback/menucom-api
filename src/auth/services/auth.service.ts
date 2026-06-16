import {
  HttpException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UserService } from '../../user/user.service';
import { UserAuthService } from '../../user/services/user-auth.service';
import { JwtService } from '@nestjs/jwt';
import { CreateUserDto } from '../../user/dto/create-user.dto';
import { LoggerService } from '../../core/logger/logger.service';
import { CloudinaryService } from '../../cloudinary/services/cloudinary.service';
import { UserRoleService } from './user-role.service';
import { CommerceService } from '../../commerce/services/commerce.service';
import {
  RoleType,
  BusinessContext,
  BUSINESS_TYPE_MAPPING,
} from '../models/permissions.model';
import { JwtPayload } from '../types/auth.types';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UserService,
    private userAuthService: UserAuthService,
    private jwtService: JwtService,
    private logger: LoggerService,
    private cloudinaryService: CloudinaryService,
    private userRoleService: UserRoleService,
    private commerceService: CommerceService,
  ) {
    this.logger.setContext('AuthService');
  }

  private buildVisualUsername(role: string, context?: string): string {
    return context ? `${role} | ${context}` : role;
  }

  private async resolveInitialCommerceId(
    userId: string,
  ): Promise<{ commerceId: string; commerceContext?: string } | undefined> {
    try {
      const commerces = await this.commerceService.getUserContexts(userId);
      if (commerces.length === 1) {
        return {
          commerceId: commerces[0].id,
          commerceContext: commerces[0].context,
        };
      }
      if (commerces.length === 0) {
        const user = await this.usersService.findOne(userId);
        if (!user) {
          this.logger.warn(
            `Usuario ${userId} no encontrado al resolver commerceId`,
          );
          return undefined;
        }

        const typeKey = user.role || 'customer';
        const mapping =
          BUSINESS_TYPE_MAPPING[typeKey] || BUSINESS_TYPE_MAPPING['customer'];

        try {
          const commerce = await this.commerceService.create(userId, {
            businessName:
              user.businessName ||
              user.name ||
              user.email?.split('@')[0] ||
              'Mi Negocio',
            slug: user.slug || `${typeKey}-${userId.substring(0, 8)}`,
            businessType: typeKey,
            context: mapping.context as BusinessContext,
          });

          this.logger.log(
            `Commerce auto-creado para usuario legacy ${userId}: ${commerce.id}`,
          );
          return { commerceId: commerce.id, commerceContext: commerce.context };
        } catch (createError) {
          this.logger.error(
            `Error creando commerce automático para usuario legacy ${userId}: ${createError instanceof Error ? createError.message : String(createError)}`,
          );
          return undefined;
        }
      }
      return undefined;
    } catch (error) {
      this.logger.error(
        `Error resolviendo commerceId inicial para usuario ${userId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return undefined;
    }
  }

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);
    if (user) {
      if (!user.password) {
        throw new UnauthorizedException(
          'Esta cuenta usa inicio de sesión social. Por favor, inicia sesión con Google.',
        );
      }
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
    const userId = user['user']['id'];
    const resolved = await this.resolveInitialCommerceId(userId);
    const legacyRole = user['user']['role'];
    const mapping =
      BUSINESS_TYPE_MAPPING[legacyRole] || BUSINESS_TYPE_MAPPING['customer'];

    const payload: JwtPayload = {
      sub: userId,
      username: this.buildVisualUsername(legacyRole, resolved?.commerceContext),
      role: mapping.role,
      ...(resolved?.commerceId && { commerceId: resolved.commerceId }),
    };

    const userLog = await this.usersService.findOne(payload.sub);
    return {
      access_token: this.jwtService.sign(payload),
      needToChangePassword: userLog.needToChangepassword,
      ...(resolved?.commerceId && { commerceId: resolved.commerceId }),
    };
  }

  async registerUser(userData: CreateUserDto, file?: Express.Multer.File) {
    try {
      // Si se proporciona un archivo, subirlo a Cloudinary y asignar URL
      if (file) {
        this.logger.debug('Subiendo foto de registro a Cloudinary...');
        try {
          const uploadedUrl = await this.cloudinaryService.uploadImage(file);
          if (typeof uploadedUrl === 'string') {
            userData = { ...userData, photoURL: uploadedUrl };
            this.logger.log(
              `Foto de registro subida exitosamente: ${uploadedUrl}`,
            );
          } else {
            this.logger.error(
              `Error al subir foto de registro: ${uploadedUrl}`,
            );
          }
        } catch (uploadError) {
          this.logger.error(
            `Error en uploadImage durante registro: ${uploadError instanceof Error ? uploadError.message : String(uploadError)}`,
          );
        }
      }

      const userRegister = await this.usersService.create(userData);

      const typeKey = userData.businessType || userData.role || 'customer';
      const mapping =
        BUSINESS_TYPE_MAPPING[typeKey] || BUSINESS_TYPE_MAPPING['customer'];

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

      let commerceId: string | undefined;

      if (mapping.role === RoleType.OWNER) {
        try {
          const slugBase = (userData.businessType || 'general').replace(
            /[^a-zA-Z0-9]/g,
            '-',
          );
          const commerce = await this.commerceService.create(userRegister.id, {
            businessName:
              userRegister.name ||
              userRegister.email?.split('@')[0] ||
              'Mi Negocio',
            slug: `${slugBase}-${userRegister.id.substring(0, 8)}`,
            businessType: userData.businessType || 'general',
            context: mapping.context as BusinessContext,
          });
          commerceId = commerce.id;
          this.logger.log(
            `✅ Commerce creado con ID: ${commerce.id} para usuario ${userRegister.id}`,
          );
        } catch (commerceError) {
          this.logger.warn(
            `No se pudo crear Commerce para ${userRegister.id}: ${commerceError instanceof Error ? commerceError.message : String(commerceError)}`,
          );
        }
      }

      const tokenPayload: JwtPayload = {
        sub: userRegister.id,
        username: this.buildVisualUsername(userRegister.role, mapping.context),
        role: mapping.role,
        ...(commerceId && { commerceId }),
      };

      return {
        access_token: this.jwtService.sign(tokenPayload),
        needToChangePassword: userRegister.needToChangepassword,
        ...(commerceId && { commerceId }),
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
      const resolved = await this.resolveInitialCommerceId(user.id);
      const legacyRole = user.role;
      const mapping =
        BUSINESS_TYPE_MAPPING[legacyRole] || BUSINESS_TYPE_MAPPING['customer'];
      const jwtPayload: JwtPayload = {
        sub: user.id,
        username: this.buildVisualUsername(
          legacyRole,
          resolved?.commerceContext,
        ),
        role: mapping.role,
        ...(resolved?.commerceId && { commerceId: resolved.commerceId }),
      };

      const jwtToken = this.jwtService.sign(jwtPayload);
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
   * Cambia el contexto de comercio activo del usuario
   * Valida que el usuario tenga acceso al comercio y genera un nuevo JWT
   */
  async switchContext(userId: string, commerceId: string) {
    this.logger.debug(
      `Switch context: usuario ${userId} → comercio ${commerceId}`,
    );

    const hasAccess = await this.userRoleService.hasAccessToCommerce(
      userId,
      commerceId,
    );
    if (!hasAccess) {
      throw new ForbiddenException('No tienes acceso a este comercio');
    }

    const commerce = await this.commerceService.findById(commerceId);
    if (!commerce.isActive) {
      throw new ForbiddenException('Este comercio está desactivado');
    }

    const user = await this.usersService.findOne(userId);
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    const legacyRole = user.role;
    const mapping =
      BUSINESS_TYPE_MAPPING[legacyRole] || BUSINESS_TYPE_MAPPING['customer'];
    const payload: JwtPayload = {
      sub: userId,
      username: this.buildVisualUsername(legacyRole, commerce.context),
      role: mapping.role,
      commerceId,
    };

    const contexts = await this.commerceService.getUserContexts(userId);

    return {
      access_token: this.jwtService.sign(payload),
      commerceId,
      context: commerce.context,
      availableContexts: contexts.map((c) => ({
        id: c.id,
        businessName: c.businessName,
        slug: c.slug,
        context: c.context,
        businessType: c.businessType,
      })),
    };
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

    const resolved = await this.resolveInitialCommerceId(user.id);
    const legacyRole = user.role;
    const mapping =
      BUSINESS_TYPE_MAPPING[legacyRole] || BUSINESS_TYPE_MAPPING['customer'];

    const payload: JwtPayload = {
      sub: user.id,
      username: this.buildVisualUsername(legacyRole, resolved?.commerceContext),
      role: mapping.role,
      ...(resolved?.commerceId && { commerceId: resolved.commerceId }),
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
      ...(resolved?.commerceId && { commerceId: resolved.commerceId }),
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

      const mapping =
        BUSINESS_TYPE_MAPPING[businessType] ||
        BUSINESS_TYPE_MAPPING['customer'];

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

      // Crear Commerce si es OWNER (misma lógica que registerUser)
      if (mapping.role === RoleType.OWNER) {
        try {
          const slugBase = (businessType || 'general').replace(
            /[^a-zA-Z0-9]/g,
            '-',
          );
          await this.commerceService.create(userRegister.id, {
            businessName:
              userRegister.name ||
              userRegister.email?.split('@')[0] ||
              'Mi Negocio',
            slug: `${slugBase}-${userRegister.id.substring(0, 8)}`,
            businessType: businessType || 'general',
            context: mapping.context as BusinessContext,
          });
        } catch (commerceError) {
          this.logger.warn(
            `No se pudo crear Commerce para usuario social ${userRegister.id}: ${commerceError instanceof Error ? commerceError.message : String(commerceError)}`,
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
        ...socialData,
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
      this.logger.log('Usuario registrado, asignando roles...');

      const typeKey = userData.businessType || userData.role || 'customer';
      const mapping =
        BUSINESS_TYPE_MAPPING[typeKey] || BUSINESS_TYPE_MAPPING['customer'];

      // Asignar rol principal
      try {
        await this.userRoleService.assignRole(
          userRegister.id,
          mapping.role,
          mapping.context,
          {
            grantedBy: 'system',
            metadata: {
              source: 'social-registration-with-data',
              provider: firebaseUserData.firebaseProvider,
              businessType: typeKey,
            },
          },
        );
        this.logger.log(
          `✅ Rol ${mapping.role} en ${mapping.context} asignado a ${userRegister.email}`,
        );
      } catch (roleError) {
        this.logger.warn(
          `No se pudo asignar rol: ${roleError instanceof Error ? roleError.message : String(roleError)}`,
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
          this.logger.log(`✅ Rol dual CUSTOMER asignado`);
        } catch (roleError) {
          this.logger.warn(
            `No se pudo asignar rol CUSTOMER: ${roleError instanceof Error ? roleError.message : String(roleError)}`,
          );
        }
      }

      // Crear Commerce si es OWNER
      let commerceId: string | undefined;
      if (mapping.role === RoleType.OWNER) {
        try {
          const slugBase = (typeKey || 'general').replace(/[^a-zA-Z0-9]/g, '-');
          const commerce = await this.commerceService.create(userRegister.id, {
            businessName:
              userRegister.name ||
              userRegister.email?.split('@')[0] ||
              'Mi Negocio',
            slug: `${slugBase}-${userRegister.id.substring(0, 8)}`,
            businessType: typeKey || 'general',
            context: mapping.context as BusinessContext,
          });
          commerceId = commerce.id;
          this.logger.log(`✅ Commerce creado con ID: ${commerce.id}`);
        } catch (commerceError) {
          this.logger.warn(
            `No se pudo crear Commerce: ${commerceError instanceof Error ? commerceError.message : String(commerceError)}`,
          );
        }
      }

      const payload: JwtPayload = {
        username: this.buildVisualUsername(userRegister.role, mapping.context),
        sub: userRegister.id,
        role: mapping.role,
        ...(commerceId && { commerceId }),
      };

      const response = {
        access_token: this.jwtService.sign(payload),
        needToChangePassword: userRegister.needToChangepassword || false,
        user: userRegister,
        ...(commerceId && { commerceId }),
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
