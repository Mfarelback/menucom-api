import { IsNumber, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @IsString()
  @ApiProperty({ description: 'Email solicitante', nullable: false })
  readonly emailRecovery: string;

  @IsNumber()
  @ApiProperty({
    description: 'Codigo de validacion que el backend solicite',
    nullable: true,
  })
  readonly code: number;

  @IsString()
  @ApiProperty({
    description: 'Nueva contraseña del solicitante',
    nullable: true,
  })
  readonly newPassword: string;
}
