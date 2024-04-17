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
  ) { }

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
    let neededCommerce = true;
    const payload = {
      username: user['user']['role'],
      sub: user['user']['id'],
    };
    return {
      access_token: this.jwtService.sign(payload),
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
      };
    } catch (error) {
      throw new HttpException(error.message, error.status);
    }
  }

  async registerClient(userData: CreateUserDto, ownerId: string) {
    try {
      const userClientCreated = await this.usersService.create(userData);


    } catch (error) {
      throw new HttpException(error.message, error.status);
    }
  }

  async loginSocial(userData: CreateUserDto) {
    return this.usersService
      .findOne(userData.id)
      .then((user) => {
        if (user) {
          const payload = { username: user.role, sub: user.id };
          return {
            access_token: this.jwtService.sign(payload),
          };
        } else {
          return this.registerUserSocial(userData);
        }
      })
      .catch((err) => {
        if (err.status === 404) {
          return this.registerUserSocial(userData);
        }
        console.log('coltala', err.status);
      });
  }

  async registerUserSocial(userData: CreateUserDto) {
    const userRegister = await this.usersService.createOfSocial(userData);
    const payload = { username: userRegister.role, sub: userRegister.id };

    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}
