// Tool to export wordlist to CSV for importing into a new instance
// Usage: node tools/export-wordlist.js > wordlist.csv

import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function exportWordlist() {
  const client = await pool.connect();

  try {
    const result = await client.query(`
      SELECT word, difficulty, scrabble_score, par
      FROM wordlist
      ORDER BY id
    `);

    // Output CSV header
    console.log('word,difficulty,scrabble_score,par');

    // Output CSV rows
    for (const row of result.rows) {
      console.log(`${row.word},${row.difficulty},${row.scrabble_score},${row.par}`);
    }

    // Log stats to stderr so it doesn't interfere with CSV output
    console.error(`\n✅ Exported ${result.rows.length} words`);
    console.error('💡 Tip: Save to file with: node tools/export-wordlist.js > wordlist.csv');

  } catch (err) {
    console.error('Error:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

exportWordlist().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
