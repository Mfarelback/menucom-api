import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsBoolean, IsDateString, IsObject } from 'class-validator';

export class UpdateRoleDto {
  @ApiPropertyOptional({
    description: 'Activar o desactivar el rol',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Nueva fecha de expiración del rol (ISO 8601)',
    example: '2026-12-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({
    description: 'Actualizar metadatos del rol',
    example: { notes: 'Updated permissions', tier: 'premium' },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
