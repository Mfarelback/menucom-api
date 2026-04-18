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
import { MercadoPagoService } from './payment/mercado-pago.service';
import { MercadoPagoSubscriptionService } from './payment/mercado-pago-subscription.service';
import { SubscriptionDiscountService } from './payment/subscription-discount.service';
import { SubscriptionPlanService } from './services/subscription-plan.service';
import { SubscribeMembershipDto } from './dto/subscribe-membership.dto';
import { SubscribeToCustomPlanDto } from './dto/subscribe-to-custom-plan.dto';
import { UpdateMembershipDto } from './dto/update-membership.dto';
import { MembershipResponseDto } from './dto/membership-response.dto';
import { MembershipPlan, PLAN_FEATURES } from './enums/membership-plan.enum';
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
    private readonly mercadoPagoService: MercadoPagoService,
    private readonly mpSubscriptionService: MercadoPagoSubscriptionService,
    private readonly discountService: SubscriptionDiscountService,
    private readonly subscriptionPlanService: SubscriptionPlanService,
  ) {}

  @Get()
  async getUserMembership(@Request() req): Promise<MembershipResponseDto> {
    return this.membershipService.getUserMembership(req.user.userId);
  }

  @Post('subscribe')
  @HttpCode(HttpStatus.OK)
  async subscribe(
    @Request() req,
    @Body() subscribeDto: SubscribeMembershipDto,
  ): Promise<MembershipResponseDto> {
    const membership = await this.membershipService.subscribeToPlan(
      req.user.userId,
      subscribeDto,
    );
    return this.membershipService.formatMembershipResponse(membership);
  }

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

  @Delete('cancel')
  @HttpCode(HttpStatus.OK)
  async cancelMembership(@Request() req): Promise<MembershipResponseDto> {
    const membership = await this.membershipService.cancelMembership(
      req.user.userId,
    );
    return this.membershipService.formatMembershipResponse(membership);
  }

  @Get('limits')
  async getPlanLimits(@Request() req): Promise<any> {
    return this.membershipService.getPlanLimits(req.user.userId);
  }

  @Get('audit')
  async getAuditHistory(@Request() req): Promise<any[]> {
    return this.membershipService.getAuditHistory(req.user.userId);
  }

  @Get('stats')
  async getMembershipStats(): Promise<any> {
    return this.membershipService.getMembershipStats();
  }

  @Get('plans')
  async getAvailablePlans(): Promise<any> {
    // Aquí ahora debería integrar con SubscriptionPlanService para obtener planes dinámicos
    return {
      plans: [
        {
          name: MembershipPlan.FREE,
          price: this.mercadoPagoService.getPlanPrice(MembershipPlan.FREE),
          features: [
            'Basic menu management',
            'Up to 10 items',
            'Up to 1 wardrobe',
            'Up to 10 clothing items',
            '7 days analytics',
          ],
        },
        {
          name: MembershipPlan.PREMIUM,
          price: this.mercadoPagoService.getPlanPrice(MembershipPlan.PREMIUM),
          features: [
            'Advanced analytics',
            'Custom branding',
            'Up to 500 menu items',
            'Up to 5 wardrobes',
            'Up to 500 clothing items',
            'Priority support',
          ],
        },
        {
          name: MembershipPlan.ENTERPRISE,
          price: this.mercadoPagoService.getPlanPrice(
            MembershipPlan.ENTERPRISE,
          ),
          features: [
            'Unlimited menu items',
            'Unlimited wardrobes',
            'Unlimited clothing items',
            'API access',
            'White label',
            'Dedicated support',
          ],
        },
      ],
      currency: 'ARS',
    };
  }

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
        metadata: plan.metadata,
        type: plan.type,
      })),
    };
  }

  @Post('subscribe-custom')
  @HttpCode(HttpStatus.OK)
  async subscribeToCustomPlan(
    @Request() req,
    @Body() subscribeDto: SubscribeToCustomPlanDto,
  ): Promise<MembershipResponseDto> {
    // Obtener el plan personalizado
    const plan = await this.subscriptionPlanService.getPlanById(
      subscribeDto.subscriptionPlanId,
    );

    // Crear una membership asociada al plan personalizado
    const membership = await this.membershipService.subscribeToCustomPlan(
      req.user.userId,
      plan,
      subscribeDto,
    );

    return this.membershipService.formatMembershipResponse(membership);
  }

  @Post('create-payment')
  async createPayment(
    @Request() req,
    @Body() body: { plan: MembershipPlan },
  ): Promise<any> {
    if (!body.plan || body.plan === MembershipPlan.FREE) {
      throw new BadRequestException('Cannot create payment for free plan');
    }

    const payment = await this.mercadoPagoService.createPayment({
      plan: body.plan,
      userId: req.user.userId,
      userEmail: req.user.email,
    });

    return {
      paymentId: payment.paymentId,
      paymentUrl: payment.paymentUrl,
      amount: payment.amount,
      currency: payment.currency,
    };
  }

  @Post('subscribe-with-card')
  @HttpCode(HttpStatus.OK)
  async subscribeWithCard(
    @Request() req,
    @Body() dto: SubscribeWithCardDto,
  ): Promise<any> {
    if (dto.plan === MembershipPlan.FREE) {
      const membership = await this.membershipService.subscribeToPlan(
        req.user.userId,
        {
          plan: dto.plan,
          paymentId: `free_${Date.now()}`,
          amount: 0,
          currency: 'ARS',
        },
      );
      return this.membershipService.formatMembershipResponse(membership);
    }

    const basePrice = this.mpSubscriptionService.getPlanPrice(dto.plan);
    let finalPrice = basePrice;
    let discountCode: string | undefined;
    let discountPercentage: number | undefined;

    if (dto.discountCode) {
      const validation = await this.discountService.validateDiscount(
        dto.discountCode,
        dto.plan,
        req.user.userId,
      );

      if (validation.valid && validation.discount) {
        discountCode = validation.discount.code;
        discountPercentage =
          validation.discount.type === 'percentage'
            ? validation.discount.value
            : (validation.discount.value / basePrice) * 100;
        finalPrice = validation.discount.calculateFinalPrice(basePrice);
      }
    }

    const preapproval = await this.mpSubscriptionService.createPreapproval({
      userId: req.user.userId,
      userEmail: req.user.email,
      plan: dto.plan,
      price: basePrice,
      discountCode: dto.discountCode || undefined,
      discountValue: basePrice - finalPrice,
      cardTokenId: dto.cardTokenId,
    });

    const membership = await this.membershipService.subscribeToPlan(
      req.user.userId,
      {
        plan: dto.plan,
        paymentId: preapproval.preapprovalId,
        amount: finalPrice,
        originalAmount: basePrice,
        discountCode,
        discountPercentage,
        currency: 'ARS',
        subscriptionId: preapproval.preapprovalId,
        metadata: {
          mpPreapprovalId: preapproval.preapprovalId,
          paymentMethodId: preapproval.paymentMethodId,
        },
      },
    );

    return {
      subscriptionId: preapproval.preapprovalId,
      status: preapproval.status,
      initPoint: preapproval.initPoint,
      amount: finalPrice,
      originalPrice: basePrice,
      discount: discountCode
        ? {
            code: discountCode,
            percentage: discountPercentage,
            amount: basePrice - finalPrice,
          }
        : null,
      currency: 'ARS',
      membership: this.membershipService.formatMembershipResponse(membership),
    };
  }

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
      originalPrice: membership.originalPrice
        ? Number(membership.originalPrice)
        : undefined,
      discountPercentage: membership.discountPercentage
        ? Number(membership.discountPercentage)
        : undefined,
      nextBillingDate:
        membership.nextBillingDate || mpStatus?.nextBillingDate || undefined,
      lastPaymentAt: membership.lastPaymentAt || undefined,
      paymentMethodId:
        membership.paymentMethodId || mpStatus?.paymentMethodId || undefined,
      hasDiscount: !!membership.discount,
      discountCode: membership.discount?.code || undefined,
    };
  }

  @Post('apply-discount')
  async applyDiscount(
    @Request() req,
    @Body() body: { code: string },
  ): Promise<any> {
    const membership = await this.membershipService.getUserMembership(
      req.user.userId,
    );

    const validation = await this.discountService.validateDiscount(
      body.code,
      membership?.plan || MembershipPlan.PREMIUM,
      req.user.userId,
    );

    if (!validation.valid || !validation.discount) {
      throw new BadRequestException(
        validation.message || 'Invalid discount code',
      );
    }

    const basePrice = this.mpSubscriptionService.getPlanPrice(
      membership?.plan || MembershipPlan.PREMIUM,
    );
    const finalPrice = validation.discount.calculateFinalPrice(basePrice);
    const discountAmount = validation.discount.calculateDiscount(basePrice);

    return {
      valid: true,
      discount: {
        id: validation.discount.id,
        code: validation.discount.code,
        displayName: validation.discount.displayName,
        type: validation.discount.type,
        value: validation.discount.value,
      },
      calculation: {
        originalPrice: basePrice,
        discountAmount,
        finalPrice,
        percentageOff: (discountAmount / basePrice) * 100,
      },
    };
  }

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
      this.logger?.error('Failed to cancel MP subscription:', error);
    }

    await this.membershipService.cancelMembership(req.user.userId);

    return {
      success: true,
      message: 'Subscription cancelled successfully',
      cancelledAt: new Date(),
    };
  }

  @Post('subscription/pause')
  @HttpCode(HttpStatus.OK)
  async pauseSubscription(@Request() req): Promise<any> {
    const membership = await this.membershipService.getUserMembership(
      req.user.userId,
    );

    if (!membership || !membership.mpPreapprovalId) {
      throw new BadRequestException('No active subscription to pause');
    }

    await this.mpSubscriptionService.pauseSubscription(
      membership.mpPreapprovalId,
    );

    await this.membershipService.updateMembershipFields(req.user.userId, {
      subscriptionStatus: 'paused',
    });

    return {
      success: true,
      message: 'Subscription paused successfully',
      status: 'paused',
    };
  }

  @Post('subscription/resume')
  @HttpCode(HttpStatus.OK)
  async resumeSubscription(@Request() req): Promise<any> {
    const membership = await this.membershipService.getUserMembership(
      req.user.userId,
    );

    if (!membership || !membership.mpPreapprovalId) {
      throw new BadRequestException('No subscription to resume');
    }

    await this.mpSubscriptionService.resumeSubscription(
      membership.mpPreapprovalId,
    );

    await this.membershipService.updateMembershipFields(req.user.userId, {
      subscriptionStatus: 'authorized',
    });

    return {
      success: true,
      message: 'Subscription resumed successfully',
      status: 'authorized',
    };
  }
}
