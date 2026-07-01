-- Migration 019: Crear tabla business_profiles
CREATE TABLE IF NOT EXISTS business_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "commerceId" VARCHAR NOT NULL,
  hours JSONB,
  "socialLinks" JSONB,
  certifications TEXT[],
  bio TEXT,
  coverage TEXT,
  policies JSONB,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW(),
  CONSTRAINT fk_commerce FOREIGN KEY ("commerceId") REFERENCES commerce(id) ON DELETE CASCADE
);

CREATE INDEX idx_business_profiles_commerce_id ON business_profiles("commerceId");

-- Auto-crear perfil para comercios existentes que no tengan uno
INSERT INTO business_profiles ("commerceId", "createdAt", "updatedAt")
SELECT id, NOW(), NOW() FROM commerce c
WHERE NOT EXISTS (SELECT 1 FROM business_profiles bp WHERE bp."commerceId" = c.id);
