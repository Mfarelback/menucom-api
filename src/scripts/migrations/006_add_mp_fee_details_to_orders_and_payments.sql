-- Migration 006: Add MP fee details to orders and payment_intent tables
-- Allows transparent fee breakdown for sellers

-- =============================================
-- ORDERS TABLE - Add MP Processing Fee & Net Amount
-- =============================================

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "mpProcessingFee" decimal(10,2);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "netAmount" decimal(10,2);

COMMENT ON COLUMN "orders"."mpProcessingFee" IS 'Comisión de procesamiento cobrada por Mercado Pago (fee_details.mercadopago_fee)';
COMMENT ON COLUMN "orders"."netAmount" IS 'Monto neto que recibe el vendedor = total - marketplaceFeeAmount - mpProcessingFee';

-- =============================================
-- PAYMENT_INTENT TABLE - Add MP Fee Details
-- =============================================

ALTER TABLE "payment_intent" ADD COLUMN IF NOT EXISTS "mpProcessingFee" decimal(10,2);
ALTER TABLE "payment_intent" ADD COLUMN IF NOT EXISTS "mpFeeDetails" jsonb;
ALTER TABLE "payment_intent" ADD COLUMN IF NOT EXISTS "mpNetAmount" decimal(10,2);

COMMENT ON COLUMN "payment_intent"."mpProcessingFee" IS 'Suma de fee_details donde type = mercadopago_fee';
COMMENT ON COLUMN "payment_intent"."mpFeeDetails" IS 'Array completo de fee_details devuelto por MP en el webhook';
COMMENT ON COLUMN "payment_intent"."mpNetAmount" IS 'net_amount devuelto por MP en la respuesta del pago';

-- =============================================
-- INDEXES for reporting
-- =============================================

CREATE INDEX IF NOT EXISTS "idx_orders_netAmount" ON "orders"("netAmount") WHERE "netAmount" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_payment_intent_mpNetAmount" ON "payment_intent"("mpNetAmount") WHERE "mpNetAmount" IS NOT NULL;

-- =============================================
-- ROLLBACK
-- =============================================

-- ALTER TABLE "orders" DROP COLUMN IF EXISTS "mpProcessingFee";
-- ALTER TABLE "orders" DROP COLUMN IF EXISTS "netAmount";
-- ALTER TABLE "payment_intent" DROP COLUMN IF EXISTS "mpProcessingFee";
-- ALTER TABLE "payment_intent" DROP COLUMN IF EXISTS "mpFeeDetails";
-- ALTER TABLE "payment_intent" DROP COLUMN IF EXISTS "mpNetAmount";
-- DROP INDEX IF EXISTS "idx_orders_netAmount";
-- DROP INDEX IF EXISTS "idx_payment_intent_mpNetAmount";
