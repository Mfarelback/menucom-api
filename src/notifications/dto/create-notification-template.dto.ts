import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsObject,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const SENSITIVE_DATA_KEYS = [
  'password',
  'token',
  'secret',
  'key',
  'auth',
  'credential',
];

export function containsSensitiveDataKey(data: Record<string, any>): boolean {
  return Object.keys(data).some((k) =>
    SENSITIVE_DATA_KEYS.some((sk) => k.toLowerCase().includes(sk)),
  );
}

export class CreateNotificationTemplateDto {
  @ApiProperty({ example: 'promocion_producto' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(100)
  @Matches(/^[a-z0-9_]+$/, {
    message: 'name solo permite minúsculas, números y guiones bajos',
  })
  name: string;

  @ApiProperty({ example: '¡{{productName}} en oferta!' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @ApiProperty({
    example:
      'Hola {{userName}}, el {{productName}} está con {{discount}}% de descuento.',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(4000)
  body: string;

  @ApiPropertyOptional({
    example: { type: 'promotion', click_action: 'FLUTTER_NOTIFICATION_CLICK' },
  })
  @IsOptional()
  @IsObject()
  data?: Record<string, any>;

  @ApiPropertyOptional({ example: 'menucom://producto/{{productSlug}}' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  deepLink?: string;

  @ApiPropertyOptional({
    example: 'https://res.cloudinary.com/.../producto.jpg',
  })
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2048)
  imageUrl?: string;
}
