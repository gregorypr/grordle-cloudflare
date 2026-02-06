// Tool to import wordlist from CSV file
// Usage: node tools/import-wordlist.js wordlist.csv

import pg from "pg";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function importWordlist(filename) {
  if (!filename) {
    console.error('❌ Error: CSV filename required');
    console.error('Usage: node tools/import-wordlist.js wordlist.csv');
    process.exit(1);
  }

  if (!fs.existsSync(filename)) {
    console.error(`❌ Error: File not found: ${filename}`);
    process.exit(1);
  }

  const client = await pool.connect();

  try {
    console.log(`📂 Reading ${filename}...`);
    const csv = fs.readFileSync(filename, 'utf-8');
    const lines = csv.split('\n').filter(line => line.trim());

    // Skip header row
    const header = lines[0];
    console.log(`Header: ${header}\n`);

    const dataLines = lines.slice(1);
    console.log(`Found ${dataLines.length} words to import\n`);

    // Check if wordlist already has data
    const existing = await client.query('SELECT COUNT(*) FROM wordlist');
    const count = parseInt(existing.rows[0].count);

    if (count > 0) {
      console.log(`⚠️  Warning: Wordlist already contains ${count} words.`);
      console.log('This will ADD to existing data (duplicates will be skipped).\n');
    }

    let imported = 0;
    let skipped = 0;
    let errors = 0;

    console.log('Importing...');
    for (const line of dataLines) {
      if (!line.trim()) continue;

      const [word, difficulty, scrabble_score, par] = line.split(',').map(s => s.trim());

      if (!word || !difficulty || !scrabble_score || !par) {
        console.error(`  ⚠️  Skipping invalid line: ${line}`);
        errors++;
        continue;
      }

      try {
        await client.query(
          'INSERT INTO wordlist (word, difficulty, scrabble_score, par) VALUES ($1, $2, $3, $4) ON CONFLICT (word) DO NOTHING',
          [word, parseFloat(difficulty), parseFloat(scrabble_score), parseInt(par)]
        );
        imported++;
        if (imported % 100 === 0) {
          console.log(`  ✓ Imported ${imported} words...`);
        }
      } catch (err) {
        if (err.code === '23505') { // Unique constraint violation
          skipped++;
        } else {
          console.error(`  ❌ Error importing ${word}:`, err.message);
          errors++;
        }
      }
    }

    const final = await client.query('SELECT COUNT(*) FROM wordlist');

    console.log('\n📊 Import Summary:');
    console.log(`  ✅ Successfully imported: ${imported}`);
    if (skipped > 0) console.log(`  ⏭️  Skipped (duplicates): ${skipped}`);
    if (errors > 0) console.log(`  ❌ Errors: ${errors}`);
    console.log(`  📚 Total words in database: ${final.rows[0].count}`);

  } catch (err) {
    console.error('Fatal error:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

const filename = process.argv[2];
importWordlist(filename).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
