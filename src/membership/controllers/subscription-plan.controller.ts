import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt.auth.gards';
import { RoleGuard } from '../../auth/guards/role.guards';
import { Roles } from '../../auth/decorators/role.decorator';
import { Role } from '../../auth/models/roles.model';
import { SubscriptionPlanService } from '../services/subscription-plan.service';
import { CreateSubscriptionPlanDto } from '../dto/create-subscription-plan.dto';
import { UpdateSubscriptionPlanDto } from '../dto/update-subscription-plan.dto';
import {
  SubscriptionPlan,
  PlanType,
} from '../entities/subscription-plan.entity';

@Controller('admin/subscription-plans')
@UseGuards(JwtAuthGuard, RoleGuard)
@Roles(Role.ADMIN) // Solo administradores pueden gestionar planes
export class SubscriptionPlanController {
  constructor(
    private readonly subscriptionPlanService: SubscriptionPlanService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createPlan(
    @Request() req,
    @Body() createPlanDto: CreateSubscriptionPlanDto,
  ): Promise<SubscriptionPlan> {
    return this.subscriptionPlanService.createPlan(createPlanDto, req.user.id);
  }

  @Get()
  async getAllPlans(
    @Query('type') type?: PlanType,
  ): Promise<SubscriptionPlan[]> {
    if (type) {
      return this.subscriptionPlanService.getPlansByType(type);
    }
    return this.subscriptionPlanService.getActivePlans();
  }

  @Get('stats')
  async getPlanStats(): Promise<any> {
    return this.subscriptionPlanService.getPlanStats();
  }

  @Get(':id')
  async getPlanById(@Param('id') id: string): Promise<SubscriptionPlan> {
    return this.subscriptionPlanService.getPlanById(id);
  }

  @Put(':id')
  async updatePlan(
    @Param('id') id: string,
    @Body() updatePlanDto: UpdateSubscriptionPlanDto,
  ): Promise<SubscriptionPlan> {
    return this.subscriptionPlanService.updatePlan(id, updatePlanDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async archivePlan(@Param('id') id: string): Promise<SubscriptionPlan> {
    return this.subscriptionPlanService.archivePlan(id);
  }

  @Post('seed-standard-plans')
  @HttpCode(HttpStatus.OK)
  async seedStandardPlans(): Promise<{ message: string }> {
    await this.subscriptionPlanService.seedStandardPlans();
    return { message: 'Standard plans seeded successfully' };
  }
}
