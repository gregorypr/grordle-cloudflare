# Database Migrations

This directory contains database migration scripts for the Grordle project.

## Available Migrations

### add-golf-tables

Adds the `wordlist` and `daily_golf_course` tables required for Golf mode.

**When to use:**

- When setting up a new database instance that needs Golf mode
- If you encounter errors about missing `daily_golf_course` or `wordlist` tables
- When migrating from a database that predates Golf mode

**What it does:**

- Creates the `wordlist` table to store all 5-letter words with their difficulty, scrabble score, and par values
- Creates the `daily_golf_course` table to store daily golf courses
- Adds appropriate indexes for performance
- Note: After running this migration, you should run `repopulate-wordlist` to populate the wordlist table

### add-password-reset-required

Adds the `password_reset_required` column to the `players` table.

**When to use:**

- When setting up a new database instance from an older version
- If you encounter errors about the missing `password_reset_required` column
- When migrating from a database that predates this feature

**What it does:**

- Adds `password_reset_required BOOLEAN DEFAULT FALSE` column to the players table
- Sets the default value to FALSE for all existing players
- Allows the password reset functionality to work correctly

### repopulate-wordlist

Repopulates the `wordlist` table from the master data file (`data/wordlist-table.txt`).

**When to use:**
- After updating the wordlist-table.txt file (e.g., removing plurals, adding new words)
- When you need to reset the wordlist to match the master data
- After database corruption or data issues

**What it does:**
- Reads all words from `data/wordlist-table.txt`
- Deletes all existing words from the `wordlist` table
- Inserts all words from the file in a single transaction
- Validates word format (must be 5 letters)
- Validates numeric fields (difficulty, scrabble_score, par)
- Provides statistics on the migration

## Running Migrations

### Using the migration runner (recommended)

```bash
# Run a migration forward (up)
node migrations/run-migration.js repopulate-wordlist up

# Rollback a migration (down)
node migrations/run-migration.js repopulate-wordlist down
```

### Running migrations directly

```bash
# Run the migration
node migrations/repopulate-wordlist.js up

# Rollback the migration
node migrations/repopulate-wordlist.js down
```

### Using npm scripts

Add these to your `package.json` scripts section for convenience:

```json
{
  "scripts": {
    "migrate:wordlist": "node migrations/run-migration.js repopulate-wordlist up",
    "migrate:wordlist:rollback": "node migrations/run-migration.js repopulate-wordlist down"
  }
}
```

Then run:
```bash
npm run migrate:wordlist
```

## Migration Safety

- All migrations run in a database transaction
- If any error occurs, changes are automatically rolled back
- The migration validates data before inserting
- Detailed logging helps track progress and debug issues

## Environment Setup

Make sure your `.env` file contains:
```
DATABASE_URL=your_postgres_connection_string
```

## Example Output

```
============================================================
Running migration: repopulate-wordlist (up)
============================================================
[Migration] Starting wordlist repopulation...
[Migration] Reading from: /path/to/data/wordlist-table.txt
[Migration] Parsed 2153 valid words from file
[Migration] Clearing existing wordlist data...
[Migration] Deleted 2867 existing words
[Migration] Imported 100/2153 words...
[Migration] Imported 200/2153 words...
...
[Migration] Imported 2153/2153 words...

[Migration] ✓ Wordlist repopulation complete!
[Migration] Total words: 2153
[Migration] Par range: 3 - 5
[Migration] Average difficulty: 12.45

[Migration] Par distribution:
  Par 3: 1520 words
  Par 4: 543 words
  Par 5: 90 words

============================================================
✓ Migration up completed successfully
============================================================
```

## Adding New Migrations

To create a new migration:

1. Create a new file in the `migrations/` directory
2. Export `up()` and `down()` functions
3. Use transactions for data safety
4. Add error handling and logging
5. Document the migration in this README

Example structure:
```javascript
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

export async function up() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Your migration code here
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function down() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Your rollback code here
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
```
