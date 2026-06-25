import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendAdminNotificationDto {
  @ApiProperty({ example: ['uuid-1', 'uuid-2'] })
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMinSize(1, { message: 'Debe incluir al menos un userId' })
  @ArrayMaxSize(5000, {
    message: 'Máximo 5000 usuarios por envío (procesado en batches)',
  })
  userIds: string[];

  @ApiProperty({ example: 'Aviso importante' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @ApiProperty({ example: 'El sistema estará en mantenimiento esta noche.' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(4000)
  body: string;

  @ApiPropertyOptional({
    example: {
      type: 'system_alert',
      click_action: 'FLUTTER_NOTIFICATION_CLICK',
    },
  })
  @IsOptional()
  @IsObject()
  data?: Record<string, string>;

  @ApiPropertyOptional({ example: 'https://res.cloudinary.com/.../alert.jpg' })
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2048)
  imageUrl?: string;
}
