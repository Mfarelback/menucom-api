import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsBoolean } from 'class-validator';

export enum DataType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  JSON = 'json',
  ARRAY = 'array',
}

export class CreateAppDataDto {
  @ApiProperty({
    description: 'Clave única para identificar el dato de configuración',
    example: 'app_name',
  })
  @IsString()
  key: string;

  @ApiProperty({
    description: 'Valor del dato de configuración',
    example: 'MenuCom',
  })
  @IsString()
  value: string;

  @ApiProperty({
    description: 'Descripción opcional del dato de configuración',
    example: 'Nombre de la aplicación',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Tipo de dato',
    enum: DataType,
    example: DataType.STRING,
  })
  @IsEnum(DataType)
  dataType: DataType;

  @ApiProperty({
    description: 'Indica si el dato está activo',
    example: true,
    default: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
