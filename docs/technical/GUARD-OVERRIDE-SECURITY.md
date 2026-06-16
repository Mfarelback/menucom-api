# Security Issue: `@UseGuards` Method-Level Override Silently Removes `PermissionsGuard`

## Location

`src/user/user.controller.ts`

## The Problem

The controller declares `PermissionsGuard` at the **class level**, but several **method-level** `@UseGuards(JwtAuthGuard)` decorators silently **override** the class-level guards, removing `PermissionsGuard` from those endpoints.

### How NestJS `@UseGuards` Works

When a method has its own `@UseGuards`, it **replaces** (does not merge with) the class-level guards. The method only runs through the guards explicitly listed on it.

## Affected Endpoints

| Method | Route | Line | Override | Risk |
|--------|-------|------|----------|------|
| `GET` | `/user/me` | 60 | `@UseGuards(JwtAuthGuard)` | Low — returns own profile, no `:id` param |
| `PATCH` | `/user/update/:id` | 84 | `@UseGuards(JwtAuthGuard)` | **Medium** — accepts arbitrary `:id`, no ownership check, no permission guard |
| `POST` | `/user/by-roles` | 121 | `@UseGuards(JwtAuthGuard)` | Low — query endpoint |
| `DELETE` | `/user/:id` | 153 | `@UseGuards(JwtAuthGuard)` | **HIGH** — any authenticated user can delete any user by ID |
| `PATCH` | `/user/fcm-token` | 164 | `@UseGuards(JwtAuthGuard)` | Low — uses `req.user.userId`, no `:id` param |

## Why It Happens

```typescript
// Class-level: applies to all methods by default
@UseGuards(JwtAuthGuard, PermissionsGuard)   // line 50
export class UserController {

  // Method-level: OVERRIDES class guards
  @UseGuards(JwtAuthGuard)                    // line 60
  @Get('/me')
  async getProfile(@Req() req: Request) {     // only JwtAuthGuard runs
```

The `PermissionsGuard` checks for specific context permissions (e.g., `MANAGE_USERS`, `MANAGE_ORDERS`). Without it, **any authenticated user** can call these endpoints regardless of their role.

## Concrete Security Scenarios

### 1. `DELETE /user/:id` — Unauthorized Deletion (HIGH)

Any logged-in user can delete any other user:

```bash
# User A (regular customer) deletes User B (admin)
curl -X DELETE https://api.menucom.com/user/<admin-uuid> \
  -H "Authorization: Bearer <user-a-token>"
```

Expected: Should require `MANAGE_USERS` permission → `403 Forbidden`
Actual: `200 OK` — user deleted

### 2. `PATCH /user/update/:id` — Unauthorized Profile Update (MEDIUM)

Any logged-in user can modify any user's profile (name, email, photo, phone, FCM token):

```bash
curl -X PATCH https://api.menucom.com/user/<victim-uuid> \
  -H "Authorization: Bearer <attacker-token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Hacker", "phone": "99999999"}'
```

There is no check in `userProfileService.update()` that the requesting user owns the profile being updated.

### 3. `POST /user/by-roles` — Information Disclosure (LOW)

Any authenticated user can list all users filtered by role. This exposes user data (names, emails, etc.).

## Why Method-Level `@UseGuards` Was Added

Likely added because these endpoints don't need the `PermissionsGuard`-specific permission checks that admin endpoints (like `admin/all`, `admin/count`, `admin/:id`) require. The intent was to make them available to all authenticated users. However, the side effect is that `PermissionsGuard` is also removed, which is fine for read/self endpoints but dangerous for mutation endpoints.

## Recommended Fix

**Option A:** Remove method-level `@UseGuards(JwtAuthGuard)` from mutation endpoints (`DELETE :id`, `PATCH /update/:id`) — they will inherit class-level guards. Add `@DisablePermissions()` only to the endpoints that truly shouldn't check permissions:

```typescript
@Get('/me')
@DisablePermissions()
async getProfile(@Req() req: Request) { ... }
```

`@DisablePermissions()` is already used on `changeOwnRole` (line 192) and is the correct way to skip permission checks without removing the guard.

**Option B:** If `PermissionsGuard` handles `@DisablePermissions()` properly, simply removing all method-level `@UseGuards(JwtAuthGuard)` and letting the class-level guards apply to all methods, with `@DisablePermissions()` on specific endpoints, is the cleanest approach.

## Verification

After applying any fix, verify with:

```bash
# Should return 403 for a regular user
curl -X DELETE https://api.menucom.com/user/some-id \
  -H "Authorization: Bearer <customer-token>"

# Should return 200 for an admin user
curl -X DELETE https://api.menucom.com/user/some-id \
  -H "Authorization: Bearer <admin-token>"
```
