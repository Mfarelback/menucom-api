import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../user/dto/pagination.dto';

export class QueryUsersWithTokensDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Búsqueda por name, email' })
  @IsOptional()
  @IsString()
  search?: string;
}
