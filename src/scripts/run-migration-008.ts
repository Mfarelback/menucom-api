import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

async function run() {
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
    console.log('Connected to database');

    const migrationPath = path.join(
      __dirname,
      'migrations',
      '008_add_ticketTypeId_to_ticket_purchases.sql',
    );
    if (!fs.existsSync(migrationPath)) {
      console.error(`Migration file not found: ${migrationPath}`);
      process.exit(1);
    }

    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log(
      'Executing migration 008: Add ticketTypeId to ticket_purchases...',
    );
    await client.query(sql);
    console.log('Migration 008 completed successfully');
    console.log('');
    console.log('Changes applied:');
    console.log('  - Added column: ticket_purchases.ticketTypeId');
    console.log('  - Backfilled from tickets table');
    console.log('  - Added FK constraint to ticket_types');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
