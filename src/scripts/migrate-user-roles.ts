import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Script de migración para corregir roles de usuarios existentes
 * 
 * Este script identifica usuarios basándose en su actividad y les asigna
 * los roles correctos según el nuevo sistema de contextos.
 */

async function migrateUserRoles() {
  const url = process.env.POSTGRESQL_URL;
  if (!url) {
    console.error('❌ POSTGRESQL_URL not found in .env');
    process.exit(1);
  }

  const client = new Client({
    connectionString: url,
    ssl: url.includes('localhost') ? false : { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    let migratedCount = 0;
    let skippedCount = 0;

    // ==========================================
    // 1. MIGRAR ORGANIZADORES DE EVENTOS
    // Usuarios que tienen eventos creados
    // ==========================================
    console.log('🎪 Phase 1: Migrating Event Organizers...');
    
    const eventOrganizers = await client.query(`
      SELECT DISTINCT u.id, u.email, u.name
      FROM public.user u
      INNER JOIN events e ON u.id = e."organizerId"
      WHERE NOT EXISTS (
        SELECT 1 FROM user_roles ur 
        WHERE ur.user_id = u.id 
        AND ur.role = 'owner' 
        AND ur.context = 'events'
      )
    `);

    for (const user of eventOrganizers.rows) {
      // Verificar si ya tiene el rol
      const existing = await client.query(`
        SELECT id FROM user_roles 
        WHERE user_id = $1 
        AND role = 'owner' 
        AND context = 'events'
      `, [user.id]);

      if (existing.rows.length === 0) {
        // Crear rol OWNER en EVENTS
        await client.query(`
          INSERT INTO user_roles (id, user_id, role, context, resource_id, is_active, granted_by, metadata, granted_at)
          VALUES (
            gen_random_uuid(), 
            $1, 
            'owner', 
            'events', 
            NULL, 
            true, 
            'migration-script-2026',
            $2,
            NOW()
          )
        `, [
          user.id,
          JSON.stringify({ 
            reason: 'user_has_events', 
            migratedAt: new Date().toISOString(),
            source: 'migration-script' 
          })
        ]);

        // También darle CUSTOMER en GENERAL para que pueda comprar
        const existingCustomer = await client.query(`
          SELECT id FROM user_roles 
          WHERE user_id = $1 
          AND role = 'customer' 
          AND context = 'general'
        `, [user.id]);

        if (existingCustomer.rows.length === 0) {
          await client.query(`
            INSERT INTO user_roles (id, user_id, role, context, resource_id, is_active, granted_by, metadata, granted_at)
            VALUES (
              gen_random_uuid(), 
              $1, 
              'customer', 
              'general', 
              NULL, 
              true, 
              'migration-script-2026',
              $2,
              NOW()
            )
          `, [
            user.id,
            JSON.stringify({ 
              reason: 'dual_role_for_merchant', 
              migratedAt: new Date().toISOString() 
            })
          ]);
        }

        console.log(`  ✅ Migrated event organizer: ${user.email} (${user.name})`);
        migratedCount++;
      } else {
        console.log(`  ⏭️  Skipped (already has role): ${user.email}`);
        skippedCount++;
      }
    }

    console.log(`   Phase 1 complete: ${migratedCount} migrated, ${skippedCount} skipped\n`);
    migratedCount = 0;
    skippedCount = 0;

    // ==========================================
    // 2. MIGRAR DUEÑOS DE RESTAURANTES
    // Usuarios que tienen catálogos de tipo food/dinning
    // ==========================================
    console.log('🍽️  Phase 2: Migrating Restaurant Owners...');
    
    const restaurantOwners = await client.query(`
      SELECT DISTINCT u.id, u.email, u.name
      FROM public.user u
      INNER JOIN catalogs c ON u.id = c."userId"
      WHERE c.type IN ('food', 'dinning')
      AND NOT EXISTS (
        SELECT 1 FROM user_roles ur 
        WHERE ur.user_id = u.id 
        AND ur.role = 'owner' 
        AND ur.context = 'restaurant'
      )
    `);

    for (const user of restaurantOwners.rows) {
      const existing = await client.query(`
        SELECT id FROM user_roles 
        WHERE user_id = $1 
        AND role = 'owner' 
        AND context = 'restaurant'
      `, [user.id]);

      if (existing.rows.length === 0) {
        await client.query(`
          INSERT INTO user_roles (id, user_id, role, context, resource_id, is_active, granted_by, metadata, granted_at)
          VALUES (
            gen_random_uuid(), 
            $1, 
            'owner', 
            'restaurant', 
            NULL, 
            true, 
            'migration-script-2026',
            $2,
            NOW()
          )
        `, [
          user.id,
          JSON.stringify({ 
            reason: 'user_has_restaurant_catalog', 
            migratedAt: new Date().toISOString() 
          })
        ]);

        // Darle CUSTOMER también
        const existingCustomer = await client.query(`
          SELECT id FROM user_roles 
          WHERE user_id = $1 
          AND role = 'customer' 
          AND context = 'general'
        `, [user.id]);

        if (existingCustomer.rows.length === 0) {
          await client.query(`
            INSERT INTO user_roles (id, user_id, role, context, resource_id, is_active, granted_by, metadata, granted_at)
            VALUES (
              gen_random_uuid(), 
              $1, 
              'customer', 
              'general', 
              NULL, 
              true, 
              'migration-script-2026',
              $2,
              NOW()
            )
          `, [
            user.id,
            JSON.stringify({ 
              reason: 'dual_role_for_merchant', 
              migratedAt: new Date().toISOString() 
            })
          ]);
        }

        console.log(`  ✅ Migrated restaurant owner: ${user.email} (${user.name})`);
        migratedCount++;
      } else {
        console.log(`  ⏭️  Skipped (already has role): ${user.email}`);
        skippedCount++;
      }
    }

    console.log(`   Phase 2 complete: ${migratedCount} migrated, ${skippedCount} skipped\n`);
    migratedCount = 0;
    skippedCount = 0;

    // ==========================================
    // 3. MIGRAR DUEÑOS DE TIENDAS (WARDROBE)
    // Usuarios con catálogos de tipo clothes
    // ==========================================
    console.log('👔 Phase 3: Migrating Wardrobe Owners...');
    
    const wardrobeOwners = await client.query(`
      SELECT DISTINCT u.id, u.email, u.name
      FROM public.user u
      INNER JOIN catalogs c ON u.id = c."userId"
      WHERE c.type = 'clothes'
      AND NOT EXISTS (
        SELECT 1 FROM user_roles ur 
        WHERE ur.user_id = u.id 
        AND ur.role = 'owner' 
        AND ur.context = 'wardrobe'
      )
    `);

    for (const user of wardrobeOwners.rows) {
      const existing = await client.query(`
        SELECT id FROM user_roles 
        WHERE user_id = $1 
        AND role = 'owner' 
        AND context = 'wardrobe'
      `, [user.id]);

      if (existing.rows.length === 0) {
        await client.query(`
          INSERT INTO user_roles (id, user_id, role, context, resource_id, is_active, granted_by, metadata, granted_at)
          VALUES (
            gen_random_uuid(), 
            $1, 
            'owner', 
            'wardrobe', 
            NULL, 
            true, 
            'migration-script-2026',
            $2,
            NOW()
          )
        `, [
          user.id,
          JSON.stringify({ 
            reason: 'user_has_wardrobe_catalog', 
            migratedAt: new Date().toISOString() 
          })
        ]);

        console.log(`  ✅ Migrated wardrobe owner: ${user.email} (${user.name})`);
        migratedCount++;
      } else {
        console.log(`  ⏭️  Skipped (already has role): ${user.email}`);
        skippedCount++;
      }
    }

    console.log(`   Phase 3 complete: ${migratedCount} migrated, ${skippedCount} skipped\n`);
    migratedCount = 0;
    skippedCount = 0;

    // ==========================================
    // 4. MIGRAR VENDEDORES DE MARKETPLACE
    // Usuarios con catálogos de tipo retail, grocery, electronics, etc.
    // ==========================================
    console.log('🏪 Phase 4: Migrating Marketplace Owners...');
    
    const marketplaceOwners = await client.query(`
      SELECT DISTINCT u.id, u.email, u.name
      FROM public.user u
      INNER JOIN catalogs c ON u.id = c."userId"
      WHERE c.type IN ('retail', 'grocery', 'electronics', 'accessories', 'pharmacy', 'beauty', 'construction', 'automotive', 'pets', 'water_distributor')
      AND NOT EXISTS (
        SELECT 1 FROM user_roles ur 
        WHERE ur.user_id = u.id 
        AND ur.role = 'owner' 
        AND ur.context = 'marketplace'
      )
    `);

    for (const user of marketplaceOwners.rows) {
      const existing = await client.query(`
        SELECT id FROM user_roles 
        WHERE user_id = $1 
        AND role = 'owner' 
        AND context = 'marketplace'
      `, [user.id]);

      if (existing.rows.length === 0) {
        await client.query(`
          INSERT INTO user_roles (id, user_id, role, context, resource_id, is_active, granted_by, metadata, granted_at)
          VALUES (
            gen_random_uuid(), 
            $1, 
            'owner', 
            'marketplace', 
            NULL, 
            true, 
            'migration-script-2026',
            $2,
            NOW()
          )
        `, [
          user.id,
          JSON.stringify({ 
            reason: 'user_has_marketplace_catalog', 
            migratedAt: new Date().toISOString() 
          })
        ]);

        console.log(`  ✅ Migrated marketplace owner: ${user.email} (${user.name})`);
        migratedCount++;
      } else {
        console.log(`  ⏭️  Skipped (already has role): ${user.email}`);
        skippedCount++;
      }
    }

    console.log(`   Phase 4 complete: ${migratedCount} migrated, ${skippedCount} skipped\n`);
    migratedCount = 0;
    skippedCount = 0;

    // ==========================================
    // 5. MIGRAR ADMINS DEL SISTEMA
    // Usuarios con role = 'admin' en tabla user
    // ==========================================
    console.log('👑 Phase 5: Migrating System Admins...');
    
    const admins = await client.query(`
      SELECT id, email, name
      FROM public.user
      WHERE role = 'admin'
      AND NOT EXISTS (
        SELECT 1 FROM user_roles ur 
        WHERE ur.user_id = public.user.id 
        AND ur.role = 'admin' 
        AND ur.context = 'general'
      )
    `);

    for (const user of admins.rows) {
      const existing = await client.query(`
        SELECT id FROM user_roles 
        WHERE user_id = $1 
        AND role = 'admin' 
        AND context = 'general'
      `, [user.id]);

      if (existing.rows.length === 0) {
        await client.query(`
          INSERT INTO user_roles (id, user_id, role, context, resource_id, is_active, granted_by, metadata, granted_at)
          VALUES (
            gen_random_uuid(), 
            $1, 
            'admin', 
            'general', 
            NULL, 
            true, 
            'migration-script-2026',
            $2,
            NOW()
          )
        `, [
          user.id,
          JSON.stringify({ 
            reason: 'user_is_system_admin', 
            migratedAt: new Date().toISOString() 
          })
        ]);

        console.log(`  ✅ Migrated admin: ${user.email} (${user.name})`);
        migratedCount++;
      } else {
        console.log(`  ⏭️  Skipped (already has role): ${user.email}`);
        skippedCount++;
      }
    }

    console.log(`   Phase 5 complete: ${migratedCount} migrated, ${skippedCount} skipped\n`);

    // ==========================================
    // 6. REPORTE FINAL
    // ==========================================
    console.log('📊 Final Report:\n');
    
    const summary = await client.query(`
      SELECT 
        role,
        context,
        COUNT(*) as count
      FROM user_roles
      WHERE granted_by = 'migration-script-2026'
      GROUP BY role, context
      ORDER BY context, role
    `);

    console.log('New roles created by this migration:');
    for (const row of summary.rows) {
      console.log(`  • ${row.role} in ${row.context}: ${row.count} users`);
    }

    const totalUsers = await client.query(`
      SELECT COUNT(DISTINCT user_id) as total
      FROM user_roles
      WHERE granted_by = 'migration-script-2026'
    `);

    console.log(`\n👥 Total users migrated: ${totalUsers.rows[0].total}`);
    console.log('\n✅ Migration completed successfully!');

  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Ejecutar migración
migrateUserRoles().catch(console.error);
