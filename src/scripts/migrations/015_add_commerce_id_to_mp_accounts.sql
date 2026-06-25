-- Agregar commerceId a mercado_pago_accounts para soporte multi-tenant
-- Permite que cada commerce tenga su propia cuenta de Mercado Pago vinculada

-- 1. Agregar columna commerceId con FK a commerce
ALTER TABLE mercado_pago_accounts 
  ADD COLUMN "commerceId" uuid REFERENCES commerce(id) ON DELETE SET NULL;

-- 2. Dropear unique constraint sobre userId (permitir múltiples cuentas por usuario, una por commerce)
DROP INDEX IF EXISTS "IDX_88eefc76bfba4c820b17e6c85b";

-- 3. Crear índice no-único sobre userId para búsquedas (reemplaza el unique dropeado)
CREATE INDEX IF NOT EXISTS "IDX_mercado_pago_accounts_userId"
  ON mercado_pago_accounts("userId");

-- 4. Crear índice único parcial sobre commerceId (solo para filas con commerceId no nulo)
CREATE UNIQUE INDEX "IDX_mercado_pago_accounts_commerceId" 
  ON mercado_pago_accounts("commerceId") 
  WHERE "commerceId" IS NOT NULL;

-- 5. Backfill: asignar commerceId a cuentas existentes
-- Busca el commerce cuyo ownerId coincida con el userId de la cuenta MP
UPDATE mercado_pago_accounts mpa
SET "commerceId" = c.id
FROM commerce c
WHERE c."ownerId" = mpa."userId"
  AND mpa."commerceId" IS NULL;
