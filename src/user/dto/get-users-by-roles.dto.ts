import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsOptional, IsBoolean } from 'class-validator';

export class GetUsersByRolesDto {
  @ApiProperty({
    description: 'Lista de roles para filtrar usuarios',
    example: ['admin', 'manager', 'user'],
    type: [String],
  })
  @IsArray()
  roles: string[];

  @ApiProperty({
    description:
      'Si es true, trae solo usuarios con cuenta de MercadoPago vinculada. Si es false, trae todos.',
    example: false,
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  withVinculedAccount?: boolean = false;

  @ApiProperty({
    description:
      'Si es true, incluye los menús y sus items para cada usuario. Si es false, solo trae la información del usuario.',
    example: false,
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  includeMenus?: boolean = false;
}
