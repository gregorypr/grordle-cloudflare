// Import the full Wordle wordlist (14,855 words) for validation only
// These words can be guessed but will never be used as target/start words
import { Pool } from "pg";
import fs from "fs";
import path from "path";

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
    console.log("[import-validation-wordlist] Starting import...");

    // Create validation_words table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS validation_words (
        id SERIAL PRIMARY KEY,
        word TEXT NOT NULL UNIQUE
      );
    `);

    console.log("[import-validation-wordlist] Table created/verified");

    // Read the filtered Wordle wordlist (plurals and -ED removed)
    const wordlistPath = path.join(process.cwd(), "data", "wordle-answers-filtered.txt");
    const fileContent = fs.readFileSync(wordlistPath, "utf-8");
    const words = fileContent
      .split("\n")
      .map(line => line.trim().toUpperCase())
      .filter(word => word.length === 5);

    console.log(`[import-validation-wordlist] Loaded ${words.length} words from filtered file`);

    // Clear existing validation words
    await pool.query("DELETE FROM validation_words");
    console.log("[import-validation-wordlist] Cleared existing validation words");

    // Insert all words in batches
    const batchSize = 1000;
    let imported = 0;

    for (let i = 0; i < words.length; i += batchSize) {
      const batch = words.slice(i, i + batchSize);
      const values = batch.map((word, idx) => `($${idx + 1})`).join(',');
      const query = `INSERT INTO validation_words (word) VALUES ${values} ON CONFLICT (word) DO NOTHING`;
      
      await pool.query(query, batch);
      imported += batch.length;
      
      if (imported % 5000 === 0) {
        console.log(`[import-validation-wordlist] Imported ${imported}/${words.length} words...`);
      }
    }

    console.log(`[import-validation-wordlist] Import complete: ${words.length} words`);

    res.json({
      ok: true,
      message: `Successfully imported ${words.length} validation words`,
      count: words.length
    });
  } catch (err) {
    console.error("[import-validation-wordlist] Error:", err);
    console.error("[import-validation-wordlist] Stack:", err.stack);
    res.status(500).json({ ok: false, error: err.message });
  }
};
