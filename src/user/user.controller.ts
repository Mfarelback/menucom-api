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
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { UserService } from './user.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserWithFileDto } from './dto/update-user-with-file.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from 'src/auth/guards/jwt.auth.gards';
import { ChangePasswordDto } from './dto/password.dto';
import { GetUsersByRolesDto } from './dto/get-users-by-roles.dto';
import { FileInterceptor } from '@nestjs/platform-express';
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
  @UseInterceptors(FileInterceptor('photo'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'User update data with optional photo file upload',
    type: UpdateUserWithFileDto,
  })
  @ApiOperation({
    summary: 'Actualizar información de usuario',
    description:
      'Actualiza la información del usuario. Si se proporciona un archivo en el campo "photo", se subirá automáticamente y reemplazará la foto actual. No permite modificar la contraseña, usar el endpoint /change-password para eso.',
  })
  @ApiResponse({
    status: 200,
    description: 'Usuario actualizado exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Usuario no encontrado',
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor',
  })
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @UploadedFile() photo?: Express.Multer.File,
  ) {
    try {
      return await this.userService.update(id, updateUserDto, photo);
    } catch (error) {
      throw new InternalServerErrorException('Failed to update user');
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('by-roles')
  @ApiOperation({
    summary: 'Obtener usuarios por roles',
    description:
      'Obtiene una lista de usuarios filtrados por roles y opcionalmente por vinculación con MercadoPago. También puede incluir menús y sus items.',
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
      const {
        roles,
        withVinculedAccount = false,
        includeMenus = false,
      } = getUsersByRolesDto;
      return await this.userService.getUsersByRoles(
        roles,
        withVinculedAccount,
        includeMenus,
      );
    } catch (error) {
      throw new InternalServerErrorException('Failed to get users by roles');
    }
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.userService.remove(id);
  }

  @Delete()
  deleteall() {
    return this.userService.deleteAllusers();
  }
}
