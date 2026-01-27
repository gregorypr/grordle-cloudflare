// api/golf-save-guesses.js
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

    const { roundId, holeNumber, guesses } = req.body;

    if (!roundId || !holeNumber || !Array.isArray(guesses)) {
      return res.status(400).json({ error: "roundId, holeNumber, and guesses are required" });
    }

    console.log('[golf-save-guesses] Saving guesses for round:', roundId, 'hole:', holeNumber, 'guesses:', guesses);

    // Update guesses for this hole
    const result = await pool.query(
      `UPDATE golf_holes 
       SET guesses = $1 
       WHERE round_id = $2 AND hole_number = $3;`,
      [JSON.stringify(guesses), roundId, holeNumber]
    );

    console.log('[golf-save-guesses] Update result - rows affected:', result.rowCount);

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("golf-save-guesses error", err);
    return res.status(500).json({
      error: "Server error in golf-save-guesses",
      details: err.message
    });
  }
};
