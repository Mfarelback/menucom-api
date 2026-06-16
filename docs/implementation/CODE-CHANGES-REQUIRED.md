# Cambios Requeridos en el Código

## Archivo 1: `src/user/dto/create-user.dto.ts`

### Agregar después de la propiedad `role` (línea 57):

```typescript
  /**
   * Tipo de negocio del usuario
   * Determina el rol y contexto asignados automáticamente
   * 
   * - 'customer': Cliente final (solo compra)
   * - 'events': Organizador de eventos
   * - 'food'|'dinning': Dueño de restaurante
   * - 'clothes': Dueño de tienda de ropa
   * - 'retail'|'grocery'|'electronics': Vendedor de marketplace
   * - 'admin': Administrador del sistema
   */
  @IsString()
  @IsOptional()
  @ApiPropertyOptional({
    description: 'Tipo de negocio/comportamiento del usuario',
    enum: [
      'customer', 'events', 'food', 'dinning', 'clothes',
      'retail', 'grocery', 'electronics', 'accessories',
      'pharmacy', 'beauty', 'construction', 'automotive',
      'pets', 'water_distributor', 'admin', 'operador'
    ],
    example: 'events',
  })
  readonly businessType?: string;
```

---

## Archivo 2: `src/auth/services/auth.service.ts`

### Reemplazar TODO el método `registerUser` (líneas 57-144):

```typescript
  async registerUser(userData: CreateUserDto) {
    try {
      const userRegister = await this.usersService.create(userData);

      // NUEVO: Mapeo completo de businessType a (role, context)
      const businessTypeMapping: Record<string, {
        role: RoleType;
        context: BusinessContext;
        needsCustomerRole: boolean;
      }> = {
        // Cliente final - solo compra
        'customer': {
          role: RoleType.CUSTOMER,
          context: BusinessContext.GENERAL,
          needsCustomerRole: false,
        },

        // Comerciantes - OWNER en su contexto + CUSTOMER para comprar en otros
        'food': {
          role: RoleType.OWNER,
          context: BusinessContext.RESTAURANT,
          needsCustomerRole: true,
        },
        'dinning': {
          role: RoleType.OWNER,
          context: BusinessContext.RESTAURANT,
          needsCustomerRole: true,
        },
        'clothes': {
          role: RoleType.OWNER,
          context: BusinessContext.WARDROBE,
          needsCustomerRole: true,
        },
        'retail': {
          role: RoleType.OWNER,
          context: BusinessContext.MARKETPLACE,
          needsCustomerRole: true,
        },
        'grocery': {
          role: RoleType.OWNER,
          context: BusinessContext.MARKETPLACE,
          needsCustomerRole: true,
        },
        'electronics': {
          role: RoleType.OWNER,
          context: BusinessContext.MARKETPLACE,
          needsCustomerRole: true,
        },
        'accessories': {
          role: RoleType.OWNER,
          context: BusinessContext.MARKETPLACE,
          needsCustomerRole: true,
        },
        'pharmacy': {
          role: RoleType.OWNER,
          context: BusinessContext.GENERAL,
          needsCustomerRole: true,
        },
        'beauty': {
          role: RoleType.OWNER,
          context: BusinessContext.GENERAL,
          needsCustomerRole: true,
        },
        'construction': {
          role: RoleType.OWNER,
          context: BusinessContext.GENERAL,
          needsCustomerRole: true,
        },
        'automotive': {
          role: RoleType.OWNER,
          context: BusinessContext.GENERAL,
          needsCustomerRole: true,
        },
        'pets': {
          role: RoleType.OWNER,
          context: BusinessContext.MARKETPLACE,
          needsCustomerRole: true,
        },
        'water_distributor': {
          role: RoleType.OWNER,
          context: BusinessContext.MARKETPLACE,
          needsCustomerRole: true,
        },
        'events': {  // ← NUEVO: Organizador de eventos
          role: RoleType.OWNER,
          context: BusinessContext.EVENTS,
          needsCustomerRole: true,
        },

        // Administradores del sistema
        'admin': {
          role: RoleType.ADMIN,
          context: BusinessContext.GENERAL,
          needsCustomerRole: false,
        },
        'operador': {
          role: RoleType.OPERATOR,
          context: BusinessContext.GENERAL,
          needsCustomerRole: false,
        },
      };

      // Usar businessType (nuevo) o role (legacy) para determinar el tipo
      const typeKey = userData.businessType || userData.role || 'customer';
      const mapping = businessTypeMapping[typeKey] || businessTypeMapping['customer'];

      this.logger.log(
        `Registering user ${userRegister.email} with businessType: ${typeKey} → ` +
        `role: ${mapping.role}, context: ${mapping.context}`
      );

      // 1. Asignar rol principal (OWNER/ADMIN/CUSTOMER en su contexto)
      try {
        await this.userRoleService.assignRole(
          userRegister.id,
          mapping.role,
          mapping.context,
          {
            grantedBy: 'system',
            metadata: {
              source: 'registration-v2',
              businessType: typeKey,
              registeredAt: new Date().toISOString(),
            },
          },
        );
        this.logger.log(
          `✅ Assigned ${mapping.role} in ${mapping.context} to ${userRegister.email}`
        );
      } catch (roleError) {
        this.logger.warn(
          `Could not assign primary role to ${userRegister.id}: ${roleError.message}`
        );
      }

      // 2. Si es comerciante, también darle CUSTOMER para que pueda comprar en otros negocios
      if (mapping.needsCustomerRole) {
        try {
          await this.userRoleService.assignRole(
            userRegister.id,
            RoleType.CUSTOMER,
            BusinessContext.GENERAL,
            {
              grantedBy: 'system',
              metadata: {
                source: 'registration-dual-role',
                reason: 'merchant_can_also_buy_as_customer',
              },
            },
          );
          this.logger.log(
            `✅ Assigned dual CUSTOMER role to ${userRegister.email}`
          );
        } catch (roleError) {
          this.logger.warn(
            `Could not assign customer role to ${userRegister.id}: ${roleError.message}`
          );
        }
      }

      const payload = {
        username: userRegister.role,
        sub: userRegister.id,
      };

      return {
        access_token: this.jwtService.sign(payload),
        needToChangePassword: userRegister.needToChangepassword,
      };
    } catch (error) {
      this.logger.error(`Error in registerUser: ${error.message}`, error.stack);
      throw new HttpException(error.message, error.status || 500);
    }
  }
```

---

## Archivo 3: `src/auth/services/auth.service.ts` (Registro Social)

### Modificar `registerUserSocial` (alrededor de línea 355):

```typescript
  async registerUserSocial(firebaseUserData: any) {
    this.logger.log('Starting social user registration');
    this.logger.logObject('Registration data', {
      email: firebaseUserData.email,
      uid: firebaseUserData.uid,
    });

    try {
      // Obtener el businessType de los datos sociales si existe
      const businessType = firebaseUserData.businessType || 'customer';
      
      const newUserData = {
        email: firebaseUserData.email,
        name: firebaseUserData.name || firebaseUserData.email?.split('@')[0],
        socialToken: firebaseUserData.uid,
        photoURL: firebaseUserData.picture,
        phone: firebaseUserData.phone,
        role: businessType === 'customer' ? 'customer' : 'owner',
        needToChangepassword: false,
        password: null,
        isEmailVerified: firebaseUserData.email_verified || false,
        firebaseProvider: firebaseUserData.firebaseProvider,
        lastLoginAt: new Date(),
      };

      this.logger.debug('Creating user in database...');
      const userRegister = await this.userAuthService.createOfSocial(newUserData);

      if (!userRegister) {
        this.logger.error('CRITICAL: createOfSocial returned null', '');
        throw new HttpException(
          'Critical error: user service could not create user',
          500,
        );
      }

      this.logger.log('Social user registered successfully');

      // NUEVO: Usar el mismo mapeo que el registro tradicional
      const businessTypeMapping: Record<string, {
        role: RoleType;
        context: BusinessContext;
        needsCustomerRole: boolean;
      }> = {
        'customer': { role: RoleType.CUSTOMER, context: BusinessContext.GENERAL, needsCustomerRole: false },
        'events': { role: RoleType.OWNER, context: BusinessContext.EVENTS, needsCustomerRole: true },
        'food': { role: RoleType.OWNER, context: BusinessContext.RESTAURANT, needsCustomerRole: true },
        'dinning': { role: RoleType.OWNER, context: BusinessContext.RESTAURANT, needsCustomerRole: true },
        'clothes': { role: RoleType.OWNER, context: BusinessContext.WARDROBE, needsCustomerRole: true },
        'retail': { role: RoleType.OWNER, context: BusinessContext.MARKETPLACE, needsCustomerRole: true },
        'grocery': { role: RoleType.OWNER, context: BusinessContext.MARKETPLACE, needsCustomerRole: true },
        'electronics': { role: RoleType.OWNER, context: BusinessContext.MARKETPLACE, needsCustomerRole: true },
        // ... otros tipos
      };

      const mapping = businessTypeMapping[businessType] || businessTypeMapping['customer'];

      // Asignar rol principal
      try {
        await this.userRoleService.assignRole(
          userRegister.id,
          mapping.role,
          mapping.context,
          {
            grantedBy: 'system',
            metadata: {
              source: 'social-registration-v2',
              provider: firebaseUserData.firebaseProvider,
              businessType: businessType,
            },
          },
        );
        this.logger.log(`✅ Assigned ${mapping.role} in ${mapping.context} to social user`);
      } catch (roleError) {
        this.logger.warn(`Could not assign role to social user: ${roleError.message}`);
      }

      // Asignar CUSTOMER adicional si es comerciante
      if (mapping.needsCustomerRole) {
        try {
          await this.userRoleService.assignRole(
            userRegister.id,
            RoleType.CUSTOMER,
            BusinessContext.GENERAL,
            {
              grantedBy: 'system',
              metadata: { source: 'social-registration-dual-role' },
            },
          );
        } catch (roleError) {
          this.logger.warn(`Could not assign customer role: ${roleError.message}`);
        }
      }

      return userRegister;
    } catch (error) {
      this.logger.error(
        `Error in registerUserSocial: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        'Error registering social user: ' + error.message,
        500,
      );
    }
  }
```

---

## Archivo 4: `src/auth/models/permissions.model.ts`

### Agregar OWNER en BusinessContext.EVENTS (después de línea 169):

```typescript
  [BusinessContext.EVENTS]: {
    [RoleType.OWNER]: [  // ← NUEVO: Dueño de negocio de eventos (organizador)
      Permission.CREATE_EVENT,
      Permission.READ_EVENT,
      Permission.UPDATE_EVENT,
      Permission.DELETE_EVENT,
      Permission.MANAGE_TICKETS,
      Permission.VALIDATE_TICKETS,
      Permission.VIEW_ANALYTICS,
      Permission.MANAGE_PAYMENTS,
    ],
    [RoleType.EVENT_ORGANIZER]: [  // ← Mantener por backward compatibility
      Permission.CREATE_EVENT,
      Permission.READ_EVENT,
      Permission.UPDATE_EVENT,
      Permission.DELETE_EVENT,
      Permission.MANAGE_TICKETS,
      Permission.VALIDATE_TICKETS,
      Permission.VIEW_ANALYTICS,
      Permission.MANAGE_PAYMENTS,
    ],
    [RoleType.ADMIN]: [
      Permission.CREATE_EVENT,
      Permission.READ_EVENT,
      Permission.UPDATE_EVENT,
      Permission.DELETE_EVENT,
      Permission.MANAGE_TICKETS,
      Permission.VALIDATE_TICKETS,
      Permission.VIEW_ANALYTICS,
    ],
    [RoleType.CUSTOMER]: [
      Permission.READ_EVENT,
      Permission.CREATE_ORDER,
      Permission.READ_ORDER,
    ],
  },
```

---

## Archivo 5: `src/auth/services/user-role.service.ts`

### Agregar al final de la clase (antes del último `}`):

```typescript
  /**
   * Identifica si un usuario es organizador de eventos
   * Un organizador es un OWNER en el contexto EVENTS
   */
  async isEventOrganizer(userId: string): Promise<boolean> {
    return await this.hasRole(
      userId,
      RoleType.OWNER,
      BusinessContext.EVENTS,
    );
  }

  /**
   * Identifica si un usuario es dueño de restaurante
   */
  async isRestaurantOwner(userId: string): Promise<boolean> {
    return await this.hasRole(
      userId,
      RoleType.OWNER,
      BusinessContext.RESTAURANT,
    );
  }

  /**
   * Identifica si un usuario es dueño de tienda (wardrobe)
   */
  async isWardrobeOwner(userId: string): Promise<boolean> {
    return await this.hasRole(
      userId,
      RoleType.OWNER,
      BusinessContext.WARDROBE,
    );
  }

  /**
   * Identifica si un usuario es vendedor de marketplace
   */
  async isMarketplaceOwner(userId: string): Promise<boolean> {
    return await this.hasRole(
      userId,
      RoleType.OWNER,
      BusinessContext.MARKETPLACE,
    );
  }

  /**
   * Obtiene el tipo de negocio principal del usuario
   * Basado en sus roles OWNER
   */
  async getUserBusinessType(userId: string): Promise<string | null> {
    const roles = await this.getUserRoles(userId);

    // Buscar roles OWNER primero (son comerciantes)
    const ownerRoles = roles.filter(r => r.role === RoleType.OWNER);
    if (ownerRoles.length > 0) {
      // Si tiene múltiples, devolver el primero o hacer lógica más compleja
      return ownerRoles[0].context;
    }

    // Si no es OWNER, verificar si es admin
    const adminRole = roles.find(r => r.role === RoleType.ADMIN);
    if (adminRole) {
      return 'admin';
    }

    // Si no, es customer
    const customerRole = roles.find(r => r.role === RoleType.CUSTOMER);
    if (customerRole) {
      return 'customer';
    }

    return null;
  }

  /**
   * Obtiene todos los usuarios que son organizadores de eventos
   */
  async getEventOrganizers(): Promise<UserRole[]> {
    return await this.userRoleRepository.find({
      where: {
        role: RoleType.OWNER,
        context: BusinessContext.EVENTS,
        isActive: true,
      },
      relations: ['user'],
    });
  }
```

---

## Archivo 6: `package.json`

### Agregar script de migración:

```json
{
  "scripts": {
    "migrate:roles": "ts-node src/scripts/migrate-user-roles.ts"
  }
}
```

---

## Resumen de Cambios

| Archivo | Cambio Principal |
|---------|------------------|
| `create-user.dto.ts` | Agregar campo `businessType` |
| `auth.service.ts` | Reemplazar lógica de asignación de roles |
| `permissions.model.ts` | Agregar OWNER en EVENTS |
| `user-role.service.ts` | Agregar helpers de identificación |
| `package.json` | Agregar script de migración |

## Comandos para Ejecutar

```bash
# 1. Backup de base de datos
pg_dump $POSTGRESQL_URL > backup_pre_role_migration.sql

# 2. Aplicar cambios de código
# (commit y push de los cambios anteriores)

# 3. Ejecutar migración de datos
npm run migrate:roles

# 4. Verificar resultados
# Revisar logs de migración
```

