CREATE TABLE IF NOT EXISTS notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  title VARCHAR(200) NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  "deepLink" VARCHAR(500),
  "imageUrl" VARCHAR(2048),
  "isActive" BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_templates_name ON notification_templates(name);
CREATE INDEX IF NOT EXISTS idx_notification_templates_active ON notification_templates("isActive") WHERE "isActive" = true;

CREATE INDEX IF NOT EXISTS idx_user_fcm_token ON "user"("fcmToken") WHERE "fcmToken" IS NOT NULL;
