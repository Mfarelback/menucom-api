import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsBoolean } from 'class-validator';
import { MembershipPlan } from '../../membership/enums/membership-plan.enum';
import { PaginationDto } from './pagination.dto';

export class QueryUsersAdminDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filtrar por plan de membresía',
    enum: MembershipPlan,
    example: 'premium',
  })
  @IsOptional()
  @IsEnum(MembershipPlan)
  plan?: MembershipPlan;

  @ApiPropertyOptional({
    description: 'Buscar por nombre o email (búsqueda parcial)',
    example: 'john',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por fecha de creación desde',
    example: '2024-01-01',
  })
  @IsOptional()
  @IsString()
  createdAfter?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por fecha de creación hasta',
    example: '2024-12-31',
  })
  @IsOptional()
  @IsString()
  createdBefore?: string;

  @ApiPropertyOptional({
    description: 'Filtrar solo usuarios con membresía activa',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  withActiveMembership?: boolean;

  @ApiPropertyOptional({
    description: 'Filtrar solo usuarios con cuenta MP vinculada',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  withVinculedAccount?: boolean;

  @ApiPropertyOptional({
    description: 'Ordenar por campo',
    enum: ['createdAt', 'name', 'email', 'plan'],
    default: 'createdAt',
  })
  @IsOptional()
  @IsString()
  sortBy?: 'createdAt' | 'name' | 'email' | 'plan';

  @ApiPropertyOptional({
    description: 'Direccion de ordenamiento',
    enum: ['ASC', 'DESC'],
    default: 'DESC',
  })
  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC';
}