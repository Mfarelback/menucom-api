import {
  Controller,
  Get,
  Post,
  Put,
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
import { MembershipPlan } from '../enums/membership-plan.enum';
import {
  QueryMembershipsAdminDto,
  UpdateMembershipAdminDto,
  CreateCustomPlanDto,
  UpdateCustomPlanDto,
} from '../dto/admin-membership.dto';

@ApiTags('Admin Membership')
@ApiBearerAuth()
@Controller('admin/memberships')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@InBusinessContext(BusinessContext.GENERAL)
@RequirePermissions(Permission.MANAGE_USERS)
export class MembershipAdminController {
  constructor(private readonly membershipAdminService: MembershipAdminService) {}

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