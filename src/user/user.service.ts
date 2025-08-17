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
import { CreateUserDto, UpdateUserDto } from './dto/create-user.dto';
import { User } from './entities/user.entity';

import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { ChangePasswordDto } from './dto/password.dto';
import { RecoveryPassword } from './entities/recovery-password.entity';
import { UrlTransformService } from 'src/image-proxy/services/url-transform.service';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(RecoveryPassword)
    private restoreRepo: Repository<RecoveryPassword>,
    private readonly urlTransformService: UrlTransformService,
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

  async createOfSocial(data: CreateUserDto) {
    const newUser = this.userRepo.create(data);
    console.log(newUser);

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
    return await this.userRepo.findOne({ where: { email: email } });
  }

  async update(id: string, changes: UpdateUserDto) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User #${id} not found`);
    }
    if (changes.password) {
      const updatedChanges = { ...changes, password: user.password };
      this.userRepo.merge(user, updatedChanges);
    } else {
      this.userRepo.merge(user, changes);
    }
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

  generateRandomFourDigitNumber(): number {
    const min = 1000; // El valor mínimo (1000) para asegurar 4 dígitos
    const max = 9999; // El valor máximo (9999) para 4 dígitos

    // Genera un número aleatorio entre min y max (ambos incluidos)
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}
