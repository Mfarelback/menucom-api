# Owner Team Management Fix — 2026-06-17

## Problema

El OWNER de un comercio no podía asignar colaboradores a su equipo.
El endpoint `POST /user-roles/assign` exigía `manage_users` en contexto `GENERAL`,
permiso que solo tenían ADMIN y OPERATOR.

Además, el frontend enviaba el payload con formato incorrecto:
- `userId` enviaba un email en vez de UUID
- `context` enviaba el commerceId en vez de un `BusinessContext` (ej: `"restaurant"`)
- Faltaba el campo `resourceId` para especificar el commerce

## Cambios Realizados

### 1. `src/auth/models/permissions.model.ts`
Se agregó `MANAGE_USERS` y `MANAGE_ROLES` al rol OWNER en todos los contextos:
- RESTAURANT, WARDROBE, MARKETPLACE, RETAIL, EVENTS

### 2. `src/auth/services/user-role.service.ts`
- Se agregó `authorizeTeamManagement(callerUserId, targetRole, targetContext, targetResourceId)`:
  - ADMIN/OPERATOR con `manage_users` en GENERAL: acceso total a cualquier asignación
  - OWNER: solo puede asignar MANAGER/OPERATOR a su propio commerce
  - Valida que `context` coincida con el `BusinessContext` del commerce
  - Bloquea asignación de ADMIN u OWNER por parte de dueños de comercio
- Se agregó `findRoleById(roleId)` para usar en autorización de `updateRole`

### 3. `src/auth/controllers/user-role.controller.ts`
- `POST /user-roles/assign` — Reemplazado `@RequireContextPermissions(GENERAL, MANAGE_USERS)` por `@DisablePermissions()` + llamado a `authorizeTeamManagement`
- `DELETE /user-roles/revoke` — Mismo cambio, ahora requiere `@Request()` para obtener el caller
- `PATCH /user-roles/:roleId` — Mismo cambio, busca el rol existente antes de autorizar
- `GET /user-roles/user/:userId` — `@DisablePermissions()` (antes restringido a GENERAL)
- `GET /user-roles/user/:userId/permissions/:context` — `@DisablePermissions()`
- Se eliminaron imports no usados (`RequireContextPermissions`, `Permission`, `BusinessContext`, `ChangeOwnRoleDto`)

### 4. `GET /user-roles/find-user?email=...` (NUEVO)
Endpoint protegido con JWT para resolver email → userId. Retorna:
```json
{ "userId": "<uuid>", "name": "...", "email": "..." }
```

## Payloads Correctos

### Asignar MANAGER a un comercio

```json
POST /user-roles/assign
{
  "userId": "uuid-del-usuario-target",
  "role": "manager",
  "context": "restaurant",
  "resourceId": "5e75c29a-1135-4559-b7b1-0a088b727958"
}
```

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `userId` | string (UUID) | ID del usuario a asignar (resolver con `GET /user-roles/find-user?email=...`) |
| `role` | RoleType | `manager` u `operator` (OWNER no puede asignar `admin` ni `owner`) |
| `context` | BusinessContext | `restaurant`, `wardrobe`, `marketplace`, `retail`, `events` |
| `resourceId` | string (UUID) | El commerceId del comercio |

### Revocar rol

```json
DELETE /user-roles/revoke
{
  "userId": "uuid-del-usuario",
  "role": "manager",
  "context": "restaurant",
  "resourceId": "5e75c29a-..."
}
```

## Jerarquía de Permisos

| Rol | Puede asignar | Scope |
|-----|--------------|-------|
| ADMIN | Todos los roles (incluyendo OWNER, ADMIN) | Cualquier commerce |
| OPERATOR | Todos los roles | Cualquier commerce |
| OWNER | MANAGER, OPERATOR | Solo su propio commerce (`resourceId` debe coincidir) |
| MANAGER | Ninguno | — |

## Flujo recomendado para Frontend

1. Llamar `GET /user-roles/find-user?email=alejandrofarel@gmail.com` para obtener el `userId`
2. Obtener el `context` del comercio (viene del JWT o del perfil del commerce)
3. Llamar `POST /user-roles/assign` con:
   - `userId` = UUID obtenido en paso 1
   - `role` = `"manager"` o `"operator"`
   - `context` = contexto del comercio (ej: `"restaurant"`)
   - `resourceId` = commerceId del comercio

## Endpoints Afectados

| Endpoint | Antes | Ahora |
|----------|-------|-------|
| `POST /user-roles/assign` | ADMIN/OPERATOR solamente | ADMIN/OPERATOR + OWNER (con restricciones) |
| `DELETE /user-roles/revoke` | ADMIN/OPERATOR solamente | ADMIN/OPERATOR + OWNER (con restricciones) |
| `PATCH /user-roles/:roleId` | ADMIN/OPERATOR solamente | ADMIN/OPERATOR + OWNER (con restricciones) |
| `GET /user-roles/user/:userId` | ADMIN/OPERATOR solamente | Cualquier usuario autenticado |
| `GET /user-roles/user/:userId/permissions/:context` | ADMIN/OPERATOR solamente | Cualquier usuario autenticado |
| `GET /user-roles/find-user?email=` | No existía | Cualquier usuario autenticado |

## NOTA: Pendiente para el Frontend

El frontend DEBE actualizar el payload de `POST /user-roles/assign`:
- Cambiar `userId` de email a UUID
- Cambiar `context` a un valor del enum `BusinessContext`
- Agregar `resourceId` con el commerceId

---

## Cambios Frontend — 2026-06-17

### `menu_dart_api/lib/by_feature/user_roles/find_user/` (NUEVO)
Feature para resolver email → userId usando `GET /user-roles/find-user?email=...`.

### `menu_dart_api/lib/by_feature/user_roles/user_roles.dart`
Se agregaron exports de `find_user`.

### `lib/features/collaborators/presentation/controllers/collaborators_controller.dart`
- Ahora recibe `businessContext` y `FindUserUseCase`
- `assignRole()`: resuelve email → UUID con `_findUserUseCase.execute(email)`, usa `_businessContext` como context y `_commerceId` como resourceId
- `changeRole()` y `removeCollaborator()`: usan `_businessContext` como context y `_commerceId` como resourceId
- `_mapRoleToBackend()`: mapea 'staff' → 'operator' para el backend

### `lib/features/collaborators/presentation/bindings/collaborators_binding.dart`
- Agrega `FindUserUseCase`
- Calcula `businessContext` desde `dinningLogin.role` usando `_resolveBusinessContext()`

### `lib/features/collaborators/presentation/widgets/molecules/assign_role_dialog_molecule.dart`
- Roles disponibles: `['manager', 'operator']` (quitado 'owner')
- Labels: 'Manager', 'Operador'

### `lib/features/collaborators/presentation/widgets/atoms/collaborator_role_badge_atom.dart`
- Agrega caso 'operator' → color verde, label 'Operador'

### `lib/features/collaborators/presentation/widgets/organisms/collaborator_kpi_organism.dart`
- Renombrado 'Staff' → 'Operadores'

### `lib/features/collaborators/presentation/pages/collaborators_page.dart`
- Fallback de `currentRole`: 'staff' → 'operator'

---

## Contexto GENERAL — Restricción (2026-06-17)

Contexto `GENERAL` ahora es exclusivo para roles de sistema: `ADMIN`, `OPERATOR`, `CUSTOMER`.  
Los rubros `pharmacy`, `beauty`, `construction`, `automotive` se movieron de `GENERAL` a `RETAIL`.

### Migración de datos existentes (si aplica)

```sql
-- 1. Migrar comercios
UPDATE commerce SET context = 'retail'
WHERE context = 'general'
  AND business_type IN ('pharmacy', 'beauty', 'construction', 'automotive');

-- 2. Migrar user_roles de esos comercios
UPDATE user_roles SET context = 'retail'
WHERE context = 'general' AND role = 'owner'
  AND "resourceId"::uuid IN (
    SELECT id FROM commerce
    WHERE business_type IN ('pharmacy', 'beauty', 'construction', 'automotive')
  );
```

> Al 2026-06-17, la BD tiene 0 registros que requieran migración.
