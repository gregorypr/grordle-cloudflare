// Run database migration
// Usage: node tools/run-migration.js migrations/001-add-multi-tenant-support.sql

import pg from "pg";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runMigration(filename) {
  if (!filename) {
    console.error('❌ Error: Migration file required');
    console.error('Usage: node tools/run-migration.js migrations/001-add-multi-tenant-support.sql');
    process.exit(1);
  }

  if (!fs.existsSync(filename)) {
    console.error(`❌ Error: File not found: ${filename}`);
    process.exit(1);
  }

  const client = await pool.connect();

  try {
    console.log(`📂 Reading migration: ${filename}\n`);
    const sql = fs.readFileSync(filename, 'utf-8');

    console.log('🔄 Running migration...\n');

    // Run the migration in a transaction
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');

    console.log('✅ Migration completed successfully!\n');

    // Show what was created
    console.log('📊 Verification:');

    const orgsTable = await client.query(
      "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'organizations')"
    );
    console.log(`  Organizations table: ${orgsTable.rows[0].exists ? '✓' : '✗'}`);

    const orgCol = await client.query(
      "SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'org_id')"
    );
    console.log(`  Players.org_id column: ${orgCol.rows[0].exists ? '✓' : '✗'}`);

    const existingPlayers = await client.query('SELECT COUNT(*) FROM players WHERE org_id IS NULL');
    console.log(`  Existing players (default tenant): ${existingPlayers.rows[0].count}`);

    console.log('\n💡 Next steps:');
    console.log('  1. Deploy updated code with tenant middleware');
    console.log('  2. Create new organizations via admin panel');
    console.log('  3. Point subdomains to Cloudflare Pages');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

const filename = process.argv[2];
runMigration(filename).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
