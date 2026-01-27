// api/migrate-wordlist.js
// API endpoint to trigger wordlist migration from data/wordlist-table-cleaned.txt
// This reads the local file and repopulates the database

import { Pool } from "pg";
import fs from "fs";
import path from "path";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export default async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { adminPassword } = req.body || {};
    
    // Require admin password for safety
    if (adminPassword !== "admin123") {
      return res.status(403).json({ error: "Invalid admin password" });
    }

    console.log("[migrate-wordlist] Starting wordlist migration...");

    // Read the wordlist-table-cleaned.txt file from the data directory
    const wordlistPath = path.join(process.cwd(), 'data', 'wordlist-table-cleaned.txt');
    console.log(`[migrate-wordlist] Reading from: ${wordlistPath}`);
    
    if (!fs.existsSync(wordlistPath)) {
      return res.status(500).json({ 
        error: `Wordlist file not found at: ${wordlistPath}`,
        note: "Make sure data/wordlist-table-cleaned.txt is deployed with your application"
      });
    }
    
    const fileContent = fs.readFileSync(wordlistPath, 'utf-8');
    const lines = fileContent.split('\n').slice(1); // Skip header
    
    // Parse all valid words
    const words = [];
    let lineNumber = 2; // Start at 2 (1 is header)
    const warnings = [];
    
    for (const line of lines) {
      if (!line.trim()) {
        lineNumber++;
        continue;
      }
      
      const parts = line.split('\t');
      if (parts.length < 4) {
        warnings.push(`Line ${lineNumber}: not enough columns`);
        lineNumber++;
        continue;
      }
      
      const word = parts[0].trim().toUpperCase();
      const difficulty = parseFloat(parts[1]);
      const scrabbleScore = parseFloat(parts[2]);
      const par = parseInt(parts[3]);
      
      if (!word || word.length !== 5) {
        warnings.push(`Line ${lineNumber}: invalid word "${word}"`);
        lineNumber++;
        continue;
      }
      
      if (isNaN(difficulty) || isNaN(scrabbleScore) || isNaN(par)) {
        warnings.push(`Line ${lineNumber}: invalid numeric values`);
        lineNumber++;
        continue;
      }
      
      words.push({ word, difficulty, scrabbleScore, par });
      lineNumber++;
    }
    
    console.log(`[migrate-wordlist] Parsed ${words.length} valid words from file`);
    if (warnings.length > 0 && warnings.length <= 10) {
      console.log(`[migrate-wordlist] Warnings:`, warnings);
    }
    
    // Begin transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Clear existing wordlist data
      console.log('[migrate-wordlist] Clearing existing wordlist data...');
      const deleteResult = await client.query('DELETE FROM wordlist');
      console.log(`[migrate-wordlist] Deleted ${deleteResult.rowCount} existing words`);
      
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
        console.log(`[migrate-wordlist] Imported ${imported}/${words.length} words...`);
      }
      
      await client.query('COMMIT');

      // Rebuild indexes and update statistics for optimal query performance
      console.log('[migrate-wordlist] Rebuilding indexes and updating statistics...');
      await client.query('REINDEX TABLE wordlist');
      await client.query('ANALYZE wordlist');

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
      
      console.log('[migrate-wordlist] Migration complete!');
      console.log(`[migrate-wordlist] Total words: ${stats.rows[0].total_words}`);
      
      return res.status(200).json({
        ok: true,
        message: "Wordlist migration completed successfully",
        deletedCount: deleteResult.rowCount,
        importedCount: imported,
        warnings: warnings.length > 10 ? `${warnings.length} warnings (truncated)` : warnings,
        stats: {
          totalWords: parseInt(stats.rows[0].total_words),
          parRange: `${stats.rows[0].min_par} - ${stats.rows[0].max_par}`,
          avgDifficulty: parseFloat(stats.rows[0].avg_difficulty)
        },
        distribution: distribution.rows.map(row => ({
          par: row.par,
          count: parseInt(row.count)
        }))
      });
      
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    
  } catch (err) {
    console.error('[migrate-wordlist] Error:', err);
    return res.status(500).json({ 
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
};
