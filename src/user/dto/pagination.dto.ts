import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min as ValidateMin, Max as ValidateMax } from 'class-validator';
import { Type } from 'class-transformer';

export class PaginationDto {
  @ApiPropertyOptional({
    description: 'Número de página (1-based)',
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @ValidateMin(1)
  page: number = 1;

  @ApiPropertyOptional({
    description: 'Cantidad de registros por página',
    default: 20,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @ValidateMin(1)
  @ValidateMax(100)
  limit: number = 20;
}

export class PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}