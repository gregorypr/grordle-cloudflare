// api/golf-next-hole.js
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

    const { roundId } = req.body;

    if (!roundId) {
      console.error("[golf-next-hole] No roundId provided");
      return res.status(400).json({ error: "roundId is required" });
    }

    console.log("[golf-next-hole] Getting next hole for round:", roundId);

    // Get current hole number
    const roundResult = await pool.query(
      `SELECT current_hole, is_completed FROM golf_rounds WHERE id = $1;`,
      [roundId]
    );

    if (roundResult.rowCount === 0) {
      console.error("[golf-next-hole] Round not found:", roundId);
      return res.status(404).json({ error: "Round not found" });
    }

    const { current_hole, is_completed } = roundResult.rows[0];
    console.log("[golf-next-hole] Round found - current_hole:", current_hole, "is_completed:", is_completed);

    if (is_completed) {
      console.log("[golf-next-hole] Round already completed");
      return res.status(400).json({ error: "Round already completed" });
    }

    // Holes should already be pre-generated during golf-start
    // Just retrieve the existing hole data
    console.log("[golf-next-hole] Fetching hole data - roundId:", roundId, "hole_number:", current_hole);
    const existingHole = await pool.query(
      `SELECT target_word, start_word, par, guesses FROM golf_holes 
       WHERE round_id = $1 AND hole_number = $2;`,
      [roundId, current_hole]
    );

    console.log("[golf-next-hole] Hole query returned", existingHole.rowCount, "rows");

    if (existingHole.rowCount > 0) {
      // Hole already created, return existing data
      console.log("[golf-next-hole] Returning hole", current_hole, "- Par:", existingHole.rows[0].par);
      return res.status(200).json({
        ok: true,
        holeNumber: current_hole,
        targetWord: existingHole.rows[0].target_word,
        startWord: existingHole.rows[0].start_word,
        par: existingHole.rows[0].par,
        guesses: existingHole.rows[0].guesses || []
      });
    }

    // This shouldn't happen since holes are pre-generated, but handle it just in case
    console.error("[golf-next-hole] Hole not found for round:", roundId, "hole:", current_hole);
    return res.status(500).json({ 
      error: "Hole not found. Round may not have been initialised properly.",
      roundId,
      currentHole: current_hole
    });
  } catch (err) {
    console.error("golf-next-hole function error", err);
    return res.status(500).json({
      error: "Server error in golf-next-hole",
      details: err.message
    });
  }
};
