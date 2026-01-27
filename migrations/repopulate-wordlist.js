// migrations/repopulate-wordlist.js
// Migration to repopulate the wordlist table from data/wordlist-table.txt
// This migration can be run anytime the master wordlist file is updated

import { Pool } from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

export async function up() {
  console.log("[Migration] Starting wordlist repopulation...");
  
  try {
    // Read the wordlist-table-cleaned.txt file
    const wordlistPath = path.join(__dirname, '..', 'data', 'wordlist-table-cleaned.txt');
    console.log(`[Migration] Reading from: ${wordlistPath}`);
    
    if (!fs.existsSync(wordlistPath)) {
      throw new Error(`Wordlist file not found at: ${wordlistPath}`);
    }
    
    const fileContent = fs.readFileSync(wordlistPath, 'utf-8');
    const lines = fileContent.split('\n').slice(1); // Skip header
    
    // Parse all valid words
    const words = [];
    let lineNumber = 2; // Start at 2 (1 is header)
    
    for (const line of lines) {
      if (!line.trim()) {
        lineNumber++;
        continue;
      }
      
      const parts = line.split('\t');
      if (parts.length < 4) {
        console.warn(`[Migration] Skipping line ${lineNumber}: not enough columns`);
        lineNumber++;
        continue;
      }
      
      const word = parts[0].trim().toUpperCase();
      const difficulty = parseFloat(parts[1]);
      const scrabbleScore = parseFloat(parts[2]);
      const par = parseInt(parts[3]);
      
      if (!word || word.length !== 5) {
        console.warn(`[Migration] Skipping line ${lineNumber}: invalid word "${word}"`);
        lineNumber++;
        continue;
      }
      
      if (isNaN(difficulty) || isNaN(scrabbleScore) || isNaN(par)) {
        console.warn(`[Migration] Skipping line ${lineNumber}: invalid numeric values`);
        lineNumber++;
        continue;
      }
      
      words.push({ word, difficulty, scrabbleScore, par });
      lineNumber++;
    }
    
    console.log(`[Migration] Parsed ${words.length} valid words from file`);
    
    // Begin transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Clear existing wordlist data
      console.log('[Migration] Clearing existing wordlist data...');
      const deleteResult = await client.query('DELETE FROM wordlist');
      console.log(`[Migration] Deleted ${deleteResult.rowCount} existing words`);
      
      // Insert in batches of 100 for better performance
      const batchSize = 100;
      let imported = 0;
      
      for (let i = 0; i < words.length; i += batchSize) {
        const batch = words.slice(i, i + batchSize);
        const values = [];
        const placeholders = [];
        
        batch.forEach((w, idx) => {
          const base = idx * 4;
          placeholders.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`);
          values.push(w.word, w.difficulty, w.scrabbleScore, w.par);
        });
        
        await client.query(`
          INSERT INTO wordlist (word, difficulty, scrabble_score, par)
          VALUES ${placeholders.join(', ')}
        `, values);
        
        imported += batch.length;
        console.log(`[Migration] Imported ${imported}/${words.length} words...`);
      }
      
      await client.query('COMMIT');
      
      // Get final statistics
      const stats = await client.query(`
        SELECT 
          COUNT(*) as total_words,
          MIN(par) as min_par,
          MAX(par) as max_par,
          AVG(difficulty)::numeric(10,2) as avg_difficulty
        FROM wordlist
      `);
      
      const distribution = await client.query(`
        SELECT par, COUNT(*) as count 
        FROM wordlist 
        GROUP BY par 
        ORDER BY par
      `);
      
      console.log('\n[Migration] ✓ Wordlist repopulation complete!');
      console.log(`[Migration] Total words: ${stats.rows[0].total_words}`);
      console.log(`[Migration] Par range: ${stats.rows[0].min_par} - ${stats.rows[0].max_par}`);
      console.log(`[Migration] Average difficulty: ${stats.rows[0].avg_difficulty}`);
      console.log('\n[Migration] Par distribution:');
      distribution.rows.forEach(row => {
        console.log(`  Par ${row.par}: ${row.count} words`);
      });
      
      return {
        success: true,
        imported,
        stats: stats.rows[0],
        distribution: distribution.rows
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
  }
}

export async function down() {
  console.log('[Migration] Rolling back wordlist repopulation...');
  console.log('[Migration] Note: This will delete all words from the wordlist table.');
  console.log('[Migration] To restore, you will need to run the migration again.');
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query('DELETE FROM wordlist');
    await client.query('COMMIT');
    console.log(`[Migration] Deleted ${result.rowCount} words from wordlist`);
    return { success: true, deleted: result.rowCount };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
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
