# Membership System

A comprehensive membership management system for NestJS applications with tiered access control, feature validation, and payment integration.

## Features

- **Multi-tier Membership Plans**: FREE, PREMIUM, ENTERPRISE
- **Feature-based Access Control**: Guard routes based on membership features
- **Resource Limits**: Control usage based on plan limits
- **Audit Logging**: Track all membership changes and activities
- **Payment Integration**: Support for Mercado Pago and other payment providers
- **Automatic Expiration**: Handle expired memberships automatically
- **Flexible Architecture**: Easy to extend with new plans and features

## Quick Start

### 1. Basic Usage

```typescript
// In your controller
import { MembershipGuard, RequireMembershipFeature } from '../auth/guards/membership.guard';
import { MembershipFeature } from '../membership/enums/membership-plan.enum';

@Controller('analytics')
@UseGuards(JwtAuthGuard, MembershipGuard)
@RequireMembershipFeature(MembershipFeature.ADVANCED_ANALYTICS)
export class AnalyticsController {
  // All routes in this controller require ADVANCED_ANALYTICS feature
}
```

### 2. Manual Feature Validation

```typescript
// In your service
constructor(private membershipProvider: MembershipProvider) {}

async createAdvancedReport(userId: string) {
  // Check if user has access to advanced analytics
  const hasAccess = await this.membershipProvider.checkFeatureAccess(
    userId,
    MembershipFeature.ADVANCED_ANALYTICS
  );
  
  if (!hasAccess) {
    throw new ForbiddenException('Upgrade to Premium for advanced analytics');
  }
  
  // Continue with advanced report creation...
}
```

### 3. Resource Limits

```typescript
// Check resource limits before creation
const canAddItems = await this.membershipProvider.checkResourceLimit(
  userId,
  'maxMenuItems',
  currentItemCount + newItemsCount
);

if (!canAddItems) {
  throw new BadRequestException('Item limit exceeded for your plan');
}
```

### 4. Subscription Management

```typescript
// Subscribe to a plan
POST /membership/subscribe
{
  "plan": "premium",
  "paymentId": "MP_PAYMENT_ID",
  "amount": 1500,
  "currency": "ARS"
}

// Get current membership
GET /membership

// Cancel membership
DELETE /membership/cancel
```

## API Endpoints

### Membership Management

- `GET /membership` - Get current user membership
- `POST /membership/subscribe` - Subscribe to a plan
- `PUT /membership` - Update membership
- `DELETE /membership/cancel` - Cancel membership
- `GET /membership/limits` - Get plan limits
- `GET /membership/audit` - Get audit history
- `GET /membership/stats` - Get membership statistics (admin)

## Membership Plans

### FREE Plan
- Features: Basic menu management
- Limits: 10 menu items, 1 location, 7 days analytics

### PREMIUM Plan
- Features: Advanced analytics, custom branding, unlimited items, priority support
- Limits: 500 menu items, 3 locations, 90 days analytics

### ENTERPRISE Plan
- Features: All premium features + API access, white label, custom integrations, dedicated support
- Limits: Unlimited everything

## Usage Examples

### 1. Protecting Routes with Guards

```typescript
@Controller('menu')
export class MenuController {
  @Post('/premium-template')
  @UseGuards(JwtAuthGuard, MembershipGuard)
  @RequireMembershipFeature(MembershipFeature.CUSTOM_BRANDING)
  async createPremiumTemplate(@Request() req, @Body() templateData) {
    // Only accessible to PREMIUM+ users
    return this.menuService.createCustomTemplate(req.user.id, templateData);
  }
}
```

### 2. Manual Access Control

```typescript
@Injectable()
export class MenuService {
  constructor(private membershipProvider: MembershipProvider) {}

  async createBulkMenuItems(userId: string, items: MenuItem[]) {
    // Check current item count
    const currentCount = await this.getMenuItemCount(userId);
    
    // Validate resource limit
    const canAdd = await this.membershipProvider.checkResourceLimit(
      userId,
      'maxMenuItems',
      currentCount + items.length
    );

    if (!canAdd) {
      const limit = await this.membershipProvider.getResourceLimit(userId, 'maxMenuItems');
      throw new BadRequestException(`Cannot exceed ${limit} menu items on your plan`);
    }

    return this.createItems(items);
  }
}
```

### 3. Feature Availability Check

```typescript
@Controller('dashboard')
export class DashboardController {
  @Get('/features')
  async getAvailableFeatures(@Request() req) {
    const userId = req.user.id;
    const status = await this.membershipProvider.getMembershipStatus(userId);
    
    return {
      plan: status.plan,
      features: status.features,
      canUpgrade: status.plan !== MembershipPlan.ENTERPRISE,
      expiresAt: status.expiresAt,
      remainingDays: status.remainingDays
    };
  }
}
```

### 4. Payment Integration

```typescript
@Controller('payment')
export class PaymentController {
  @Post('/upgrade')
  async processUpgrade(@Request() req, @Body() paymentData) {
    // 1. Process payment with Mercado Pago
    const paymentResult = await this.paymentService.processPayment(paymentData);
    
    if (paymentResult.status === 'approved') {
      // 2. Upgrade user membership
      await this.membershipService.subscribeToPlan(req.user.id, {
        plan: paymentData.plan,
        paymentId: paymentResult.id,
        amount: paymentResult.amount,
        currency: paymentResult.currency
      });
      
      return { success: true, message: 'Membership upgraded successfully' };
    }
    
    throw new BadRequestException('Payment failed');
  }
}
```

### 5. Conditional UI Components

```typescript
@Controller('ui-config')
export class UIConfigController {
  @Get('/layout')
  async getLayoutConfig(@Request() req) {
    const userId = req.user.id;
    const membership = await this.membershipProvider.getMembershipStatus(userId);
    
    return {
      showAdvancedAnalytics: membership.features.includes(MembershipFeature.ADVANCED_ANALYTICS),
      showBrandingOptions: membership.features.includes(MembershipFeature.CUSTOM_BRANDING),
      showUpgradePrompts: membership.plan === MembershipPlan.FREE,
      maxUploads: await this.membershipProvider.getResourceLimit(userId, 'maxMenuItems')
    };
  }
}
```

## Decorators and Utilities

### Parameter Decorators

```typescript
import { CurrentMembership, CurrentUserPlan, CurrentUserFeatures } from '../membership/decorators/membership.decorator';

@Get('/status')
async getStatus(
  @CurrentMembership() membership: MembershipResponseDto,
  @CurrentUserPlan() plan: MembershipPlan,
  @CurrentUserFeatures() features: MembershipFeature[]
) {
  return { membership, plan, features };
}
```

### Feature Guard

```typescript
import { RequireMembershipFeature } from '../auth/guards/membership.guard';

@Post('/enterprise-feature')
@RequireMembershipFeature(MembershipFeature.API_ACCESS)
async enterpriseOnlyFeature() {
  // Only ENTERPRISE users can access this
}
```

## Database Schema

The system creates two main tables:

### Membership Table
- `id` - Primary key
- `userId` - Reference to user
- `plan` - Current plan (free/premium/enterprise)
- `features` - Array of enabled features
- `expiresAt` - Expiration date
- `isActive` - Active status
- `paymentId` - Last payment reference
- `amount` - Last payment amount

### MembershipAudit Table
- `id` - Primary key
- `userId` - Reference to user
- `action` - Action performed (upgraded/downgraded/expired/etc.)
- `previousPlan` - Plan before change
- `newPlan` - Plan after change
- `createdAt` - Timestamp

## Environment Variables

Add to your `.env` file:

```env
# Payment settings
MERCADOPAGO_ACCESS_TOKEN=your_mp_token
MEMBERSHIP_WEBHOOK_SECRET=your_webhook_secret

# Membership settings
DEFAULT_PLAN=free
TRIAL_PERIOD_DAYS=7
PAYMENT_GRACE_PERIOD_DAYS=3
```

## Advanced Configuration

### Custom Features

Add new features to the enum:

```typescript
export enum MembershipFeature {
  // ... existing features
  AI_MENU_GENERATION = 'ai_menu_generation',
  VOICE_ORDERING = 'voice_ordering',
}

// Update plan features
export const PLAN_FEATURES = {
  [MembershipPlan.ENTERPRISE]: [
    // ... existing features
    MembershipFeature.AI_MENU_GENERATION,
    MembershipFeature.VOICE_ORDERING,
  ],
};
```

### Custom Limits

Add new resource limits:

```typescript
export const PLAN_LIMITS = {
  [MembershipPlan.FREE]: {
    // ... existing limits
    maxAIGenerations: 5,
    maxVoiceOrders: 10,
  },
};
```

## Error Handling

The system throws specific exceptions:

- `ForbiddenException` - When feature access is denied
- `BadRequestException` - When resource limits are exceeded
- `NotFoundException` - When membership is not found

## Monitoring and Analytics

Use the audit system to track:

- Plan upgrades/downgrades
- Feature usage patterns
- Payment success/failure rates
- Expiration notifications

## Integration with Frontend

### React Example

```typescript
// Check feature availability
const { data: membership } = useQuery('/membership');
const hasAdvancedAnalytics = membership.features.includes('advanced_analytics');

// Conditional rendering
{hasAdvancedAnalytics ? (
  <AdvancedAnalyticsComponent />
) : (
  <UpgradePrompt feature="Advanced Analytics" />
)}
```

### Angular Example

```typescript
// Service
@Injectable()
export class MembershipService {
  async hasFeature(feature: string): Promise<boolean> {
    const membership = await this.getMembership();
    return membership.features.includes(feature);
  }
}

// Component
async ngOnInit() {
  this.showAdvancedFeatures = await this.membershipService.hasFeature('advanced_analytics');
}
```

This membership system provides a solid foundation for implementing tiered access control in your application while maintaining flexibility for future enhancements.
