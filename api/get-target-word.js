// api/get-target-word.js
// Server-side daily word generation - deterministic from date seed
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

export default async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!connectionString) {
      throw new Error("DATABASE_URL not set");
    }

    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ error: "Date is required" });
    }

    // Get wordlist from database in insertion order (by id for stability)
    const wordlistResult = await pool.query(`
      SELECT word FROM wordlist
      ORDER BY id
    `);

    if (wordlistResult.rowCount === 0) {
      return res.status(500).json({ error: "Wordlist is empty" });
    }

    const words = wordlistResult.rows.map(row => row.word);

    // Generate seed from date string using same algorithm as client
    const dateStr = "TARGET:" + date;
    let seed = 0;
    for (let i = 0; i < dateStr.length; i++) {
      seed = (seed * 31 + dateStr.charCodeAt(i)) >>> 0;
    }

    // Select word using seed
    const index = seed % words.length;
    const targetWord = words[index];

    return res.status(200).json({
      ok: true,
      targetWord: targetWord,
      date: date,
      wordlistSize: words.length
    });
  } catch (err) {
    console.error("get-target-word function error", err);
    return res.status(500).json({
      error: "Server error in get-target-word",
      details: err.message
    });
  }
};
