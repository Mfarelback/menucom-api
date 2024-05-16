import {
    IsString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
    @IsString()
    @ApiProperty({ description: 'Nueva contraseña de comercio', nullable: false })
    readonly newPassword: string;
}