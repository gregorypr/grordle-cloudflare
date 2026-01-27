// api/edit-daily-score.js
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
    const { playerName, date, attempts, adminPassword } = req.body;

    if (adminPassword !== "admin123") {
      return res.status(403).json({ error: "Invalid admin password" });
    }

    if (!playerName || !date || !attempts) {
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

    // Get or create game for the date
    let gameResult = await pool.query(
      `SELECT id FROM games WHERE play_date = $1`,
      [date]
    );

    let gameId;
    if (gameResult.rows.length === 0) {
      // Create game record if it doesn't exist
      const newGame = await pool.query(
        `INSERT INTO games (play_date, created_at) 
         VALUES ($1, NOW()) 
         RETURNING id`,
        [date]
      );
      gameId = newGame.rows[0].id;
    } else {
      gameId = gameResult.rows[0].id;
    }

    // Check if score already exists
    const existingScore = await pool.query(
      `SELECT id FROM scores WHERE player_id = $1 AND game_id = $2`,
      [playerId, gameId]
    );

    let result;
    if (existingScore.rows.length > 0) {
      // Update existing score
      result = await pool.query(
        `UPDATE scores SET attempts = $1 WHERE player_id = $2 AND game_id = $3 RETURNING *`,
        [attempts, playerId, gameId]
      );
    } else {
      // Insert new score (success = true if attempts <= 6, false otherwise)
      const success = attempts <= 6;
      result = await pool.query(
        `INSERT INTO scores (player_id, game_id, attempts, success) VALUES ($1, $2, $3, $4) RETURNING *`,
        [playerId, gameId, attempts, success]
      );
    }

    // Also update or insert daily_players record
    const existingDailyPlayer = await pool.query(
      `SELECT player_id FROM daily_players WHERE player_id = $1 AND game_id = $2`,
      [playerId, gameId]
    );

    if (existingDailyPlayer.rows.length === 0) {
      await pool.query(
        `INSERT INTO daily_players (player_id, game_id) VALUES ($1, $2)`,
        [playerId, gameId]
      );
    }

    return res.status(200).json({
      ok: true,
      message: `Updated ${playerName}'s score for ${date} to ${attempts} attempts`,
      score: result.rows[0]
    });
  } catch (err) {
    console.error("edit-daily-score error", err);
    return res.status(500).json({
      error: "Server error",
      details: err.message
    });
  }
};
