// api/populate-wordlist.js
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
    if (adminPassword !== "admin123") {
      return res.status(403).json({ error: "Invalid admin password" });
    }

    console.log("[populate-wordlist] Reading from local wordlist-table-cleaned.txt...");

    // Read from local file
    const filePath = path.join(process.cwd(), 'data', 'wordlist-table-cleaned.txt');
    const text = fs.readFileSync(filePath, 'utf-8');
    const lines = text.split('\n').slice(1); // Skip header
    
    // Parse all valid words first
    const words = [];
    for (const line of lines) {
      if (!line.trim()) continue;
      
      const parts = line.split('\t');
      if (parts.length < 4) continue;
      
      const word = parts[0].trim().toUpperCase();
      const difficulty = parseFloat(parts[1]);
      const scrabbleScore = parseFloat(parts[2]);
      const par = parseInt(parts[3]);
      
      if (!word || word.length !== 5 || isNaN(difficulty) || isNaN(scrabbleScore) || isNaN(par)) {
        continue;
      }
      
      words.push({ word, difficulty, scrabbleScore, par });
    }
    
    console.log(`[populate-wordlist] Parsed ${words.length} words, inserting in batches...`);
    
    // Insert in batches of 100
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
      
      await pool.query(`
        INSERT INTO wordlist (word, difficulty, scrabble_score, par)
        VALUES ${placeholders.join(', ')}
        ON CONFLICT (word) DO UPDATE SET
          difficulty = EXCLUDED.difficulty,
          scrabble_score = EXCLUDED.scrabble_score,
          par = EXCLUDED.par
      `, values);
      
      imported += batch.length;
      console.log(`[populate-wordlist] Imported ${imported}/${words.length}...`);
    }
    
    const distribution = await pool.query(`
      SELECT par, COUNT(*) as count 
      FROM wordlist 
      GROUP BY par 
      ORDER BY par
    `);

    return res.status(200).json({
      ok: true,
      imported,
      distribution: distribution.rows
    });
  } catch (err) {
    console.error("[populate-wordlist] Error:", err);
    return res.status(500).json({ error: err.message });
  }
};
