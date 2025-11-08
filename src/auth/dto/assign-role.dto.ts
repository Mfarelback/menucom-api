import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsDateString,
  IsObject,
} from 'class-validator';
import { RoleType, BusinessContext } from '../models/permissions.model';

export class AssignRoleDto {
  @ApiProperty({
    description: 'ID del usuario al que se le asignará el rol',
    example: 'user-uuid-123',
  })
  @IsNotEmpty()
  @IsString()
  userId: string;

  @ApiProperty({
    description: 'Tipo de rol a asignar',
    enum: RoleType,
    example: RoleType.OWNER,
  })
  @IsEnum(RoleType)
  @IsNotEmpty()
  role: RoleType;

  @ApiProperty({
    description: 'Contexto de negocio en el que aplica el rol',
    enum: BusinessContext,
    example: BusinessContext.RESTAURANT,
  })
  @IsEnum(BusinessContext)
  @IsNotEmpty()
  context: BusinessContext;

  @ApiPropertyOptional({
    description:
      'ID del recurso específico al que aplica el rol (ej: ID de un restaurante)',
    example: 'restaurant-uuid-456',
  })
  @IsOptional()
  @IsString()
  resourceId?: string;

  @ApiPropertyOptional({
    description: 'Fecha de expiración del rol (ISO 8601)',
    example: '2025-12-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({
    description: 'Metadatos adicionales del rol',
    example: { notes: 'Trial period', department: 'Sales' },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
