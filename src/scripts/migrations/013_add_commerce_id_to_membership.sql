-- Migration 013: Add commerceId to membership and membership_audit for multi-tenant migration

-- Add commerceId column to membership table (nullable for backward compatibility)
ALTER TABLE membership ADD COLUMN IF NOT EXISTS "commerceId" UUID NULL;

-- Add foreign key constraint from membership.commerceId to commerce(id)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'FK_membership_commerce'
    ) THEN
        ALTER TABLE membership
            ADD CONSTRAINT "FK_membership_commerce"
            FOREIGN KEY ("commerceId") REFERENCES commerce(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Create index on membership.commerceId for tenant-based queries
CREATE INDEX IF NOT EXISTS idx_membership_commerce_id ON membership("commerceId");

-- Add commerceId column to membership_audit table (nullable for backward compatibility)
-- Note: TypeORM may use 'membership_audit' or just join table naming
ALTER TABLE membership_audit ADD COLUMN IF NOT EXISTS "commerceId" UUID NULL;

-- Add foreign key constraint from membership_audit.commerceId to commerce(id)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'FK_membership_audit_commerce'
    ) THEN
        ALTER TABLE membership_audit
            ADD CONSTRAINT "FK_membership_audit_commerce"
            FOREIGN KEY ("commerceId") REFERENCES commerce(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Create index on membership_audit.commerceId for tenant-based queries
CREATE INDEX IF NOT EXISTS idx_membership_audit_commerce_id ON membership_audit("commerceId");

-- Populate membership.commerceId from existing data:
-- Join membership.userId with commerce.ownerId
UPDATE membership m
SET "commerceId" = c.id
FROM commerce c
WHERE m."userId" = c."ownerId"
  AND m."commerceId" IS NULL;

-- Populate membership_audit.commerceId from existing data
UPDATE membership_audit ma
SET "commerceId" = c.id
FROM commerce c
WHERE ma."userId" = c."ownerId"
  AND ma."commerceId" IS NULL;