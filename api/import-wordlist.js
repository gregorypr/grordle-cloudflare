// api/import-wordlist.js
// This endpoint populates the wordlist table from wordlist-table.txt
// The file contains tab-separated values: WORD, DIFFICULTY, SCRABBLE_SCORE, PAR

import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

export default async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    console.log("[import-wordlist] Endpoint called - version 2");
    
    if (!connectionString) {
      throw new Error("DATABASE_URL not set");
    }

    const { adminPassword } = req.body || {};

    // Require admin password for safety
    if (adminPassword !== "admin123") {
      return res.status(403).json({ error: "Invalid admin password" });
    }

    console.log("[import-wordlist] Starting wordlist import...");

    // Fetch wordlist-table-cleaned.txt from GitHub raw content
    const wordlistUrl = 'https://raw.githubusercontent.com/gregorypr/grordle/main/data/wordlist-table-cleaned.txt';
    console.log("[import-wordlist] Fetching wordlist from:", wordlistUrl);
    
    const response = await fetch(wordlistUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch wordlist: ${response.status}`);
    }
    
    const wordlistText = await response.text();
    const lines = wordlistText.split('\n');

    console.log(`[import-wordlist] Found ${lines.length} lines`);

    let imported = 0;
    let errors = 0;

    // Skip header row and process data
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        // Split by tab
        const parts = line.split('\t');
        if (parts.length < 4) {
          console.warn(`[import-wordlist] Skipping line ${i}: not enough columns`);
          continue;
        }

        const word = parts[0].trim().toUpperCase();
        const difficulty = parseFloat(parts[1]);
        const scrabbleScore = parseInt(parts[2]);
        const par = parseInt(parts[3]);

        // Validate data
        if (!word || word.length !== 5) {
          console.warn(`[import-wordlist] Skipping line ${i}: invalid word "${word}"`);
          continue;
        }

        if (isNaN(difficulty) || isNaN(scrabbleScore) || isNaN(par)) {
          console.warn(`[import-wordlist] Skipping line ${i}: invalid numeric values`);
          continue;
        }

        // Insert or update word
        await pool.query(`
          INSERT INTO wordlist (word, difficulty, scrabble_score, par)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (word) DO UPDATE SET
            difficulty = EXCLUDED.difficulty,
            scrabble_score = EXCLUDED.scrabble_score,
            par = EXCLUDED.par;
        `, [word, difficulty, scrabbleScore, par]);

        imported++;

        // Log progress every 500 words
        if (imported % 500 === 0) {
          console.log(`[import-wordlist] Imported ${imported} words...`);
        }
      } catch (err) {
        console.error(`[import-wordlist] Error importing line ${i}:`, err.message);
        errors++;
      }
    }

    // Get distribution of par values
    const distribution = await pool.query(`
      SELECT par, COUNT(*) as count 
      FROM wordlist 
      GROUP BY par 
      ORDER BY par;
    `);

    console.log("[import-wordlist] Import complete!");
    console.log(`[import-wordlist] Total: ${imported} words, ${errors} errors`);

    return res.status(200).json({
      ok: true,
      message: "Wordlist imported successfully",
      stats: {
        totalWords: imported,
        errors: errors,
        distribution: distribution.rows
      }
    });
  } catch (err) {
    console.error("[import-wordlist] Error:", err);
    return res.status(500).json({
      error: "Server error in import-wordlist",
      details: err.message
    });
  }
};
