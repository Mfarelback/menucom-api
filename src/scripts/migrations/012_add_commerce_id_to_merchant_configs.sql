-- Migration 012: Add commerceId to merchant_configs for multi-tenant migration

-- Add commerceId column to merchant_configs table (nullable for backward compatibility)
ALTER TABLE merchant_configs ADD COLUMN IF NOT EXISTS "commerceId" UUID NULL;

-- Add foreign key constraint from merchant_configs.commerceId to commerce(id)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'FK_merchant_configs_commerce'
    ) THEN
        ALTER TABLE merchant_configs
            ADD CONSTRAINT "FK_merchant_configs_commerce"
            FOREIGN KEY ("commerceId") REFERENCES commerce(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Create index on merchant_configs.commerceId for tenant-based queries
CREATE INDEX IF NOT EXISTS idx_merchant_configs_commerce_id ON merchant_configs("commerceId");

-- Populate merchant_configs.commerceId from existing data:
-- Join merchant_configs.tenantId with commerce.ownerId
UPDATE merchant_configs mc
SET "commerceId" = c.id
FROM commerce c
WHERE mc."tenantId" = c."ownerId"
  AND mc."commerceId" IS NULL;