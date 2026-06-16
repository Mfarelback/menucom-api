-- Migration 011: Add commerceId to orders for multi-tenant migration

-- Add commerceId column to orders table (nullable for backward compatibility)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "commerceId" UUID NULL;

-- Add foreign key constraint from orders.commerceId to commerce(id)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'FK_orders_commerce'
    ) THEN
        ALTER TABLE orders
            ADD CONSTRAINT "FK_orders_commerce"
            FOREIGN KEY ("commerceId") REFERENCES commerce(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Create index on orders.commerceId for tenant-based queries
CREATE INDEX IF NOT EXISTS idx_orders_commerce_id ON orders("commerceId");

-- Populate orders.commerceId from existing data:
-- Join orders with catalogs via catalog items, then with commerce
-- Simpler approach: join orders.ownerId with commerce.ownerId
UPDATE orders o
SET "commerceId" = c.id
FROM commerce c
WHERE o."ownerId" = c."ownerId"
  AND o."commerceId" IS NULL;