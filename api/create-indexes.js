// Create indexes on word columns for faster lookups
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
    console.log("[create-indexes] Creating indexes...");

    // Index on validation_words.word for fast lookups
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_validation_words_word 
      ON validation_words(word)
    `);
    console.log("[create-indexes] Created index on validation_words.word");

    // Index on wordlist.word for fast lookups
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_wordlist_word 
      ON wordlist(word)
    `);
    console.log("[create-indexes] Created index on wordlist.word");

    // Get index info
    const indexInfo = await pool.query(`
      SELECT 
        schemaname,
        tablename,
        indexname,
        indexdef
      FROM pg_indexes 
      WHERE tablename IN ('validation_words', 'wordlist')
      ORDER BY tablename, indexname
    `);

    res.json({
      ok: true,
      message: "Indexes created successfully",
      indexes: indexInfo.rows
    });
  } catch (err) {
    console.error("[create-indexes] Error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
};
