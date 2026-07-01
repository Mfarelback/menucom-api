-- Migration 018: Add average_rating, review_count to catalog_item, and ensure commerceId in catalogs

-- Add average_rating and review_count to catalog_item (already exist in entity, ensure in prod)
ALTER TABLE catalog_item ADD COLUMN IF NOT EXISTS "averageRating" DECIMAL(3,2) DEFAULT 0;
ALTER TABLE catalog_item ADD COLUMN IF NOT EXISTS "reviewCount" INTEGER DEFAULT 0;

-- Ensure commerceId exists in catalogs table (needed for multi-tenant, already in entity)
ALTER TABLE catalogs ADD COLUMN IF NOT EXISTS "commerceId" UUID NULL;

-- Add foreign key from catalogs.commerceId to commerce(id)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'FK_catalogs_commerce'
    ) THEN
        ALTER TABLE catalogs
            ADD CONSTRAINT "FK_catalogs_commerce"
            FOREIGN KEY ("commerceId") REFERENCES commerce(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Create index on catalogs.commerceId
CREATE INDEX IF NOT EXISTS idx_catalogs_commerce_id ON catalogs("commerceId");

-- Backfill catalogs.commerceId from owner relationship (where commerce exists)
UPDATE catalogs c
SET "commerceId" = com.id
FROM commerce com
WHERE c."ownerId" = com."ownerId"
  AND c."commerceId" IS NULL;
