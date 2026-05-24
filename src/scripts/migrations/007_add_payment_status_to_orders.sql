-- Migration 007: Add paymentStatus column to orders table
-- Allows separating payment status from order fulfillment status

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "paymentStatus" varchar(50);

COMMENT ON COLUMN "orders"."paymentStatus" IS 'Estado del pago en MercadoPago (approved, pending, rejected, etc.). Independiente del status de la orden.';

CREATE INDEX IF NOT EXISTS "idx_orders_paymentStatus" ON "orders"("paymentStatus");

-- ALTER TABLE "orders" DROP COLUMN IF EXISTS "paymentStatus";
-- DROP INDEX IF EXISTS "idx_orders_paymentStatus";
