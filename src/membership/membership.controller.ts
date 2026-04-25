import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  UseGuards,
  Request,
  HttpStatus,
  HttpCode,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.gards';
import { Public } from '../auth/decorators/public.decorator';
import { MembershipService } from './membership.service';
import { MercadoPagoSubscriptionService } from './payment/mercado-pago-subscription.service';
import { SubscriptionPlanService } from './services/subscription-plan.service';
import { UpdateMembershipDto } from './dto/update-membership.dto';
import { MembershipResponseDto } from './dto/membership-response.dto';
import { MembershipPlan } from './enums/membership-plan.enum';
import {
  SubscribeWithCardDto,
  SubscriptionStatusResponseDto,
  CancelSubscriptionResponseDto,
} from './dto/subscription.dto';

@Controller('membership')
@UseGuards(JwtAuthGuard)
export class MembershipController {
  private readonly logger = new Logger(MembershipController.name);

  constructor(
    private readonly membershipService: MembershipService,
    private readonly mpSubscriptionService: MercadoPagoSubscriptionService,
    private readonly subscriptionPlanService: SubscriptionPlanService,
  ) {}

  /**
   * GET /membership
   * Obtiene la membresía actual del usuario.
   * Si no tiene, se le asigna FREE automáticamente.
   */
  @Get()
  async getUserMembership(@Request() req): Promise<MembershipResponseDto> {
    return this.membershipService.getUserMembership(req.user.userId);
  }

  /**
   * POST /membership/subscribe
   * Suscribe al usuario a un plan.
   * Body: { plan: 'premium' | 'enterprise', cardTokenId: string }
   * Maneja automático el flujo completo de suscripción con Mercado Pago.
   */
  @Post('subscribe')
  @HttpCode(HttpStatus.OK)
  async subscribe(
    @Request() req,
    @Body() dto: SubscribeWithCardDto,
  ): Promise<any> {
    if (dto.plan === MembershipPlan.FREE) {
      const membership = await this.membershipService.subscribeToPlan(req.user.userId, {
        plan: dto.plan,
        paymentId: `free_${Date.now()}`,
        amount: 0,
        currency: 'ARS',
      });
      return this.membershipService.formatMembershipResponse(membership);
    }

    const basePrice = this.mpSubscriptionService.getPlanPrice(dto.plan);
    const preapproval = await this.mpSubscriptionService.createPreapproval({
      userId: req.user.userId,
      userEmail: req.user.email,
      plan: dto.plan,
      price: basePrice,
      cardTokenId: dto.cardTokenId,
    });

    const membership = await this.membershipService.subscribeToPlan(req.user.userId, {
      plan: dto.plan,
      paymentId: preapproval.preapprovalId,
      amount: basePrice,
      originalAmount: basePrice,
      currency: 'ARS',
      subscriptionId: preapproval.preapprovalId,
      metadata: {
        mpPreapprovalId: preapproval.preapprovalId,
        paymentMethodId: preapproval.paymentMethodId,
      },
    });

    return {
      subscriptionId: preapproval.preapprovalId,
      status: preapproval.status,
      initPoint: preapproval.initPoint,
      amount: basePrice,
      currency: 'ARS',
      membership: this.membershipService.formatMembershipResponse(membership),
    };
  }

  /**
   * PUT /membership
   * Actualiza la membresía actual.
   * Body: { plan?: string, isActive?: boolean }
   */
  @Put()
  async updateMembership(
    @Request() req,
    @Body() updateDto: UpdateMembershipDto,
  ): Promise<MembershipResponseDto> {
    const membership = await this.membershipService.updateMembership(
      req.user.userId,
      updateDto,
    );
    return this.membershipService.formatMembershipResponse(membership);
  }

  /**
   * DELETE /membership
   * Cancela la membresía y la downgraded a FREE.
   */
  @Delete()
  @HttpCode(HttpStatus.OK)
  async cancelMembership(@Request() req): Promise<MembershipResponseDto> {
    const membership = await this.membershipService.cancelMembership(req.user.userId);
    return this.membershipService.formatMembershipResponse(membership);
  }

  /**
   * GET /membership/plans
   * Obtiene los planes estándar disponibles.
   * Público - no requiere autenticación.
   */
  @Get('plans')
  @Public()
  async getAvailablePlans(): Promise<any> {
    return {
      plans: [
        {
          name: MembershipPlan.FREE,
          price: 0,
          features: [
            'Basic menu management',
            'Up to 10 items',
            '1 wardrobe',
            '10 clothing items',
            '7 days analytics',
          ],
        },
        {
          name: MembershipPlan.PREMIUM,
          price: this.mpSubscriptionService.getPlanPrice(MembershipPlan.PREMIUM),
          features: [
            'Advanced analytics',
            'Custom branding',
            'Up to 500 menu items',
            '5 wardrobes',
            'Priority support',
          ],
        },
        {
          name: MembershipPlan.ENTERPRISE,
          price: this.mpSubscriptionService.getPlanPrice(MembershipPlan.ENTERPRISE),
          features: [
            'Unlimited menu items',
            'Unlimited wardrobes',
            'API access',
            'White label',
            'Dedicated support',
          ],
        },
      ],
      currency: 'ARS',
    };
  }

  /**
   * GET /membership/custom-plans
   * Obtiene planes personalizados (creados por admins).
   * Público.
   */
  @Get('custom-plans')
  @Public()
  async getCustomPlans(): Promise<any> {
    const customPlans = await this.subscriptionPlanService.getActivePlans();
    return {
      plans: customPlans.map((plan) => ({
        id: plan.id,
        name: plan.name,
        displayName: plan.displayName,
        description: plan.description,
        price: plan.price,
        currency: plan.currency,
        billingCycle: plan.billingCycle,
        features: plan.features,
        limits: plan.limits,
      })),
    };
  }

  /**
   * GET /membership/status
   * Obtiene el estado detallado de la suscripción activa.
   * Incluye información de Mercado Pago.
   */
  @Get('status')
  async getSubscriptionStatus(
    @Request() req,
  ): Promise<SubscriptionStatusResponseDto> {
    const membership = await this.membershipService.getUserMembership(
      req.user.userId,
    );

    if (!membership) {
      throw new NotFoundException('Membership not found');
    }

    let mpStatus: any;
    if (membership.mpPreapprovalId) {
      try {
        mpStatus = await this.mpSubscriptionService.getPreapproval(
          membership.mpPreapprovalId,
        );
      } catch (error) {
        mpStatus = null;
      }
    }

    return {
      isActive: membership.isActive,
      plan: membership.plan,
      status: membership.subscriptionStatus || mpStatus?.status || 'inactive',
      amount: Number(membership.amount) || 0,
      currency: membership.currency || 'ARS',
      nextBillingDate: membership.nextBillingDate || mpStatus?.nextBillingDate,
      lastPaymentAt: membership.lastPaymentAt,
      paymentMethodId: membership.paymentMethodId || mpStatus?.paymentMethodId,
    };
  }

  /**
   * DELETE /membership/subscription
   * Cancela la suscripción activa de Mercado Pago.
   */
  @Delete('subscription')
  @HttpCode(HttpStatus.OK)
  async cancelSubscription(
    @Request() req,
  ): Promise<CancelSubscriptionResponseDto> {
    const membership = await this.membershipService.getUserMembership(
      req.user.userId,
    );

    if (!membership || !membership.mpPreapprovalId) {
      throw new BadRequestException('No active subscription to cancel');
    }

    try {
      await this.mpSubscriptionService.cancelSubscription(
        membership.mpPreapprovalId,
      );
    } catch (error) {
      this.logger.error('Failed to cancel MP subscription:', error);
    }

    await this.membershipService.cancelMembership(req.user.userId);

    return {
      success: true,
      message: 'Subscription cancelled successfully',
      cancelledAt: new Date(),
    };
  }
}