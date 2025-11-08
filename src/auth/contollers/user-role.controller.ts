import {
  Controller,
  Post,
  Delete,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt.auth.gards';
import { PermissionsGuard } from '../guards/permissions.guard';
import { RequirePermissions } from '../decorators/permissions.decorator';
import { Permission, BusinessContext } from '../models/permissions.model';
import { UserRoleService } from '../services/user-role.service';
import { AssignRoleDto } from '../dto/assign-role.dto';
import { RevokeRoleDto } from '../dto/revoke-role.dto';
import { UpdateRoleDto } from '../dto/update-role.dto';
import { QueryUserRolesDto } from '../dto/query-user-roles.dto';

@ApiTags('User Roles Management')
@Controller('user-roles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UserRoleController {
  constructor(private readonly userRoleService: UserRoleService) {}

  @Post('assign')
  @RequirePermissions(Permission.MANAGE_USERS, BusinessContext.GENERAL)
  @ApiOperation({
    summary: 'Asignar un rol a un usuario',
    description:
      'Asigna un rol específico a un usuario en un contexto de negocio. Solo usuarios con permiso MANAGE_USERS pueden asignar roles.',
  })
  @ApiResponse({
    status: 201,
    description: 'Rol asignado exitosamente',
  })
  @ApiResponse({
    status: 409,
    description: 'El usuario ya tiene este rol en este contexto',
  })
  @ApiResponse({
    status: 403,
    description: 'No tienes permisos para asignar roles',
  })
  async assignRole(@Body() assignRoleDto: AssignRoleDto, @Request() req) {
    const grantedBy = req.user.userId;

    const userRole = await this.userRoleService.assignRole(
      assignRoleDto.userId,
      assignRoleDto.role,
      assignRoleDto.context,
      {
        resourceId: assignRoleDto.resourceId,
        grantedBy,
        expiresAt: assignRoleDto.expiresAt
          ? new Date(assignRoleDto.expiresAt)
          : undefined,
        metadata: assignRoleDto.metadata,
      },
    );

    return {
      message: 'Rol asignado exitosamente',
      data: userRole,
    };
  }

  @Delete('revoke')
  @RequirePermissions(Permission.MANAGE_USERS, BusinessContext.GENERAL)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Revocar un rol de un usuario',
    description:
      'Elimina permanentemente un rol de un usuario. Solo usuarios con permiso MANAGE_USERS pueden revocar roles.',
  })
  @ApiResponse({
    status: 200,
    description: 'Rol revocado exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Rol no encontrado',
  })
  @ApiResponse({
    status: 403,
    description: 'No tienes permisos para revocar roles',
  })
  async revokeRole(@Body() revokeRoleDto: RevokeRoleDto) {
    await this.userRoleService.revokeRole(
      revokeRoleDto.userId,
      revokeRoleDto.role,
      revokeRoleDto.context,
      revokeRoleDto.resourceId,
    );

    return {
      message: 'Rol revocado exitosamente',
    };
  }

  @Patch(':roleId')
  @RequirePermissions(Permission.MANAGE_USERS, BusinessContext.GENERAL)
  @ApiOperation({
    summary: 'Actualizar un rol existente',
    description:
      'Actualiza propiedades de un rol como estado activo, fecha de expiración o metadata.',
  })
  @ApiParam({
    name: 'roleId',
    description: 'ID del rol a actualizar',
    example: 'role-uuid-789',
  })
  @ApiResponse({
    status: 200,
    description: 'Rol actualizado exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Rol no encontrado',
  })
  async updateRole(
    @Param('roleId') roleId: string,
    @Body() updateRoleDto: UpdateRoleDto,
  ) {
    const updatedRole = await this.userRoleService.updateRole(
      roleId,
      updateRoleDto,
    );

    return {
      message: 'Rol actualizado exitosamente',
      data: updatedRole,
    };
  }

  @Get('user/:userId')
  @RequirePermissions(Permission.MANAGE_USERS, BusinessContext.GENERAL)
  @ApiOperation({
    summary: 'Obtener todos los roles de un usuario',
    description:
      'Lista todos los roles activos de un usuario, con opción de filtrar por contexto.',
  })
  @ApiParam({
    name: 'userId',
    description: 'ID del usuario',
    example: 'user-uuid-123',
  })
  @ApiResponse({
    status: 200,
    description: 'Roles del usuario obtenidos exitosamente',
  })
  async getUserRoles(
    @Param('userId') userId: string,
    @Query() query: QueryUserRolesDto,
  ) {
    let roles;

    if (query.context) {
      roles = await this.userRoleService.getUserRolesByContext(
        userId,
        query.context,
      );
    } else {
      roles = await this.userRoleService.getUserRoles(userId);
    }

    return {
      message: 'Roles obtenidos exitosamente',
      data: roles,
    };
  }

  @Get('user/:userId/permissions/:context')
  @RequirePermissions(Permission.MANAGE_USERS, BusinessContext.GENERAL)
  @ApiOperation({
    summary: 'Obtener permisos de un usuario en un contexto',
    description:
      'Lista todos los permisos que tiene un usuario en un contexto de negocio específico.',
  })
  @ApiParam({
    name: 'userId',
    description: 'ID del usuario',
    example: 'user-uuid-123',
  })
  @ApiParam({
    name: 'context',
    description: 'Contexto de negocio',
    enum: ['restaurant', 'wardrobe', 'marketplace', 'general'],
    example: 'restaurant',
  })
  @ApiResponse({
    status: 200,
    description: 'Permisos obtenidos exitosamente',
  })
  async getUserPermissions(
    @Param('userId') userId: string,
    @Param('context') context: string,
  ) {
    const permissions = await this.userRoleService.getUserPermissions(
      userId,
      context as any,
    );

    return {
      message: 'Permisos obtenidos exitosamente',
      data: {
        userId,
        context,
        permissions,
      },
    };
  }

  @Get('my-roles')
  @ApiOperation({
    summary: 'Obtener mis roles (usuario autenticado)',
    description: 'Obtiene todos los roles del usuario actualmente autenticado.',
  })
  @ApiResponse({
    status: 200,
    description: 'Roles obtenidos exitosamente',
  })
  async getMyRoles(@Request() req, @Query() query: QueryUserRolesDto) {
    const userId = req.user.userId;

    let roles;
    if (query.context) {
      roles = await this.userRoleService.getUserRolesByContext(
        userId,
        query.context,
      );
    } else {
      roles = await this.userRoleService.getUserRoles(userId);
    }

    return {
      message: 'Roles obtenidos exitosamente',
      data: roles,
    };
  }

  @Get('my-permissions/:context')
  @ApiOperation({
    summary: 'Obtener mis permisos en un contexto',
    description:
      'Obtiene todos los permisos del usuario autenticado en un contexto específico.',
  })
  @ApiParam({
    name: 'context',
    description: 'Contexto de negocio',
    enum: ['restaurant', 'wardrobe', 'marketplace', 'general'],
    example: 'restaurant',
  })
  @ApiResponse({
    status: 200,
    description: 'Permisos obtenidos exitosamente',
  })
  async getMyPermissions(@Request() req, @Param('context') context: string) {
    const userId = req.user.userId;
    const permissions = await this.userRoleService.getUserPermissions(
      userId,
      context as any,
    );

    return {
      message: 'Permisos obtenidos exitosamente',
      data: {
        userId,
        context,
        permissions,
      },
    };
  }
}
