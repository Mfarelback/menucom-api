import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt.auth.gards';
import {
  MembershipGuard,
  RequireMembershipFeature,
} from '../../auth/guards/membership.guard';
import { MembershipFeature } from '../../membership/enums/membership-plan.enum';
import { MembershipProvider } from '../../membership/membership.provider';
import {
  CurrentMembership,
  CurrentUserPlan,
} from '../../membership/decorators/membership.decorator';

// Example DTO for demonstration
class CreateAdvancedMenuDto {
  name: string;
  description: string;
  customBranding?: {
    logo: string;
    colors: string[];
  };
}

@ApiTags('menu-advanced')
@Controller('menu/advanced')
@UseGuards(JwtAuthGuard)
export class MenuAdvancedController {
  constructor(private readonly membershipProvider: MembershipProvider) {}

  @Get('/analytics')
  @UseGuards(MembershipGuard)
  @RequireMembershipFeature(MembershipFeature.ADVANCED_ANALYTICS)
  async getAdvancedAnalytics(@Req() req: Request) {
    // This endpoint requires ADVANCED_ANALYTICS feature
    return {
      message: 'Advanced analytics data',
      userPlan: req['user']['plan'],
    };
  }

  @Post('/custom-branded')
  @UseGuards(MembershipGuard)
  @RequireMembershipFeature(MembershipFeature.CUSTOM_BRANDING)
  async createCustomBrandedMenu(
    @Req() req: Request,
    @Body() menuData: CreateAdvancedMenuDto,
    @CurrentMembership() membership: any,
    @CurrentUserPlan() plan: string,
  ) {
    // This endpoint requires CUSTOM_BRANDING feature
    return {
      message: 'Custom branded menu created',
      plan,
      membership,
      menuData,
    };
  }

  @Post('/bulk-items')
  @UseGuards(JwtAuthGuard) // Only JWT guard, we'll check limits manually
  async createBulkMenuItems(@Req() req: Request, @Body() items: any[]) {
    const userId = req['user']['userId'];
    
    // Check if user can add this many items
    const canAdd = await this.membershipProvider.checkResourceLimit(
      userId,
      'maxMenuItems',
      items.length,
    );

    if (!canAdd) {
      const limit = await this.membershipProvider.getResourceLimit(
        userId,
        'maxMenuItems',
      );
      throw new BadRequestException(
        `You can only add up to ${limit} menu items with your current plan`,
      );
    }

    return {
      message: `Successfully added ${items.length} menu items`,
      items,
    };
  }

  @Get('/limits')
  async getUserLimits(@Req() req: Request) {
    const userId = req['user']['userId'];
    const status = await this.membershipProvider.getMembershipStatus(userId);
    
    return {
      plan: status.plan,
      features: status.features,
      limits: {
        maxMenuItems: await this.membershipProvider.getResourceLimit(
          userId,
          'maxMenuItems',
        ),
        maxLocations: await this.membershipProvider.getResourceLimit(
          userId,
          'maxLocations',
        ),
      },
    };
  }

  @Get('/upgrade-suggestions')
  async getUpgradeSuggestions(@Req() req: Request) {
    const userId = req['user']['userId'];
    const status = await this.membershipProvider.getMembershipStatus(userId);
    
    const suggestions = [];
    
    if (
      !(await this.membershipProvider.checkFeatureAccess(
        userId,
        MembershipFeature.ADVANCED_ANALYTICS,
      ))
    ) {
      suggestions.push({
        feature: 'Advanced Analytics',
        description: 'Get detailed insights about your menu performance',
        requiredPlan: 'premium',
      });
    }
    
    if (
      !(await this.membershipProvider.checkFeatureAccess(
        userId,
        MembershipFeature.UNLIMITED_ITEMS,
      ))
    ) {
      suggestions.push({
        feature: 'Unlimited Menu Items',
        description: 'Add as many menu items as you want',
        requiredPlan: 'premium',
      });
    }

    return {
      currentPlan: status.plan,
      suggestions,
    };
  }
}
