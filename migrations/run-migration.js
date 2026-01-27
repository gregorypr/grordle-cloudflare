#!/usr/bin/env node
// migrations/run-migration.js
// Migration runner script
// Usage: node migrations/run-migration.js <migration-name> [up|down]

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const migrationName = process.argv[2];
const direction = process.argv[3] || 'up';

if (!migrationName) {
  console.error('Usage: node migrations/run-migration.js <migration-name> [up|down]');
  console.error('\nAvailable migrations:');
  console.error('  - repopulate-wordlist : Repopulate wordlist table from data/wordlist-table.txt');
  process.exit(1);
}

if (direction !== 'up' && direction !== 'down') {
  console.error('Direction must be "up" or "down"');
  process.exit(1);
}

async function runMigration() {
  try {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Running migration: ${migrationName} (${direction})`);
    console.log('='.repeat(60));
    
    // Import the migration module
    const migrationPath = `./${migrationName}.js`;
    const migration = await import(migrationPath);
    
    if (!migration[direction]) {
      throw new Error(`Migration ${migrationName} does not have a ${direction} function`);
    }
    
    // Run the migration
    const result = await migration[direction]();
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`✓ Migration ${direction} completed successfully`);
    console.log('='.repeat(60));
    
    if (result) {
      console.log('\nResult:', JSON.stringify(result, null, 2));
    }
    
    process.exit(0);
  } catch (err) {
    console.error(`\n${'='.repeat(60)}`);
    console.error(`✗ Migration ${direction} failed`);
    console.error('='.repeat(60));
    console.error('\nError:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

runMigration();
