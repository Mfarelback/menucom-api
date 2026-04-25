-- ============================================================================
-- VERIFICACIÓN DE PERMISOS EN user_roles
-- ============================================================================
-- Este archivo permite verificar los roles y permisos de un usuario específico.
--
-- ROLES DISPONIBLES Y SUS PERMISOS:
-- --------------------------------
-- customer  -> Puede leer catálogos, items, crear órdenes (no tiene manage_users)
-- owner     -> Propietario de negocio (restaurante, wardrobe, marketplace)
-- admin     -> Administrador del sistema (TIENE manage_users en general)
-- operator  -> Operador del sistema (TIENE manage_users en general)
-- manager   -> Gerente de un negocio
--
-- CONTEXTO 'general' es donde se otorgan permisos globales del sistema.
--
-- ============================================================================

-- 1. Verificar todos los roles en la base de datos
SELECT id, "userId", role, context, "isActive", grantedBy, "grantedAt"
FROM user_roles;

-- 2. Verificar los roles de un usuario específico (reemplazar el UUID)
SELECT id, role, context, "isActive", grantedBy, "grantedAt"
FROM user_roles
WHERE "userId" = 'd7102944-7ae4-44b9-9554-b1c1fa317591';

-- ============================================================================
-- CÓMO AGREGAR PERMISO MANAGE_USERS A UN USUARIO:
-- ============================================================================
-- Para que un usuario pueda gestionar usuarios del sistema, necesita el rol
-- 'admin' o 'operator' en el contexto 'general'.
--
-- OPCIÓN 1: Crear un nuevo registro con rol 'admin'
-- --------------------------------------------------
INSERT INTO user_roles (id, "userId", role, context, "isActive", "grantedBy", "grantedAt")
VALUES (
  gen_random_uuid(),
  'UUID_DEL_USUARIO_AQUI',
  'admin',
  'general',
  true,
  'UUID_DEL_ADMIN_QUE_OTORGA',
  NOW()
);

-- OPCIÓN 2: Actualizar un rol existente de 'customer' a 'admin'
-- ----------------------------------------------------------------
UPDATE user_roles
SET role = 'admin'
WHERE "userId" = 'UUID_DEL_USUARIO_AQUI' AND context = 'general';

-- NOTA: Si el usuario no tiene un registro en user_roles para el contexto
-- 'general', primero debe autenticarse en el sistema para que se cree
-- automáticamente, o usar la OPCIÓN 1 directamente.

-- ============================================================================
-- VERIFICAR QUE EL CAMBIO FUNCIONÓ:
-- ============================================================================
-- Después de aplicar los cambios, verificar con:
SELECT role, context FROM user_roles WHERE "userId" = 'UUID_DEL_USUARIO_AQUI';

-- El resultado debería mostrar 'admin' en la columna 'role' para 'general'