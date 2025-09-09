# MenuCom API - Copilot Instructions

## Project Overview
MenuCom is a NestJS-based restaurant management API that handles menus, orders, payments, and user management. The architecture emphasizes modular design with feature-based organization and comprehensive authentication/authorization systems.

## Key Architecture Patterns

### Module Structure
- **Feature-based modules**: Each domain (auth, payments, membership, etc.) is self-contained in `src/[feature]/`
- **Global modules**: Database and Config modules are marked `@Global()` for app-wide availability
- **Module hierarchy**: App module imports all feature modules; features import only what they need

### Authentication & Authorization
- **Dual auth system**: Traditional JWT + Firebase social authentication
- **Guards hierarchy**: `JwtAuthGuard` → `MembershipGuard` → `RoleGuard` (applied in order)
- **Public routes**: Use `@Public()` decorator to bypass authentication
- **Firebase integration**: Uses `menucom-gconfig.json` for Firebase Admin SDK configuration

### Database Strategy
- **Environment-aware**: PostgreSQL for dev/qa, MySQL fallback in docker-compose
- **TypeORM**: Auto-load entities, synchronize in non-prod
- **Connection**: Uses full database URLs from environment variables

## Critical Development Workflows

### Running the Application
```bash
npm run start:dev  # Development with watch mode
npm run start:debug  # Debug mode with inspector
```

### Database Setup
- Development: Requires `POSTGRESQL_URL` environment variable
- Docker: Run `docker-compose up` for MySQL + phpMyAdmin
- Firebase: Place service account JSON as `menucom-gconfig.json` in root

### Testing Strategy
```bash
npm run test        # Unit tests
npm run test:e2e    # End-to-end tests
npm run test:cov    # Coverage reports
```

## Project-Specific Conventions

### Service Layering
- **Controllers**: Handle HTTP requests, delegate to services
- **Services**: Business logic, inject repositories/other services  
- **Helper Services**: Reusable utilities (e.g., `MercadoPagoHelperService`)
- **Repositories**: Data access when custom queries needed

### Error Handling
- Use NestJS built-in exceptions (`UnauthorizedException`, `BadRequestException`)
- Custom business logic errors in service layer
- Guards should return boolean or throw exceptions

### Configuration Pattern
- Central config in `src/config.ts` using `registerAs()`
- Environment files: `.env` (dev), differentiated by `NODE_ENV`
- Firebase config separate from main config object

## Domain-Specific Knowledge

### Membership System
- **Three tiers**: FREE, PREMIUM, ENTERPRISE with feature-based access
- **Guards usage**: `@RequireMembershipFeature(MembershipFeature.ADVANCED_ANALYTICS)`
- **Auto-creation**: Middleware creates FREE membership for new users
- **Payment integration**: MercadoPago webhooks handle subscription changes

### Payment Processing
- **MercadoPago architecture**: Base service → Helper service → Business service
- **Webhook handling**: Dedicated controller for payment notifications
- **Preference creation**: Use helper service for common payment flows

### Authentication Flow
- **JWT strategy**: For API access with user context
- **Firebase tokens**: Validated server-side, auto-create users on first social login
- **Role-based access**: Controllers can require specific roles with `@Roles()`

## Integration Points

### External Services
- **Firebase**: User authentication, token validation
- **MercadoPago**: Payment processing, webhooks
- **Cloudinary**: Image upload and management
- **WebSockets**: Real-time updates via `PaymentsGateway`

### API Documentation
- **Swagger**: Auto-generated at `/docs` endpoint
- **DTOs**: All request/response objects should have corresponding DTOs
- **Validation**: Use class-validator decorators on DTOs

## Common Gotchas

### Environment Variables
- Firebase private key needs proper escaping in environment files
- Database URLs must include all connection parameters
- JWT_SECRET is required for token signing/verification

### Module Dependencies
- Always import TypeOrmModule.forFeature([Entity]) in feature modules
- Guards must be imported in controllers that use them
- Circular dependencies: Use forwardRef() when necessary

### File Organization
- Each feature has dedicated README.md with implementation details
- Documentation files (FIREBASE-SETUP.md, MEMBERSHIP_IMPLEMENTATION.md) contain setup instructions
- Configuration files use specific naming: `menucom-gconfig.json` for Firebase
