// api/get-par-distribution.js
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export default async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const distribution = await pool.query(`
      SELECT par, COUNT(*) as count 
      FROM wordlist 
      WHERE par IS NOT NULL
      GROUP BY par 
      ORDER BY par
    `);

    return res.status(200).json({
      ok: true,
      distribution: distribution.rows
    });
  } catch (err) {
    console.error("[get-par-distribution] Error:", err);
    return res.status(500).json({ error: err.message });
  }
};
