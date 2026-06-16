-- Migration 010: Add commerceId to events and ticket_purchases for multi-tenant migration

-- Add commerceId column to events table (nullable for backward compatibility)
ALTER TABLE events ADD COLUMN IF NOT EXISTS "commerceId" UUID NULL;

-- Add foreign key constraint from events.commerceId to commerce(id)
-- First check if the constraint already exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'FK_events_commerce'
    ) THEN
        ALTER TABLE events
            ADD CONSTRAINT "FK_events_commerce"
            FOREIGN KEY ("commerceId") REFERENCES commerce(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Create index on events.commerceId for tenant-based queries
CREATE INDEX IF NOT EXISTS idx_events_commerce_id ON events("commerceId");

-- Populate events.commerceId from existing data:
-- Join events with commerce via the organizer (events.organizerId -> commerce.ownerId)
UPDATE events e
SET "commerceId" = c.id
FROM commerce c
WHERE e."organizerId" = c."ownerId"
  AND e."commerceId" IS NULL;

-- Add commerceId column to ticket_purchases table (nullable for backward compatibility)
ALTER TABLE ticket_purchases ADD COLUMN IF NOT EXISTS "commerceId" UUID NULL;

-- Add foreign key constraint from ticket_purchases.commerceId to commerce(id)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'FK_ticket_purchases_commerce'
    ) THEN
        ALTER TABLE ticket_purchases
            ADD CONSTRAINT "FK_ticket_purchases_commerce"
            FOREIGN KEY ("commerceId") REFERENCES commerce(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Create index on ticket_purchases.commerceId for tenant-based queries
CREATE INDEX IF NOT EXISTS idx_ticket_purchases_commerce_id ON ticket_purchases("commerceId");

-- Populate ticket_purchases.commerceId from existing data:
-- Join ticket_purchases with events and then commerce
UPDATE ticket_purchases tp
SET "commerceId" = e."commerceId"
FROM events e
WHERE tp."eventId" = e.id
  AND e."commerceId" IS NOT NULL
  AND tp."commerceId" IS NULL;