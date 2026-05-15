-- Migration 005: Add Merchant Config and Net Amount for Dynamic Marketplace Fee
-- Generated for Dynamic Marketplace Fee implementation

-- =============================================
-- MERCHANT CONFIGS TABLE - New Table
-- =============================================

CREATE TABLE IF NOT EXISTS "merchant_configs" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenantId" varchar NOT NULL UNIQUE,
    "customMarketplaceFee" decimal(5,2),
    "isActive" boolean DEFAULT true,
    "createdAt" timestamp DEFAULT now(),
    "updatedAt" timestamp DEFAULT now()
);

-- Index for faster lookups by tenantId
CREATE INDEX IF NOT EXISTS "idx_merchant_configs_tenantId" ON "merchant_configs"("tenantId");
CREATE INDEX IF NOT EXISTS "idx_merchant_configs_isActive" ON "merchant_configs"("isActive");

-- =============================================
-- TICKET PURCHASES TABLE - Add Net Amount
-- =============================================

-- Add netAmount column to track the net amount received by the organizer
ALTER TABLE "ticket_purchases" ADD COLUMN IF NOT EXISTS "netAmount" decimal(10,2);

-- Add index for reporting queries on netAmount
CREATE INDEX IF NOT EXISTS "idx_ticket_purchases_netAmount" ON "ticket_purchases"("netAmount") WHERE "netAmount" IS NOT NULL;

-- Add composite index for tenant reporting (tenantId + netAmount)
CREATE INDEX IF NOT EXISTS "idx_ticket_purchases_tenant_netAmount" ON "ticket_purchases"("tenantId", "netAmount") WHERE "netAmount" IS NOT NULL;

-- =============================================
-- ROLLBACK (if needed)
-- =============================================

-- DROP TABLE IF EXISTS "merchant_configs";
-- DROP INDEX IF EXISTS "idx_merchant_configs_tenantId";
-- DROP INDEX IF EXISTS "idx_merchant_configs_isActive";

-- ALTER TABLE "ticket_purchases" DROP COLUMN IF EXISTS "netAmount";
-- DROP INDEX IF EXISTS "idx_ticket_purchases_netAmount";
-- DROP INDEX IF EXISTS "idx_ticket_purchases_tenant_netAmount";
