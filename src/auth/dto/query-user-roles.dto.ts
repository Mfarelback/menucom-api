import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { BusinessContext } from '../models/permissions.model';

export class QueryUserRolesDto {
  @ApiPropertyOptional({
    description: 'Filtrar por contexto de negocio',
    enum: BusinessContext,
    example: BusinessContext.RESTAURANT,
  })
  @IsOptional()
  @IsEnum(BusinessContext)
  context?: BusinessContext;

  @ApiPropertyOptional({
    description: 'Filtrar por ID de recurso específico',
    example: 'restaurant-uuid-456',
  })
  @IsOptional()
  @IsString()
  resourceId?: string;
}
