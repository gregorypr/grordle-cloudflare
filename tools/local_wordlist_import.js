// tools/local_wordlist_import.js
// Run this script locally to import the wordlist-table.txt into your database

import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

const filePath = path.join(__dirname, '../data/wordlist-table.txt');
const lines = fs.readFileSync(filePath, 'utf-8').split('\n');

(async () => {
  let imported = 0;
  let errors = 0;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split('\t');
    if (parts.length < 4) continue;
    const word = parts[0].trim().toUpperCase();
    const difficulty = parseFloat(parts[1]);
    const scrabbleScore = parseInt(parts[2]);
    const par = parseInt(parts[3]);
    if (!word || word.length !== 5 || isNaN(difficulty) || isNaN(scrabbleScore) || isNaN(par)) continue;
    try {
      await pool.query(
        `INSERT INTO wordlist (word, difficulty, scrabble_score, par)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (word) DO UPDATE SET
           difficulty = EXCLUDED.difficulty,
           scrabble_score = EXCLUDED.scrabble_score,
           par = EXCLUDED.par;`,
        [word, difficulty, scrabbleScore, par]
      );
      imported++;
      if (imported % 500 === 0) {
        console.log(`Imported ${imported} words...`);
      }
    } catch (err) {
      console.error(`Error importing line ${i}:`, err.message);
      errors++;
    }
  }
  const distribution = await pool.query('SELECT par, COUNT(*) as count FROM wordlist GROUP BY par ORDER BY par;');
  console.log('Import complete!');
  console.log(`Total: ${imported} words, ${errors} errors`);
  console.log('Distribution:', distribution.rows);
  await pool.end();
})();
