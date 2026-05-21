import { IsOptional, IsString, IsInt, Min, Max, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CatalogType } from '../../catalog/enums/catalog-type.enum';

export enum MerchantSortBy {
  RECENT = 'recent',
  POPULAR = 'popular',
  NAME = 'name',
}

export class MerchantListQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: CatalogType })
  @IsOptional()
  @IsEnum(CatalogType)
  type?: CatalogType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: MerchantSortBy, default: MerchantSortBy.RECENT })
  @IsOptional()
  @IsEnum(MerchantSortBy)
  sort?: MerchantSortBy = MerchantSortBy.RECENT;
}

export class PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
