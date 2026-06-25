import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

/**
 * Script de migración para crear la tabla commerce y migrar datos existentes
 *
 * Para cada usuario con catálogos (merchant), crea un registro en la tabla commerce
 * usando los campos de negocio del usuario (businessName, slug, etc.) o valores por defecto.
 */

const BUSINESS_TYPE_MAPPING: Record<string, { context: string }> = {
  menu: { context: 'restaurant' },
  wardrobe: { context: 'wardrobe' },
  product_list: { context: 'marketplace' },
  service_list: { context: 'marketplace' },
  marketplace: { context: 'marketplace' },
};

function mapCatalogTypeToContext(catalogType: string): string {
  return BUSINESS_TYPE_MAPPING[catalogType]?.context || 'general';
}

async function migrateOwnerCommerce() {
  const url = process.env.POSTGRESQL_URL;
  if (!url) {
    console.error('POSTGRESQL_URL not found in .env');
    process.exit(1);
  }

  const client = new Client({
    connectionString: url,
    ssl: url.includes('localhost') ? false : { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('Connected to database\n');

    // ==========================================
    // 1. APPLY DDL
    // ==========================================
    console.log('Phase 1: Applying DDL (commerce table)...');
    const ddlPath = path.join(
      __dirname,
      'migrations',
      '009_create_commerce_table.sql',
    );
    if (!fs.existsSync(ddlPath)) {
      console.error(`Migration file not found: ${ddlPath}`);
      process.exit(1);
    }

    const ddlSql = fs.readFileSync(ddlPath, 'utf8');
    await client.query(ddlSql);
    console.log('DDL applied successfully\n');

    // ==========================================
    // 2. MIGRATE EXISTING USERS WITH CATALOGS
    // ==========================================
    console.log('Phase 2: Migrating existing merchants...');

    const merchantsResult = await client.query(`
      SELECT DISTINCT
        u.id,
        u.name,
        u.email,
        u."businessName",
        u.slug,
        u."businessDescription" as description,
        u."coverImageUrl",
        u."businessPhone" as phone,
        c."catalogType" as catalog_type
      FROM "user" u
      INNER JOIN catalogs c ON u.id = c."ownerId"
      WHERE NOT EXISTS (
        SELECT 1 FROM commerce co WHERE co."ownerId" = u.id
      )
      ORDER BY u.id
    `);

    console.log(`Found ${merchantsResult.rows.length} merchants to migrate\n`);

    let created = 0;
    let skipped = 0;

    for (const merchant of merchantsResult.rows) {
      const context = mapCatalogTypeToContext(merchant.catalog_type);
      const businessName =
        merchant.businessName || merchant.name || 'Mi Negocio';
      const slug =
        merchant.slug ||
        businessName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '') ||
        `negocio-${merchant.id.substring(0, 8)}`;

      const existingSlug = await client.query(
        'SELECT id FROM commerce WHERE slug = $1',
        [slug],
      );

      if (existingSlug.rows.length > 0) {
        console.log(
          `  Skipped ${merchant.email || merchant.id}: slug conflict (${slug})`,
        );
        skipped++;
        continue;
      }

      try {
        await client.query(
          `
          INSERT INTO commerce (id, "ownerId", "businessName", slug, "businessType", context, "coverImageUrl", description, phone)
          VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8)
        `,
          [
            merchant.id,
            businessName,
            slug,
            merchant.catalog_type,
            context,
            merchant.coverImageUrl || null,
            merchant.description || null,
            merchant.phone || null,
          ],
        );

        console.log(
          `  Created commerce for ${merchant.email || merchant.id} (${businessName})`,
        );
        created++;
      } catch (err) {
        console.error(
          `  Failed for ${merchant.email || merchant.id}:`,
          err.message,
        );
        skipped++;
      }
    }

    console.log(`\nPhase 2 complete: ${created} created, ${skipped} skipped\n`);

    // ==========================================
    // 3. UPDATE USER_ROLES WITH COMMERCE ID
    // ==========================================
    console.log('Phase 3: Updating user_roles with commerce resourceId...');

    const result = await client.query(`
      UPDATE user_roles ur
      SET resource_id = c.id,
          metadata = COALESCE(ur.metadata, '{}'::jsonb) || jsonb_build_object('commerceId', c.id, 'migratedAt', NOW()::text)
      FROM commerce c
      WHERE ur.user_id = c."ownerId"
        AND ur.role = 'owner'
        AND ur.context = c.context
        AND ur.resource_id IS NULL
    `);

    console.log(
      `Updated ${result.rowCount} user_roles with commerce resourceId\n`,
    );

    // ==========================================
    // 4. REPORT
    // ==========================================
    const totalCommerce = await client.query(
      'SELECT COUNT(*) as count FROM commerce',
    );
    console.log(`Total commerce records: ${totalCommerce.rows[0].count}`);
    console.log('Migration completed successfully!');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrateOwnerCommerce().catch(console.error);
