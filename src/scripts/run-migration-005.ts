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
      '005_add_merchant_config_and_net_amount.sql',
    );
    if (!fs.existsSync(migrationPath)) {
      console.error(`Migration file not found: ${migrationPath}`);
      process.exit(1);
    }

    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log(
      'Executing migration 005: Add Merchant Config and Net Amount...',
    );
    await client.query(sql);
    console.log('Migration 005 completed successfully');
    console.log('');
    console.log('Changes applied:');
    console.log('  - Created table: merchant_configs');
    console.log('  - Added column: ticket_purchases.netAmount');
    console.log('  - Created indexes for performance');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
