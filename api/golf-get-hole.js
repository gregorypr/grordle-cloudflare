// api/golf-get-hole.js
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

    const { roundId, holeNumber } = req.body;

    if (!roundId || !holeNumber) {
      return res.status(400).json({ error: "roundId and holeNumber required" });
    }

    console.log(`[golf-get-hole] Fetching hole ${holeNumber} for round ${roundId}`);

    // Get hole data
    const holeQuery = `
      SELECT 
        hole_number,
        target_word,
        start_word,
        par,
        guesses,
        attempts,
        score
      FROM golf_holes
      WHERE round_id = $1 AND hole_number = $2
    `;

    const result = await pool.query(holeQuery, [roundId, holeNumber]);

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        ok: false, 
        error: "Hole not found" 
      });
    }

    const hole = result.rows[0];

    // Parse guesses if they're stored as JSON string
    let guesses = [];
    if (hole.guesses) {
      if (Array.isArray(hole.guesses)) {
        guesses = hole.guesses;
      } else if (typeof hole.guesses === 'string') {
        try {
          guesses = JSON.parse(hole.guesses);
        } catch (e) {
          console.error("[golf-get-hole] Error parsing guesses:", e);
          guesses = [];
        }
      }
    }

    // Determine success based on guesses and target word
    const success = guesses.length > 0 && guesses[guesses.length - 1] === hole.target_word;

    return res.status(200).json({
      ok: true,
      holeData: {
        holeNumber: hole.hole_number,
        targetWord: hole.target_word,
        startWord: hole.start_word,
        par: hole.par,
        guesses: guesses,
        attempts: hole.attempts,
        score: hole.score,
        success: success,
        isCompleted: hole.attempts !== null && hole.attempts > 0
      }
    });
  } catch (err) {
    console.error("golf-get-hole function error", err);
    return res.status(500).json({
      error: "Server error in golf-get-hole",
      details: err.message
    });
  }
};
