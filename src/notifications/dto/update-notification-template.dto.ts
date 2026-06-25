import {
  IsString,
  IsOptional,
  IsObject,
  IsUrl,
  IsBoolean,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateNotificationTemplateDto {
  @ApiPropertyOptional({ example: 'promocion_producto_v2' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  @Matches(/^[a-z0-9_]+$/, {
    message: 'name solo permite minúsculas, números y guiones bajos',
  })
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  data?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  deepLink?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2048)
  imageUrl?: string;

  @ApiPropertyOptional({ description: 'Desactivar/reactivar template' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
