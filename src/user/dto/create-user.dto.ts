import {
  IsString,
  IsNotEmpty,
  IsEmail,
  Length,
  IsPositive,
  IsOptional,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @IsString()
  @IsOptional()
  @ApiProperty({ description: 'photoUrl of user' })
  readonly id: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ description: 'photoUrl of user' })
  readonly photoURL: string;

  @IsString()
  @IsEmail()
  @IsNotEmpty()
  @ApiProperty({ description: 'the email of user' })
  readonly email: string;

  @IsString()
  @IsEmail()
  @ApiProperty({ description: 'the name of user' })
  readonly name: string;

  @IsString()
  @ApiProperty({ description: 'the number phone' })
  readonly phone: string;

  @IsString()
  @IsNotEmpty()
  @Length(6)
  @ApiProperty({ description: 'the password of user' })
  readonly password: string;

  @IsOptional()
  @IsPositive()
  @ApiProperty()
  readonly needToChangepassword: boolean;
}
