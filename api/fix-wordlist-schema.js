// api/fix-wordlist-schema.js
import { Pool } from "pg";

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

    console.log("[fix-wordlist-schema] Altering wordlist table columns...");
    
    // Alter columns to NUMERIC to handle decimal values
    await pool.query(`
      ALTER TABLE wordlist 
      ALTER COLUMN difficulty TYPE NUMERIC,
      ALTER COLUMN scrabble_score TYPE NUMERIC;
    `);

    console.log("[fix-wordlist-schema] Schema updated successfully");

    return res.status(200).json({
      ok: true,
      message: "Wordlist schema updated to use NUMERIC types"
    });
  } catch (err) {
    console.error("[fix-wordlist-schema] Error:", err);
    return res.status(500).json({ error: err.message });
  }
};
