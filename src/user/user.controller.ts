import {
  Controller,
  Get,
  Body,
  Param,
  Delete,
  Req,
  UseGuards,
  Post,
  InternalServerErrorException,
  Patch,
} from '@nestjs/common';
import { UserService } from './user.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from 'src/auth/guards/jwt.auth.gards';
import { ChangePasswordDto } from './dto/password.dto';
// import { PasswordService } from '../services/password/password.service';
// import { RecoveryPasswordDto } from '../dto/recovery-pass';
// import { ChangePasswordDto } from '../dto/change-password';

@ApiTags('user')
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @UseGuards(JwtAuthGuard)
  @Get('/me')
  async getProfile(@Req() req: Request) {
    return this.userService.findOne(req['user']['userId']);
  }

  @Get('/user/:id')
  async getProfileUser(@Param('id') id: string) {
    return this.userService.findOne(id);
  }

  @Post('admin/:email')
  async getAdminUseremail(@Param('email') email: string) {
    return this.userService.getadminUser(email);
  }

  @Post('password')
  async recoveryPassword() {
    return '';
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  async changePassword(
    @Req() req: Request,
    @Body() password: ChangePasswordDto,
  ) {
    const user = req['user']['userId'];
    return this.userService.changePasswordByUser(user, password);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('/update/:id')
  async update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    try {
      return await this.userService.update(id, updateUserDto);
    } catch (error) {
      // Handle the error here
      console.error(error);
      throw new InternalServerErrorException('Failed to update user');
    }
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.userService.remove(+id);
  }

  @Delete()
  deleteall() {
    return this.userService.deleteAllusers();
  }
}
