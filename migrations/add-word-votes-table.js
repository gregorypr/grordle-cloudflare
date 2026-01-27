// migrations/add-word-votes-table.js
// Migration to add the word_votes table for word voting feature

import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

export async function up() {
  console.log("[Migration] Creating word_votes table...");
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      CREATE TABLE IF NOT EXISTS word_votes (
        word VARCHAR(32) NOT NULL,
        username VARCHAR(64) NOT NULL,
        vote VARCHAR(8) NOT NULL CHECK (vote IN ('up', 'down')),
        date DATE NOT NULL,
        game_type VARCHAR(16) NOT NULL,
        PRIMARY KEY (word, username, date, game_type)
      );
    `);
    await client.query('COMMIT');
    console.log("[Migration] word_votes table created.");
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function down() {
  console.log("[Migration] Dropping word_votes table...");
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DROP TABLE IF EXISTS word_votes;');
    await client.query('COMMIT');
    console.log("[Migration] word_votes table dropped.");
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
