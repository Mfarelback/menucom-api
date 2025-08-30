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
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.gards';
import { MembershipService } from './membership.service';
import { MercadoPagoService } from './payment/mercado-pago.service';
import { SubscribeMembershipDto } from './dto/subscribe-membership.dto';
import { UpdateMembershipDto } from './dto/update-membership.dto';
import { MembershipResponseDto } from './dto/membership-response.dto';
import { MembershipPlan } from './enums/membership-plan.enum';

@Controller('membership')
@UseGuards(JwtAuthGuard)
export class MembershipController {
  constructor(
    private readonly membershipService: MembershipService,
    private readonly mercadoPagoService: MercadoPagoService,
  ) {}

  @Get()
  async getUserMembership(@Request() req): Promise<MembershipResponseDto> {
    return this.membershipService.getUserMembership(req.user.id);
  }

  @Post('subscribe')
  @HttpCode(HttpStatus.OK)
  async subscribe(
    @Request() req,
    @Body() subscribeDto: SubscribeMembershipDto,
  ): Promise<MembershipResponseDto> {
    const membership = await this.membershipService.subscribeToPlan(
      req.user.id,
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
      req.user.id,
      updateDto,
    );
    return this.membershipService.formatMembershipResponse(membership);
  }

  @Delete('cancel')
  @HttpCode(HttpStatus.OK)
  async cancelMembership(@Request() req): Promise<MembershipResponseDto> {
    const membership = await this.membershipService.cancelMembership(
      req.user.id,
    );
    return this.membershipService.formatMembershipResponse(membership);
  }

  @Get('limits')
  async getPlanLimits(@Request() req): Promise<any> {
    return this.membershipService.getPlanLimits(req.user.id);
  }

  @Get('audit')
  async getAuditHistory(@Request() req): Promise<any[]> {
    return this.membershipService.getAuditHistory(req.user.id);
  }

  @Get('stats')
  async getMembershipStats(): Promise<any> {
    return this.membershipService.getMembershipStats();
  }

  @Get('plans')
  async getAvailablePlans(): Promise<any> {
    return {
      plans: [
        {
          name: MembershipPlan.FREE,
          price: this.mercadoPagoService.getPlanPrice(MembershipPlan.FREE),
          features: [
            'Basic menu management',
            'Up to 10 items',
            '7 days analytics',
          ],
        },
        {
          name: MembershipPlan.PREMIUM,
          price: this.mercadoPagoService.getPlanPrice(MembershipPlan.PREMIUM),
          features: [
            'Advanced analytics',
            'Custom branding',
            'Up to 500 items',
            'Priority support',
          ],
        },
        {
          name: MembershipPlan.ENTERPRISE,
          price: this.mercadoPagoService.getPlanPrice(
            MembershipPlan.ENTERPRISE,
          ),
          features: [
            'Unlimited items',
            'API access',
            'White label',
            'Dedicated support',
          ],
        },
      ],
      currency: 'ARS',
    };
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
      userId: req.user.id,
      userEmail: req.user.email,
    });

    return {
      paymentId: payment.paymentId,
      paymentUrl: payment.paymentUrl,
      amount: payment.amount,
      currency: payment.currency,
    };
  }
}
