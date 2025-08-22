import { ApiProperty, PartialType } from '@nestjs/swagger';
import { CreateAppDataDto, DataType } from './create-app-data.dto';
import { IsString, IsOptional, IsEnum, IsBoolean } from 'class-validator';

export class UpdateAppDataDto extends PartialType(CreateAppDataDto) {
  @ApiProperty({
    description: 'Valor del dato de configuración',
    example: 'MenuCom Pro',
    required: false,
  })
  @IsOptional()
  @IsString()
  value?: string;

  @ApiProperty({
    description: 'Descripción opcional del dato de configuración',
    example: 'Nombre de la aplicación actualizado',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Tipo de dato',
    enum: DataType,
    example: DataType.STRING,
    required: false,
  })
  @IsOptional()
  @IsEnum(DataType)
  dataType?: DataType;

  @ApiProperty({
    description: 'Indica si el dato está activo',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
