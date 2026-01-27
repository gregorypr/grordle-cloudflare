// api/edit-golf-score.js
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
    const { playerName, date, holeNumber, attempts, adminPassword } = req.body;

    if (adminPassword !== "admin123") {
      return res.status(403).json({ error: "Invalid admin password" });
    }

    if (!playerName || !date || !holeNumber || !attempts) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Get player ID
    const playerResult = await pool.query(
      `SELECT id FROM players WHERE player_name = $1`,
      [playerName]
    );

    if (playerResult.rows.length === 0) {
      return res.status(404).json({ error: "Player not found" });
    }

    const playerId = playerResult.rows[0].id;

    // Debug: Check what rounds exist for this player
    const debugRounds = await pool.query(
      `SELECT id, completed_at, TO_CHAR(completed_at, 'YYYY-MM-DD') as date_str 
       FROM golf_rounds 
       WHERE player_id = $1 
       ORDER BY completed_at DESC`,
      [playerId]
    );
    console.log(`Found ${debugRounds.rows.length} rounds for player ${playerName}:`, debugRounds.rows);
    console.log(`Looking for date: ${date}`);

    // Find the golf round for this player and date
    const roundResult = await pool.query(
      `SELECT id FROM golf_rounds 
       WHERE player_id = $1 
       AND DATE(completed_at) = $2::date
       ORDER BY completed_at DESC
       LIMIT 1`,
      [playerId, date]
    );

    if (roundResult.rows.length === 0) {
      return res.status(404).json({ error: "No golf round found for this player and date" });
    }

    const roundId = roundResult.rows[0].id;

    // Get the hole info (need par to calculate score)
    const holeResult = await pool.query(
      `SELECT par FROM golf_holes 
       WHERE round_id = $1 AND hole_number = $2`,
      [roundId, holeNumber]
    );

    if (holeResult.rows.length === 0) {
      return res.status(404).json({ error: "Hole not found" });
    }

    const par = holeResult.rows[0].par;
    const score = attempts - par;

    // Update the hole
    const updateResult = await pool.query(
      `UPDATE golf_holes 
       SET attempts = $1, score = $2
       WHERE round_id = $3 AND hole_number = $4
       RETURNING *`,
      [attempts, score, roundId, holeNumber]
    );

    // Recalculate total score for the round
    const totalResult = await pool.query(
      `SELECT SUM(score) as total_score 
       FROM golf_holes 
       WHERE round_id = $1 AND score IS NOT NULL`,
      [roundId]
    );

    const totalScore = totalResult.rows[0].total_score;

    // Update the round total
    await pool.query(
      `UPDATE golf_rounds 
       SET total_score = $1 
       WHERE id = $2`,
      [totalScore, roundId]
    );

    return res.status(200).json({
      ok: true,
      message: `Updated ${playerName}'s hole ${holeNumber} score to ${attempts} attempts (${score > 0 ? '+' : ''}${score})`,
      hole: updateResult.rows[0],
      newTotalScore: totalScore
    });
  } catch (err) {
    console.error("edit-golf-score error", err);
    return res.status(500).json({
      error: "Server error",
      details: err.message
    });
  }
};
