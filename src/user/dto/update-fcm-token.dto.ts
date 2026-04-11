import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateFcmTokenDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ description: 'El token de registro de FCM del dispositivo.' })
  fcmToken: string;
}
