// api/validate-word.js
// Server-side word validation
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
    if (!connectionString) {
      throw new Error("DATABASE_URL not set");
    }

    const { word } = req.body;

    if (!word || typeof word !== "string") {
      return res.status(400).json({ error: "Word is required" });
    }

    const upperWord = word.toUpperCase().trim();

    if (!/^[A-Z]{5}$/.test(upperWord)) {
      return res.status(200).json({ valid: false, word: upperWord });
    }

    // Single query with LEFT JOIN to get both validation and curated data
    const result = await pool.query(
      `SELECT 
        v.word,
        w.difficulty,
        w.par
       FROM validation_words v
       LEFT JOIN wordlist w ON v.word = w.word
       WHERE v.word = $1`,
      [upperWord]
    );

    if (result.rowCount > 0) {
      return res.status(200).json({
        valid: true,
        word: upperWord,
        difficulty: result.rows[0].difficulty,
        par: result.rows[0].par
      });
    }

    // Word not found in validation list
    return res.status(200).json({ valid: false, word: upperWord });
  } catch (err) {
    console.error("validate-word function error", err);
    return res.status(500).json({
      error: "Server error in validate-word",
      details: err.message
    });
  }
};
