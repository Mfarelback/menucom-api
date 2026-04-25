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
  Query,
} from '@nestjs/common';
import { UserService } from './user.service';
import { UserProfileService } from './services/user-profile.service';
import { UserRecoveryService } from './services/user-recovery.service';
import { UserQueryService } from './services/user-query.service';
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
import { UpdateFcmTokenDto } from './dto/update-fcm-token.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { QueryUsersAdminDto } from './dto/query-users-admin.dto';
import { PermissionsGuard } from 'src/auth/guards/permissions.guard';
import { RequireContextPermissions } from 'src/auth/decorators/permissions.decorator';
import { Permission, BusinessContext } from 'src/auth/models/permissions.model';
import { Public } from 'src/auth/decorators/public.decorator';

@ApiTags('user')
@Controller('user')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly userProfileService: UserProfileService,
    private readonly userRecoveryService: UserRecoveryService,
    private readonly userQueryService: UserQueryService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('/me')
  async getProfile(@Req() req: Request) {
    return this.userService.findOne(req['user']['userId']);
  }

  @Public()
  @Get('/user/:id')
  async getProfileUser(@Param('id') id: string) {
    return this.userService.findOne(id);
  }

  @Public()
  @Post('admin/:email')
  async getAdminUseremail(@Param('email') email: string) {
    return this.userService.getadminUser(email);
  }

  @Public()
  @Post('change-password')
  async changePassword(@Body() password: ChangePasswordDto) {
    return this.userRecoveryService.changePasswordByUser(password);
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
      return await this.userProfileService.update(id, updateUserDto, photo);
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
      return await this.userQueryService.getUsersByRoles(
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

  @UseGuards(JwtAuthGuard)
  @Patch('/fcm-token')
  @ApiOperation({
    summary: 'Actualizar el token FCM del usuario',
    description:
      'Actualiza el token de Firebase Cloud Messaging (FCM) para el usuario autenticado.',
  })
  @ApiResponse({
    status: 200,
    description: 'Token FCM actualizado exitosamente.',
  })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado.' })
  @ApiResponse({ status: 500, description: 'Error interno del servidor.' })
  async updateFcmToken(
    @Req() req: Request,
    @Body() updateFcmTokenDto: UpdateFcmTokenDto,
  ) {
    try {
      const userId = req['user']['userId'];
      const { fcmToken } = updateFcmTokenDto;
      return await this.userProfileService.updateFcmToken(userId, fcmToken);
    } catch (error) {
      throw new InternalServerErrorException('Failed to update FCM token');
    }
  }

  @Get('admin/all')
  @RequireContextPermissions(BusinessContext.GENERAL, Permission.MANAGE_USERS)
  @ApiOperation({
    summary: 'Obtener todos los usuarios (admin)',
    description:
      'Lista todos los usuarios del sistema con filtros avanzados, búsqueda, paginación y ordenamiento. Requiere permiso MANAGE_USERS.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de usuarios obtenida exitosamente',
  })
  @ApiResponse({
    status: 403,
    description: 'No tienes permisos para acceder a este recurso',
  })
  async getAllUsersAdmin(@Query() query: QueryUsersAdminDto) {
    try {
      return await this.userService.queryAdmin(query);
    } catch (error) {
      throw new InternalServerErrorException('Failed to get users: ' + error.message);
    }
  }

  @Get('admin/count')
  @RequireContextPermissions(BusinessContext.GENERAL, Permission.MANAGE_USERS)
  @ApiOperation({
    summary: 'Contar usuarios (admin)',
    description:
      'Retorna el total de usuarios en el sistema con opciones de filtro. Requiere permiso MANAGE_USERS.',
  })
  @ApiResponse({
    status: 200,
    description: 'Conteo de usuarios',
  })
  async countUsersAdmin(
    @Query('plan') plan?: string,
    @Query('withActiveMembership') withActiveMembership?: boolean,
    @Query('withVinculedAccount') withVinculedAccount?: boolean,
  ) {
    const filters = {
      plan,
      withActiveMembership: withActiveMembership === true,
      withVinculedAccount: withVinculedAccount === true,
    };
    return await this.userService.countAdmin(filters);
  }

  @Delete('admin/:id')
  @RequireContextPermissions(BusinessContext.GENERAL, Permission.MANAGE_USERS)
  @ApiOperation({
    summary: 'Eliminar usuario (admin)',
    description:
      'Elimina un usuario del sistema permanentemente. Requiere permiso MANAGE_USERS.',
  })
  @ApiResponse({
    status: 200,
    description: 'Usuario eliminado exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Usuario no encontrado',
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor',
  })
  async deleteUserAdmin(@Param('id') id: string) {
    return await this.userService.remove(id);
  }

  @Patch('admin/:id')
  @RequireContextPermissions(BusinessContext.GENERAL, Permission.MANAGE_USERS)
  @UseInterceptors(FileInterceptor('photo'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'User update data with optional photo file upload (admin)',
    type: UpdateUserWithFileDto,
  })
  @ApiOperation({
    summary: 'Actualizar usuario (admin)',
    description:
      'Actualiza la información de un usuario desde la vista de administrador. Permite subir una foto que reemplazará la actual. Requiere permiso MANAGE_USERS.',
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
  async updateUserAdmin(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @UploadedFile() photo?: Express.Multer.File,
  ) {
    try {
      return await this.userProfileService.update(id, updateUserDto, photo);
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to update user: ' + error.message,
      );
    }
  }
}
