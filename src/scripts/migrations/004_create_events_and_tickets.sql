-- Migration 004: Create Events and Tickets entities

-- Venues Table
CREATE TABLE IF NOT EXISTS "venues" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" varchar NOT NULL,
    "address" varchar NOT NULL,
    "latitude" decimal(10,8),
    "longitude" decimal(11,8),
    "capacity" integer,
    "services" text,
    "createdAt" timestamp DEFAULT now(),
    "updatedAt" timestamp DEFAULT now()
);

-- Events Table
CREATE TYPE "event_status_enum" AS ENUM ('DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED');
CREATE TABLE IF NOT EXISTS "events" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenantId" varchar NOT NULL,
    "name" varchar NOT NULL,
    "description" text NOT NULL,
    "startDate" timestamp NOT NULL,
    "endDate" timestamp NOT NULL,
    "status" "event_status_enum" DEFAULT 'DRAFT',
    "organizerId" uuid,
    "venueId" uuid,
    "imageUrl" varchar,
    "createdAt" timestamp DEFAULT now(),
    "updatedAt" timestamp DEFAULT now(),
    CONSTRAINT "FK_events_organizer" FOREIGN KEY ("organizerId") REFERENCES "users"("id"),
    CONSTRAINT "FK_events_venue" FOREIGN KEY ("venueId") REFERENCES "venues"("id")
);

-- Ticket Types Table
CREATE TABLE IF NOT EXISTS "ticket_types" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "eventId" uuid NOT NULL,
    "name" varchar NOT NULL,
    "price" decimal(10,2) NOT NULL,
    "totalQuantity" integer NOT NULL,
    "soldQuantity" integer DEFAULT 0,
    "saleStartDate" timestamp NOT NULL,
    "saleEndDate" timestamp NOT NULL,
    "maxPerUser" integer DEFAULT 10,
    "createdAt" timestamp DEFAULT now(),
    "updatedAt" timestamp DEFAULT now(),
    CONSTRAINT "FK_ticket_types_event" FOREIGN KEY ("eventId") REFERENCES "events"("id"),
    CONSTRAINT "CHK_ticket_types_sold_limit" CHECK ("soldQuantity" <= "totalQuantity")
);

-- Ticket Purchases Table
CREATE TYPE "ticket_purchase_status_enum" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');
CREATE TABLE IF NOT EXISTS "ticket_purchases" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenantId" varchar NOT NULL,
    "buyerId" uuid,
    "eventId" uuid NOT NULL,
    "totalAmount" decimal(10,2) NOT NULL,
    "appliedFeePercentage" decimal(10,2) NOT NULL,
    "feeAmount" decimal(10,2) NOT NULL,
    "paymentStatus" "ticket_purchase_status_enum" DEFAULT 'PENDING',
    "orderId" uuid,
    "createdAt" timestamp DEFAULT now(),
    "updatedAt" timestamp DEFAULT now(),
    CONSTRAINT "FK_ticket_purchases_buyer" FOREIGN KEY ("buyerId") REFERENCES "users"("id"),
    CONSTRAINT "FK_ticket_purchases_event" FOREIGN KEY ("eventId") REFERENCES "events"("id"),
    CONSTRAINT "FK_ticket_purchases_order" FOREIGN KEY ("orderId") REFERENCES "orders"("id")
);

-- Tickets Table
CREATE TYPE "ticket_status_enum" AS ENUM ('PENDING', 'ACTIVE', 'VALID', 'USED', 'CANCELLED', 'REFUNDED');
CREATE TABLE IF NOT EXISTS "tickets" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "ticketTypeId" uuid NOT NULL,
    "purchaseId" uuid NOT NULL,
    "qrCode" varchar NOT NULL UNIQUE,
    "ownerName" varchar,
    "ownerEmail" varchar,
    "status" "ticket_status_enum" DEFAULT 'PENDING',
    "validatedAt" timestamp,
    "usedAt" timestamp,
    "validatedById" uuid,
    "createdAt" timestamp DEFAULT now(),
    "updatedAt" timestamp DEFAULT now(),
    CONSTRAINT "FK_tickets_type" FOREIGN KEY ("ticketTypeId") REFERENCES "ticket_types"("id"),
    CONSTRAINT "FK_tickets_purchase" FOREIGN KEY ("purchaseId") REFERENCES "ticket_purchases"("id"),
    CONSTRAINT "FK_tickets_validator" FOREIGN KEY ("validatedById") REFERENCES "users"("id")
);
