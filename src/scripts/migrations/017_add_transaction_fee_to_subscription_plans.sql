-- Migración 017: Agrega transactionFee a subscription_plans
-- Permite que cada plan de membresía defina su propio fee por transacción
-- Reemplaza el hardcodeo de 7/5/3 en MarketplaceFeeResolverService

ALTER TABLE subscription_plans
ADD COLUMN IF NOT EXISTS transaction_fee DECIMAL(5,2) NULL;

COMMENT ON COLUMN subscription_plans.transaction_fee IS
'Porcentaje de fee por transacción para comercios en este plan (ej: 7.00 = 7%). NULL = usar fee global.';

-- Backfill de planes estándar existentes (solo si no tienen transactionFee ya)
UPDATE subscription_plans
SET transaction_fee = 7.00
WHERE name = 'free' AND transaction_fee IS NULL;

UPDATE subscription_plans
SET transaction_fee = 5.00
WHERE name = 'premium' AND transaction_fee IS NULL;

UPDATE subscription_plans
SET transaction_fee = 3.00
WHERE name = 'enterprise' AND transaction_fee IS NULL;
