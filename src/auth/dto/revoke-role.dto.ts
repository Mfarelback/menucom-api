import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { RoleType, BusinessContext } from '../models/permissions.model';

export class RevokeRoleDto {
  @ApiProperty({
    description: 'ID del usuario al que se le revocará el rol',
    example: 'user-uuid-123',
  })
  @IsNotEmpty()
  @IsString()
  userId: string;

  @ApiProperty({
    description: 'Tipo de rol a revocar',
    enum: RoleType,
    example: RoleType.OWNER,
  })
  @IsEnum(RoleType)
  @IsNotEmpty()
  role: RoleType;

  @ApiProperty({
    description: 'Contexto de negocio del rol a revocar',
    enum: BusinessContext,
    example: BusinessContext.RESTAURANT,
  })
  @IsEnum(BusinessContext)
  @IsNotEmpty()
  context: BusinessContext;

  @ApiPropertyOptional({
    description: 'ID del recurso específico (si aplica)',
    example: 'restaurant-uuid-456',
  })
  @IsOptional()
  @IsString()
  resourceId?: string;
}
