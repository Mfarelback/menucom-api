CREATE TABLE IF NOT EXISTS commerce (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "ownerId" VARCHAR NOT NULL,
  "businessName" VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  "businessType" VARCHAR(100),
  context VARCHAR NOT NULL,
  "logoUrl" VARCHAR,
  "coverImageUrl" VARCHAR,
  description TEXT,
  address VARCHAR,
  phone VARCHAR,
  "isActive" BOOLEAN DEFAULT true,
  metadata JSONB,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commerce_owner_id ON commerce("ownerId");
CREATE INDEX IF NOT EXISTS idx_commerce_business_type ON commerce("businessType");
