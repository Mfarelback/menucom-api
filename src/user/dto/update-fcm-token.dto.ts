import { IsString, IsNotEmpty, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateFcmTokenDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9:_-]{100,500}$/, {
    message: 'Formato de token FCM inválido',
  })
  @ApiProperty({ description: 'El token de registro de FCM del dispositivo.' })
  fcmToken: string;
}
