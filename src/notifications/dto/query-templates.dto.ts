import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsBoolean, IsIn } from 'class-validator';
import { PaginationDto } from '../../user/dto/pagination.dto';

export class QueryTemplatesDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Búsqueda parcial en name, title, body' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filtrar por estado activo/inactivo' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Campo de orden',
    enum: ['name', 'createdAt', 'updatedAt'],
    default: 'updatedAt',
  })
  @IsOptional()
  @IsString()
  @IsIn(['name', 'createdAt', 'updatedAt'])
  sortBy?: 'name' | 'createdAt' | 'updatedAt';

  @ApiPropertyOptional({
    description: 'Dirección del orden',
    enum: ['ASC', 'DESC'],
    default: 'DESC',
  })
  @IsOptional()
  @IsString()
  @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC';
}
