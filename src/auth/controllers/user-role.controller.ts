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
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt.auth.gards';
import { PermissionsGuard } from '../guards/permissions.guard';
import { DisablePermissions } from '../decorators/permissions.decorator';
import { UserRoleService } from '../services/user-role.service';
import { AssignRoleDto } from '../dto/assign-role.dto';
import { RevokeRoleDto } from '../dto/revoke-role.dto';
import { UpdateRoleDto } from '../dto/update-role.dto';
import { QueryUserRolesDto } from '../dto/query-user-roles.dto';
import { UserService } from '../../user/user.service';

@ApiTags('User Roles Management')
@Controller('user-roles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UserRoleController {
  constructor(
    private readonly userRoleService: UserRoleService,
    private readonly userService: UserService,
  ) {}

  @Post('assign')
  @DisablePermissions()
  @ApiOperation({
    summary: 'Asignar un rol a un usuario',
    description:
      'Asigna un rol a un usuario en un contexto de negocio. ADMIN puede asignar cualquier rol. OWNER puede asignar MANAGER/OPERATOR a su propio comercio.',
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
    await this.userRoleService.authorizeTeamManagement(
      req.user.userId,
      assignRoleDto.role,
      assignRoleDto.context,
      assignRoleDto.resourceId,
    );

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
  @DisablePermissions()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Revocar un rol de un usuario',
    description:
      'Revoca un rol de un usuario. ADMIN puede revocar cualquier rol. OWNER puede revocar roles de su propio comercio.',
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
  async revokeRole(@Body() revokeRoleDto: RevokeRoleDto, @Request() req) {
    await this.userRoleService.authorizeTeamManagement(
      req.user.userId,
      revokeRoleDto.role,
      revokeRoleDto.context,
      revokeRoleDto.resourceId,
      revokeRoleDto.userId,
    );

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
  @DisablePermissions()
  @ApiOperation({
    summary: 'Actualizar un rol existente',
    description:
      'Actualiza propiedades de un rol como estado activo, fecha de expiración o metadata. ADMIN puede actualizar cualquier rol. OWNER puede actualizar roles de su comercio.',
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
    @Request() req,
  ) {
    const existingRole = await this.userRoleService.findRoleById(roleId);

    await this.userRoleService.authorizeTeamManagement(
      req.user.userId,
      existingRole.role,
      existingRole.context,
      existingRole.resourceId,
      existingRole.userId,
    );

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
  @DisablePermissions()
  @ApiOperation({
    summary: 'Obtener todos los roles de un usuario',
    description:
      'Lista todos los roles activos de un usuario, con opción de filtrar por contexto y/o recurso específico (commerceId).',
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
    const roles = await this.userRoleService.getUserRolesFiltered(userId, {
      context: query.context,
      resourceId: query.resourceId,
    });

    return {
      message: 'Roles obtenidos exitosamente',
      data: roles,
    };
  }

  @Get('user/:userId/permissions/:context')
  @DisablePermissions()
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

  @Get('find-user')
  @DisablePermissions()
  @ApiOperation({
    summary: 'Buscar un usuario por email',
    description:
      'Busca un usuario por su email y retorna su ID, nombre y email. Útil para resolver emails a userId antes de asignar roles.',
  })
  @ApiQuery({
    name: 'email',
    description: 'Email del usuario a buscar',
    example: 'usuario@ejemplo.com',
  })
  @ApiResponse({
    status: 200,
    description: 'Usuario encontrado',
  })
  @ApiResponse({
    status: 404,
    description: 'Usuario no encontrado',
  })
  async findUserByEmail(@Query('email') email: string) {
    if (!email) {
      throw new BadRequestException('El parámetro email es requerido');
    }

    const user = await this.userService.findByEmail(email);
    if (!user) {
      throw new NotFoundException(
        `No se encontró ningún usuario con el email ${email}`,
      );
    }

    return {
      message: 'Usuario encontrado',
      data: {
        userId: user.id,
        name: user.name,
        email: user.email,
      },
    };
  }

  @Get('my-team')
  @DisablePermissions()
  @ApiOperation({
    summary: 'Obtener equipo del comercio actual',
    description:
      'Lista todos los usuarios con roles activos en el comercio del contexto actual. Incluye nombre, email y roles de cada usuario.',
  })
  @ApiResponse({
    status: 200,
    description: 'Equipo obtenido exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'No hay contexto de comercio activo',
  })
  @ApiResponse({
    status: 403,
    description: 'No tienes acceso a este comercio',
  })
  async getMyTeam(@Request() req) {
    const commerceId = req.user.commerceId || req.tenantId;

    if (!commerceId) {
      throw new BadRequestException(
        'No hay un contexto de comercio activo. Asegúrate de tener un commerceId en tu sesión.',
      );
    }

    const hasAccess = await this.userRoleService.hasAccessToCommerce(
      req.user.userId,
      commerceId,
    );

    if (!hasAccess) {
      throw new ForbiddenException('No tienes acceso a este comercio');
    }

    const roles = await this.userRoleService.getTeamByCommerce(commerceId);

    const usersMap = new Map<
      string,
      {
        userId: string;
        name: string;
        email: string;
        roles: Array<{
          id: string;
          role: string;
          context: string;
          isActive: boolean;
          grantedAt: Date;
        }>;
      }
    >();

    for (const role of roles) {
      if (!usersMap.has(role.userId)) {
        usersMap.set(role.userId, {
          userId: role.user.id,
          name: role.user.name,
          email: role.user.email,
          roles: [],
        });
      }

      usersMap.get(role.userId)!.roles.push({
        id: role.id,
        role: role.role,
        context: role.context,
        isActive: role.isActive,
        grantedAt: role.grantedAt,
      });
    }

    return {
      commerceId,
      users: Array.from(usersMap.values()),
    };
  }
}
