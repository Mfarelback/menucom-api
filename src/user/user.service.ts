import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';

import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { ChangePasswordDto } from './dto/password.dto';
import { RecoveryPassword } from './entities/recovery-password.entity';
import { UrlTransformService } from 'src/image-proxy/services/url-transform.service';
import { CloudinaryService } from 'src/cloudinary/services/cloudinary.service';
import { MenuService } from 'src/menu/services/menu.service';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(RecoveryPassword)
    private restoreRepo: Repository<RecoveryPassword>,
    private readonly urlTransformService: UrlTransformService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly menuService: MenuService,
  ) {}

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
          "createAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "updateAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
      if (data.role == 'client') {
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

  async createOfSocial(data: any) {
    console.log('🆕 [USER SERVICE] Iniciando creación de usuario social');
    console.log('📋 [USER SERVICE] Datos recibidos para createOfSocial:', {
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

      console.log(
        '🔍 [USER SERVICE] Verificando si existe usuario con email:',
        data.email,
      );
      // Verificar si ya existe un usuario con el mismo email
      const existingUser = await this.userRepo.findOne({
        where: { email: newUser.email },
      });

      if (existingUser) {
        console.log(
          '👤 [USER SERVICE] Usuario existente encontrado:',
          existingUser.id,
        );
        // Si existe pero no tiene socialToken, actualizar
        if (!existingUser.socialToken) {
          console.log(
            '🔄 [USER SERVICE] Actualizando usuario existente con datos sociales',
          );
          existingUser.socialToken = data.socialToken;
          existingUser.firebaseProvider = data.firebaseProvider;
          existingUser.isEmailVerified = data.isEmailVerified || false;
          existingUser.lastLoginAt = new Date();
          const updated = await this.userRepo.save(existingUser);
          console.log(
            '✅ [USER SERVICE] Usuario existente actualizado con datos sociales',
          );
          return updated;
        } else {
          console.log(
            'ℹ️ [USER SERVICE] Usuario ya tiene socialToken, retornando existente',
          );
          // Si ya tiene socialToken, retornar el existente
          return existingUser;
        }
      }

      console.log(
        '💾 [USER SERVICE] Creando nuevo usuario social en base de datos...',
      );
      // Si no existe, crear nuevo
      const savedUser = await this.userRepo.save(newUser);
      console.log(
        '✅ [USER SERVICE] Nuevo usuario social creado exitosamente:',
        {
          id: savedUser.id,
          email: savedUser.email,
          role: savedUser.role,
        },
      );

      // Verificación crítica final
      if (!savedUser) {
        console.error(
          '❌ [USER SERVICE] CRÍTICO: savedUser es null después de save',
        );
        throw new HttpException(
          'Error crítico: no se pudo guardar el usuario en la base de datos',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      return savedUser;
    } catch (error) {
      console.error('❌ [USER SERVICE] Error en createOfSocial:', {
        message: error.message,
        stack: error.stack?.substring(0, 200) + '...',
        userData: {
          email: data?.email,
          socialToken: data?.socialToken,
        },
      });
      throw new HttpException(
        'Error al crear usuario social: ' + error.message,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
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
    console.log('🔍 [USER SERVICE] Buscando usuario por email:', email);
    const user = await this.userRepo.findOne({ where: { email: email } });
    console.log(
      user
        ? `✅ [USER SERVICE] Usuario encontrado por email: ${user.id}`
        : '❌ [USER SERVICE] Usuario no encontrado por email',
    );
    return user;
  }

  /**
   * Busca un usuario por su token social (Firebase UID)
   * @param socialToken - UID de Firebase
   * @returns Usuario encontrado o null
   */
  async findBySocialToken(socialToken: string): Promise<User | null> {
    console.log(
      '🔍 [USER SERVICE] Buscando usuario por socialToken:',
      socialToken,
    );
    try {
      const user = await this.userRepo.findOne({ where: { socialToken } });
      console.log(
        user
          ? `✅ [USER SERVICE] Usuario encontrado por socialToken: ${user.id} (${user.email})`
          : '❌ [USER SERVICE] Usuario no encontrado por socialToken',
      );
      return user;
    } catch (error) {
      console.error(
        '❌ [USER SERVICE] Error buscando usuario por socialToken:',
        {
          message: error.message,
          socialToken,
        },
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
    console.log(
      '🔄 [USER SERVICE] Actualizando socialToken para usuario:',
      userId,
    );
    try {
      const user = await this.userRepo.findOne({ where: { id: userId } });
      if (!user) {
        console.error(
          `❌ [USER SERVICE] Usuario #${userId} no encontrado para actualizar socialToken`,
        );
        throw new NotFoundException(`Usuario #${userId} no encontrado`);
      }

      user.socialToken = socialToken;
      const updatedUser = await this.userRepo.save(user);
      console.log(
        `✅ [USER SERVICE] SocialToken actualizado exitosamente para usuario: ${user.email}`,
      );
      return updatedUser;
    } catch (error) {
      console.error('❌ [USER SERVICE] Error actualizando socialToken:', {
        message: error.message,
        userId,
        socialToken,
      });
      throw new HttpException(
        'Error al actualizar token social: ' + error.message,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

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
      console.log('📸 [USER SERVICE] Subiendo nueva foto de usuario...');
      try {
        const uploadedUrl = await this.cloudinaryService.uploadImage(photoFile);
        if (typeof uploadedUrl === 'string') {
          changes = { ...changes, photoURL: uploadedUrl };
          console.log(
            '✅ [USER SERVICE] Foto subida exitosamente:',
            uploadedUrl,
          );
        } else {
          console.error(
            '❌ [USER SERVICE] Error al subir imagen:',
            uploadedUrl,
          );
          throw new HttpException(
            'Error al subir la imagen',
            HttpStatus.BAD_REQUEST,
          );
        }
      } catch (error) {
        console.error('❌ [USER SERVICE] Error en uploadImage:', error);
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

  remove(id: number) {
    return this.userRepo.delete(id);
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
              await this.changePasswod(userFind, newPassword);
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
        console.log('Removido');
        this.sendVerificationCode(userFind);
      }
      return [];
    } catch (error) {
      throw error;
    }
  }

  async changePasswod(user: User, pass: ChangePasswordDto) {
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

  async sendVerificationCode(userDestine: User) {
    try {
      const codeVerification = this.generateRandomFourDigitNumber();

      const newCodeVerification = new RecoveryPassword();
      newCodeVerification.id = uuidv4();
      newCodeVerification.userId = userDestine.id;
      newCodeVerification.codeValidation = codeVerification;

      const codeCreated = this.restoreRepo.create(newCodeVerification);
      await this.restoreRepo.save(codeCreated);
      console.log(codeCreated.codeValidation);
      return [];
    } catch (error) {
      console.log(error);
      throw new ServiceUnavailableException('Error al enviar código');
    }
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
        return this.urlTransformService.transformDataUrls(userWithoutPassword);
      });

      // Si se solicitan menús, agregarlos a cada usuario
      if (includeMenus) {
        const usersWithMenus = await Promise.all(
          usersWithoutPassword.map(async (user) => {
            const menus = await this.menuService.getMenusWithItemsByUserId(
              user.id,
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
      console.error('❌ [USER SERVICE] Error en getUsersByRoles:', {
        message: error.message,
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

  generateRandomFourDigitNumber(): number {
    const min = 1000; // El valor mínimo (1000) para asegurar 4 dígitos
    const max = 9999; // El valor máximo (9999) para 4 dígitos

    // Genera un número aleatorio entre min y max (ambos incluidos)
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}
