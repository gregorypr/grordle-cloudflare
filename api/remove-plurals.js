// api/remove-plurals.js
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

    console.log("[remove-plurals] Starting to remove plural words...");

    // Get all words ending in S but not SS
    const wordsEndingInS = await pool.query(`
      SELECT word FROM wordlist WHERE word LIKE '%S' AND word NOT LIKE '%SS'
    `);

    console.log(`[remove-plurals] Found ${wordsEndingInS.rowCount} words ending in S (excluding SS)`);

    let removed = 0;

    for (const row of wordsEndingInS.rows) {
      const word = row.word;
      await pool.query(`DELETE FROM wordlist WHERE word = $1`, [word]);
      console.log(`[remove-plurals] Removed: ${word}`);
      removed++;
    }

    const finalCount = await pool.query(`SELECT COUNT(*) as count FROM wordlist`);

    console.log(`[remove-plurals] Complete - Removed: ${removed}`);

    return res.status(200).json({
      ok: true,
      removed,
      totalRemaining: parseInt(finalCount.rows[0].count)
    });
  } catch (err) {
    console.error("[remove-plurals] Error:", err);
    return res.status(500).json({ error: err.message });
  }
};
