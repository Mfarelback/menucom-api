import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { Public } from '../../auth/decorators/public.decorator';
import { PublicService } from '../services/public.service';
import { MerchantListQueryDto } from '../dto/merchant-list-query.dto';
import { FeaturedQueryDto } from '../dto/merchant-featured-query.dto';
import { SearchQueryDto } from '../dto/search-query.dto';

@ApiTags('Public - Landing Page')
@Controller('public')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Get('merchants')
  @Public()
  @ApiOperation({ summary: 'Listar comerciantes profesionales' })
  @ApiResponse({ status: 200, description: 'Lista paginada de comerciantes' })
  async getMerchants(@Query() query: MerchantListQueryDto) {
    return this.publicService.getMerchants(query);
  }

  @Get('merchants/featured')
  @Public()
  @ApiOperation({ summary: 'Comerciantes destacados' })
  @ApiResponse({ status: 200, description: 'Lista de comerciantes destacados' })
  async getFeaturedMerchants(@Query() query: FeaturedQueryDto) {
    return this.publicService.getFeaturedMerchants(query.limit);
  }

  @Get('merchants/:slug')
  @Public()
  @ApiOperation({ summary: 'Perfil público de un comerciante' })
  @ApiResponse({ status: 200, description: 'Perfil completo del comerciante' })
  @ApiResponse({ status: 404, description: 'Comerciante no encontrado' })
  async getMerchantBySlug(@Param('slug') slug: string) {
    return this.publicService.getMerchantBySlug(slug);
  }

  @Get('merchants/:slug/catalogs')
  @Public()
  @ApiOperation({ summary: 'Catálogos de un comerciante' })
  @ApiResponse({ status: 200, description: 'Lista de catálogos' })
  async getMerchantCatalogs(@Param('slug') slug: string) {
    return this.publicService.getMerchantCatalogs(slug);
  }

  @Get('categories')
  @Public()
  @ApiOperation({ summary: 'Categorías de negocio disponibles' })
  @ApiResponse({ status: 200, description: 'Lista de categorías con conteos' })
  async getCategories() {
    return this.publicService.getCategories();
  }

  @Get('stats')
  @Public()
  @ApiOperation({ summary: 'Estadísticas de la plataforma' })
  @ApiResponse({ status: 200, description: 'Estadísticas generales' })
  async getStats() {
    return this.publicService.getStats();
  }

  @Get('search')
  @Public()
  @ApiOperation({ summary: 'Búsqueda unificada' })
  @ApiResponse({ status: 200, description: 'Resultados de búsqueda' })
  async search(@Query() query: SearchQueryDto) {
    return this.publicService.search(query);
  }

  @Get('trending')
  @Public()
  @ApiOperation({ summary: 'Tendencias de la plataforma' })
  @ApiQuery({ name: 'period', required: false, enum: ['24h', '7d', '30d'] })
  @ApiResponse({ status: 200, description: 'Contenido trending' })
  async getTrending(
    @Query('period') period?: string,
    @Query('limit') limit?: string,
  ) {
    return this.publicService.getTrending(
      period || '24h',
      parseInt(limit || '10', 10),
    );
  }
}
