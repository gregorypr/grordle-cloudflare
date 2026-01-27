// migrations/add-golf-tables.js
// Migration to add daily_golf_course and wordlist tables required for Golf mode
// These tables are used to store daily golf courses and the word database

import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

export async function up() {
  console.log("[Migration] Adding Golf mode tables (daily_golf_course and wordlist)...");
  
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // 1. Create wordlist table
      console.log('[Migration] Creating wordlist table...');
      await client.query(`
        CREATE TABLE IF NOT EXISTS wordlist (
          id SERIAL PRIMARY KEY,
          word TEXT NOT NULL UNIQUE,
          difficulty NUMERIC(10,2),
          scrabble_score NUMERIC(10,2),
          par INTEGER
        );
      `);

      // Create indexes on wordlist
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_wordlist_word ON wordlist(word);
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_wordlist_par ON wordlist(par);
      `);

      // 2. Create daily_golf_course table
      console.log('[Migration] Creating daily_golf_course table...');
      await client.query(`
        CREATE TABLE IF NOT EXISTS daily_golf_course (
          id SERIAL PRIMARY KEY,
          course_date DATE NOT NULL,
          hole_number INTEGER NOT NULL CHECK (hole_number >= 1 AND hole_number <= 9),
          target_word TEXT NOT NULL,
          start_word TEXT NOT NULL,
          par INTEGER NOT NULL,
          UNIQUE(course_date, hole_number)
        );
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_daily_golf_course_date ON daily_golf_course(course_date);
      `);

      await client.query('COMMIT');
      
      console.log('[Migration] ✓ Successfully created Golf mode tables');
      
      // Get counts
      const wordlistCount = await client.query(`SELECT COUNT(*) as count FROM wordlist`);
      const courseCount = await client.query(`SELECT COUNT(DISTINCT course_date) as count FROM daily_golf_course`);
      
      console.log(`[Migration] Wordlist entries: ${wordlistCount.rows[0].count}`);
      console.log(`[Migration] Daily courses: ${courseCount.rows[0].count}`);
      console.log('[Migration] Note: You may need to populate the wordlist table using the populate-wordlist or repopulate-wordlist migration.');
      
      return {
        success: true,
        message: 'Golf mode tables created successfully'
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
  console.log('[Migration] Removing Golf mode tables...');
  console.log('[Migration] WARNING: This will delete all wordlist and daily course data!');
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Drop tables in reverse order (respecting dependencies)
    await client.query(`DROP TABLE IF EXISTS daily_golf_course CASCADE;`);
    await client.query(`DROP TABLE IF EXISTS wordlist CASCADE;`);
    
    await client.query('COMMIT');
    
    console.log('[Migration] ✓ Successfully removed Golf mode tables');
    
    return {
      success: true,
      message: 'Golf mode tables removed successfully'
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
