// migrations/add-password-reset-required.js
// Migration to add password_reset_required column to players table
// This column tracks whether a user needs to reset their password on next login

import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

export async function up() {
  console.log("[Migration] Adding password_reset_required column to players table...");
  
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Add password_reset_required column if it doesn't exist
      await client.query(`
        ALTER TABLE players 
        ADD COLUMN IF NOT EXISTS password_reset_required BOOLEAN DEFAULT FALSE;
      `);
      
      // Set default value for existing users
      await client.query(`
        UPDATE players 
        SET password_reset_required = FALSE 
        WHERE password_reset_required IS NULL;
      `);
      
      await client.query('COMMIT');
      
      console.log('[Migration] ✓ Successfully added password_reset_required column');
      
      // Get count of affected rows
      const result = await client.query(`
        SELECT COUNT(*) as player_count 
        FROM players
      `);
      
      console.log(`[Migration] Total players in database: ${result.rows[0].player_count}`);
      
      return {
        success: true,
        message: 'password_reset_required column added successfully'
      };
      
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    
  } catch (err) {
    console.error('[Migration] Error:', err.message);
    throw err;
  } finally {
    await pool.end();
  }
}

export async function down() {
  console.log('[Migration] Removing password_reset_required column from players table...');
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    await client.query(`
      ALTER TABLE players 
      DROP COLUMN IF EXISTS password_reset_required;
    `);
    
    await client.query('COMMIT');
    
    console.log('[Migration] ✓ Successfully removed password_reset_required column');
    
    return {
      success: true,
      message: 'password_reset_required column removed successfully'
    };
    
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

// If run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2] || 'up';
  
  if (command === 'up') {
    up()
      .then(() => {
        console.log('\n[Migration] Migration completed successfully');
        process.exit(0);
      })
      .catch((err) => {
        console.error('\n[Migration] Migration failed:', err);
        process.exit(1);
      });
  } else if (command === 'down') {
    down()
      .then(() => {
        console.log('\n[Migration] Rollback completed successfully');
        process.exit(0);
      })
      .catch((err) => {
        console.error('\n[Migration] Rollback failed:', err);
        process.exit(1);
      });
  } else {
    console.error('Unknown command. Use "up" or "down"');
    process.exit(1);
  }
}
