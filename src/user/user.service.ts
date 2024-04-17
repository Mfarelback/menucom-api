import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateUserDto, UpdateUserDto } from './dto/create-user.dto';
import { User } from './entities/user.entity';

import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class UserService {
  constructor(@InjectRepository(User) private userRepo: Repository<User>) {}

  async create(data: CreateUserDto) {
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
    return result;
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
}
