// Tool to populate wordlist table from CSV or current database
// Usage: node tools/populate-wordlist.js

import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function populateWordlist() {
  const client = await pool.connect();

  try {
    console.log('Populating wordlist table...\n');

    // Check if wordlist already has data
    const existing = await client.query('SELECT COUNT(*) FROM wordlist');
    const count = parseInt(existing.rows[0].count);

    if (count > 0) {
      console.log(`⚠️  Wordlist already contains ${count} words.`);
      console.log('This script will NOT overwrite existing data.');
      console.log('\nTo repopulate:');
      console.log('  1. Backup your database first!');
      console.log('  2. Run: DELETE FROM wordlist;');
      console.log('  3. Then run this script again.\n');
      return;
    }

    console.log('📝 Note: This is a placeholder script.');
    console.log('You need to populate the wordlist from your data source.\n');

    console.log('Options:');
    console.log('  1. Import from CSV file (see DEPLOYMENT_GUIDE.md)');
    console.log('  2. Copy from existing database');
    console.log('  3. Add custom word list\n');

    console.log('Example - Adding test words:');
    console.log('----------------------------------');

    const testWords = [
      { word: 'HELLO', difficulty: 10.5, scrabble_score: 8, par: 3 },
      { word: 'WORLD', difficulty: 12.3, scrabble_score: 9, par: 3 },
      { word: 'GAMES', difficulty: 15.2, scrabble_score: 8, par: 3 },
      { word: 'WORDS', difficulty: 18.4, scrabble_score: 9, par: 4 },
      { word: 'STONE', difficulty: 14.7, scrabble_score: 5, par: 3 },
      { word: 'LUNAR', difficulty: 16.8, scrabble_score: 5, par: 3 },
    ];

    console.log('Inserting test words...\n');
    for (const w of testWords) {
      await client.query(
        'INSERT INTO wordlist (word, difficulty, scrabble_score, par) VALUES ($1, $2, $3, $4)',
        [w.word, w.difficulty, w.scrabble_score, w.par]
      );
      console.log(`  ✓ ${w.word} (difficulty: ${w.difficulty}, par: ${w.par})`);
    }

    const final = await client.query('SELECT COUNT(*) FROM wordlist');
    console.log(`\n✅ Wordlist populated with ${final.rows[0].count} words.`);
    console.log('\n⚠️  Note: For production, you should import a full wordlist!');

  } catch (err) {
    console.error('Error:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

populateWordlist().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
