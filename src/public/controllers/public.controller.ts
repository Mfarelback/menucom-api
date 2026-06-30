import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { Public } from '../../auth/decorators/public.decorator';
import { PublicService } from '../services/public.service';
import { MerchantListQueryDto } from '../dto/merchant-list-query.dto';
import { FeaturedQueryDto } from '../dto/merchant-featured-query.dto';
import { SearchQueryDto } from '../dto/search-query.dto';
import { SubscriptionPlanService } from '../../membership/services/subscription-plan.service';

@ApiTags('Public - Landing Page')
@Controller('public')
export class PublicController {
  constructor(
    private readonly publicService: PublicService,
    private readonly subscriptionPlanService: SubscriptionPlanService,
  ) {}

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

  @Get('pricing')
  @Public()
  @ApiOperation({ summary: 'Información de planes y pricing (7/5/3)' })
  @ApiResponse({ status: 200, description: 'Planes con fees y features' })
  async getPricing() {
    const plans = await this.subscriptionPlanService.getActivePlans();
    return {
      feeDisclaimer:
        'Todos los planes incluyen la comisión de MercadoPago (~3-5% según país y medio de pago). Nuestro fee se suma al costo de MP.',
      feeTiers: {
        free: { totalFee: '7%', mpFee: '~4%', menucomFee: '~3%' },
        premium: {
          totalFee: '5%',
          mpFee: '~4%',
          menucomFee: '~1%',
          subscription: '$15/mes',
        },
        enterprise: {
          totalFee: '3%',
          mpFee: '~4%',
          menucomFee: '-1%*',
          subscription: '$45/mes',
          note: '*Subsidiado por suscripción',
        },
      },
      plans,
    };
  }
}
