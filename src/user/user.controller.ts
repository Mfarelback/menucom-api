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
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from 'src/auth/guards/jwt.auth.gards';
import { ChangePasswordDto } from './dto/password.dto';
import { GetUsersByRolesDto } from './dto/get-users-by-roles.dto';
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

  @Post('change-password')
  async changePassword(@Body() password: ChangePasswordDto) {
    return this.userService.changePasswordByUser(password);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('/update/:id')
  async update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    try {
      return await this.userService.update(id, updateUserDto);
    } catch (error) {
      throw new InternalServerErrorException('Failed to update user');
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('by-roles')
  @ApiOperation({
    summary: 'Obtener usuarios por roles',
    description:
      'Obtiene una lista de usuarios filtrados por roles y opcionalmente por vinculación con MercadoPago',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de usuarios obtenida exitosamente',
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor',
  })
  async getUsersByRoles(@Body() getUsersByRolesDto: GetUsersByRolesDto) {
    try {
      const { roles, withVinculedAccount = false } = getUsersByRolesDto;
      return await this.userService.getUsersByRoles(roles, withVinculedAccount);
    } catch (error) {
      throw new InternalServerErrorException('Failed to get users by roles');
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
