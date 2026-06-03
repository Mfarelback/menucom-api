-- Migration 008: Add ticketTypeId column to ticket_purchases table
-- The entity TicketPurchase has @ManyToOne(() => TicketType) but the column was missing from the original migration

ALTER TABLE "ticket_purchases"
  ADD COLUMN "ticketTypeId" uuid;

-- Backfill: set ticketTypeId from the tickets table for existing COMPLETED purchases
UPDATE "ticket_purchases" tp
SET "ticketTypeId" = (
  SELECT t."ticketTypeId"
  FROM "tickets" t
  WHERE t."purchaseId" = tp."id"
  LIMIT 1
)
WHERE tp."ticketTypeId" IS NULL
  AND EXISTS (
    SELECT 1 FROM "tickets" t WHERE t."purchaseId" = tp."id"
  );

-- Now make it NOT NULL since the entity requires it
ALTER TABLE "ticket_purchases"
  ALTER COLUMN "ticketTypeId" SET NOT NULL;

-- Add the foreign key constraint
ALTER TABLE "ticket_purchases"
  ADD CONSTRAINT "FK_ticket_purchases_type"
  FOREIGN KEY ("ticketTypeId") REFERENCES "ticket_types"("id");
