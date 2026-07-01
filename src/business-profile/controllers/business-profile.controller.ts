import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt.auth.gards';
import { BusinessProfileService } from '../services/business-profile.service';
import { UpdateBusinessProfileDto } from '../dto/business-profile.dto';
import { AuthenticatedRequest } from '../../auth/types/request.types';

@ApiTags('Business Profile')
@Controller()
export class BusinessProfileController {
  constructor(
    private readonly profileService: BusinessProfileService,
  ) {}

  @Get('commerce/profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener perfil del negocio' })
  async getProfile(@Request() req: AuthenticatedRequest) {
    const commerceId = req.tenantId;
    return this.profileService.getProfile(commerceId);
  }

  @Patch('commerce/profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Actualizar perfil del negocio' })
  async updateProfile(
    @Request() req: AuthenticatedRequest,
    @Body() dto: UpdateBusinessProfileDto,
  ) {
    const commerceId = req.tenantId;
    return this.profileService.updateProfile(commerceId, dto);
  }

  @Get('public/commerce/:identifier/profile')
  @ApiOperation({ summary: 'Obtener perfil público del negocio' })
  async getPublicProfile(@Param('identifier') identifier: string) {
    return this.profileService.getPublicProfile(identifier);
  }
}
