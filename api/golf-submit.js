// api/golf-submit.js
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

    const { roundId, holeNumber, attempts, success } = req.body;

    if (!roundId || !holeNumber || attempts === undefined || success === undefined) {
      return res.status(400).json({ error: "roundId, holeNumber, attempts, and success are required" });
    }

    console.log("[golf-submit] Submitting hole", holeNumber, "- Attempts:", attempts, "Success:", success);

    // Get hole data
    const holeResult = await pool.query(
      `SELECT par, target_word FROM golf_holes 
       WHERE round_id = $1 AND hole_number = $2;`,
      [roundId, holeNumber]
    );

    if (holeResult.rowCount === 0) {
      return res.status(404).json({ error: "Hole not found" });
    }

    const { par, target_word } = holeResult.rows[0];

    // Calculate golf score
    // If failed, add 1 penalty to attempts (so par 5 = 7 attempts = +2 double bogey)
    // Otherwise, score = attempts - par
    let score;
    if (!success) {
      score = (attempts + 1) - par; // Failed = attempts + 1 penalty
    } else {
      score = attempts - par;
    }

    console.log("[golf-submit] Par:", par, "Attempts:", attempts, "Score:", score);

    // Update hole with score
    await pool.query(
      `UPDATE golf_holes 
       SET attempts = $1, score = $2, completed_at = NOW() 
       WHERE round_id = $3 AND hole_number = $4;`,
      [attempts, score, roundId, holeNumber]
    );

    // Check if this was the last hole (hole 9)
    if (holeNumber === 9) {
      // Calculate total score
      const totalResult = await pool.query(
        `SELECT SUM(score) as total_score 
         FROM golf_holes 
         WHERE round_id = $1;`,
        [roundId]
      );

      const totalScore = totalResult.rows[0].total_score || 0;

      // Mark round as completed
      await pool.query(
        `UPDATE golf_rounds 
         SET is_completed = TRUE, completed_at = NOW(), total_score = $1 
         WHERE id = $2;`,
        [totalScore, roundId]
      );

      console.log("[golf-submit] Round completed! Total score:", totalScore);

      return res.status(200).json({
        ok: true,
        score,
        roundCompleted: true,
        totalScore
      });
    } else {
      // Move to next hole
      await pool.query(
        `UPDATE golf_rounds 
         SET current_hole = $1 
         WHERE id = $2;`,
        [holeNumber + 1, roundId]
      );

      return res.status(200).json({
        ok: true,
        score,
        roundCompleted: false,
        nextHole: holeNumber + 1
      });
    }
  } catch (err) {
    console.error("golf-submit function error", err);
    return res.status(500).json({
      error: "Server error in golf-submit",
      details: err.message
    });
  }
};
