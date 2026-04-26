import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt.auth.gards';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions, InBusinessContext } from '../../auth/decorators/permissions.decorator';
import { Permission, BusinessContext } from '../../auth/models/permissions.model';
import { MembershipAdminService } from '../services/membership-admin.service';
import { BillingAdminService } from '../services/billing-admin.service';
import { MembershipPlan } from '../enums/membership-plan.enum';
import {
  QueryMembershipsAdminDto,
  UpdateMembershipAdminDto,
  CreateCustomPlanDto,
  UpdateCustomPlanDto,
} from '../dto/admin-membership.dto';
import {
  GeneratePaymentLinkDto,
  EnableAutoBillingDto,
  ChangeBillingAmountDto,
  MigrateToAutoBillingDto,
} from '../dto/billing.dto';

@ApiTags('Admin Membership')
@ApiBearerAuth()
@Controller('admin/memberships')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@InBusinessContext(BusinessContext.GENERAL)
@RequirePermissions(Permission.MANAGE_USERS)
export class MembershipAdminController {
  constructor(
    private readonly membershipAdminService: MembershipAdminService,
    private readonly billingAdminService: BillingAdminService,
  ) {}

  @Get()
  async getMemberships(@Query() query: QueryMembershipsAdminDto) {
    return this.membershipAdminService.getMembershipsAdmin(query);
  }

  @Get('stats')
  async getMembershipStats() {
    return this.membershipAdminService.getMembershipStats();
  }

  @Get(':id')
  async getMembershipById(@Param('id') id: string) {
    return this.membershipAdminService.getMembershipById(id);
  }

  @Get('user/:userId')
  async getMembershipByUserId(@Param('userId') userId: string) {
    return this.membershipAdminService.getMembershipByUserId(userId);
  }

  @Put(':id')
  async updateMembership(
    @Param('id') id: string,
    @Body() dto: UpdateMembershipAdminDto,
    @Request() req,
  ) {
    return this.membershipAdminService.updateMembershipAdmin(id, dto, req.user.userId);
  }

  @Get(':id/audit')
  async getMembershipAudit(@Param('id') id: string) {
    return this.membershipAdminService.getMembershipAuditHistory(id);
  }

  @Get('user/:userId/audit')
  async getMembershipAuditByUserId(@Param('userId') userId: string) {
    return this.membershipAdminService.getMembershipAuditHistoryByUserId(userId);
  }

  @Post('user/:userId/assign/:plan')
  @HttpCode(HttpStatus.CREATED)
  async assignPlanToUser(
    @Param('userId') userId: string,
    @Param('plan') plan: string,
    @Request() req,
  ) {
    return this.membershipAdminService.assignPlanToUser(
      userId,
      plan,
      req.user.userId,
    );
  }

  // ==================== BILLING ENDPOINTS ====================

  @Post('generate-payment-link')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Generate payment link for manual billing' })
  async generatePaymentLink(@Body() dto: GeneratePaymentLinkDto, @Request() req) {
    return this.billingAdminService.generatePaymentLink(dto, req.user.userId);
  }

  @Post('enable-auto-billing')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Enable auto-billing with Mercado Pago preapproval' })
  async enableAutoBilling(@Body() dto: EnableAutoBillingDto, @Request() req) {
    return this.billingAdminService.enableAutoBilling(dto, req.user.userId);
  }

  @Get(':membershipId/billing-details')
  @ApiOperation({ summary: 'Get billing details for a membership' })
  async getBillingDetails(@Param('membershipId') membershipId: string) {
    return this.billingAdminService.getBillingDetails(membershipId);
  }

  @Patch(':membershipId/billing-amount')
  @ApiOperation({ summary: 'Change billing amount for auto-billing subscription' })
  async changeBillingAmount(
    @Param('membershipId') membershipId: string,
    @Body() dto: ChangeBillingAmountDto,
    @Request() req,
  ) {
    return this.billingAdminService.changeBillingAmount(membershipId, dto, req.user.userId);
  }

  @Post(':membershipId/migrate-to-auto-billing')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Migrate from manual to auto-billing' })
  async migrateToAutoBilling(
    @Param('membershipId') membershipId: string,
    @Body() dto: MigrateToAutoBillingDto,
    @Request() req,
  ) {
    return this.billingAdminService.migrateToAutoBilling(membershipId, dto, req.user.userId);
  }

  @Post(':membershipId/migrate-to-manual')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Migrate from auto to manual billing' })
  async migrateToManualBilling(
    @Param('membershipId') membershipId: string,
    @Request() req,
  ) {
    return this.billingAdminService.migrateToManualBilling(membershipId, req.user.userId);
  }

  @Post(':membershipId/pause')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pause auto-billing subscription' })
  async pauseSubscription(
    @Param('membershipId') membershipId: string,
    @Request() req,
  ) {
    return this.billingAdminService.pauseSubscription(membershipId, req.user.userId);
  }

  @Post(':membershipId/resume')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resume paused auto-billing subscription' })
  async resumeSubscription(
    @Param('membershipId') membershipId: string,
    @Request() req,
  ) {
    return this.billingAdminService.resumeSubscription(membershipId, req.user.userId);
  }

  @Post(':membershipId/extend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Extend membership without payment' })
  async extendMembership(
    @Param('membershipId') membershipId: string,
    @Body() body: { periodMonths: number; reason?: string },
    @Request() req,
  ) {
    const membership = await this.billingAdminService.extendMembership(
      membershipId,
      0,
      body.periodMonths,
    );
    await this.membershipAdminService.logAudit({
      userId: membership.userId,
      membershipId: membership.id,
      action: 'renewed' as any,
      previousPlan: membership.plan,
      newPlan: membership.plan,
      description: `Extended by admin: ${body.reason || `${body.periodMonths} month(s)`}`,
      metadata: { adminId: req.user.userId, periodMonths: body.periodMonths },
    });
    return membership;
  }

  // ==================== PLANS ENDPOINTS ====================

  @Get('plans')
  async getPlans() {
    return this.membershipAdminService.getAllPlans();
  }

  @Get('plans/custom')
  async getCustomPlans() {
    return this.membershipAdminService.getCustomPlans();
  }

  @Post('plans/custom')
  @HttpCode(HttpStatus.CREATED)
  async createCustomPlan(@Body() dto: CreateCustomPlanDto, @Request() req) {
    return this.membershipAdminService.createCustomPlan(dto, req.user.userId);
  }

  @Get('plans/custom/:id')
  async getCustomPlanById(@Param('id') id: string) {
    return this.membershipAdminService.getCustomPlanById(id);
  }

  @Put('plans/custom/:id')
  async updateCustomPlan(
    @Param('id') id: string,
    @Body() dto: UpdateCustomPlanDto,
    @Request() req,
  ) {
    return this.membershipAdminService.updateCustomPlan(id, dto, req.user.userId);
  }

  @Delete('plans/custom/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCustomPlan(@Param('id') id: string) {
    await this.membershipAdminService.deleteCustomPlan(id);
  }

  @Get('plans/custom/:id/usage')
  async getPlanUsageStats(@Param('id') id: string) {
    return this.membershipAdminService.getPlanUsageStats(id);
  }
}