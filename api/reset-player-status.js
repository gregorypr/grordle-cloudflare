// api/reset-player-status.js
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

    const { playerName, date } = req.body;

    if (!playerName || !date) {
      return res.status(400).json({ error: "playerName and date are required" });
    }

    // Get or create game for this date
    let gameResult = await pool.query(
      `INSERT INTO games (play_date) VALUES ($1)
       ON CONFLICT (play_date) DO UPDATE SET play_date = EXCLUDED.play_date
       RETURNING id;`,
      [date]
    );
    const gameId = gameResult.rows[0].id;

    // Handle "ALL" to reset all players for today
    if (playerName === "ALL") {
      // Delete all entries for this game
      await pool.query(`DELETE FROM daily_players WHERE game_id = $1;`, [gameId]);
      await pool.query(`DELETE FROM scores WHERE game_id = $1;`, [gameId]);
      await pool.query(`DELETE FROM player_games WHERE game_id = $1;`, [gameId]);
      // Also delete all golf rounds from today
      await pool.query(`DELETE FROM golf_rounds WHERE started_at::date = $1::date;`, [date]);

      return res.status(200).json({ 
        ok: true, 
        message: `Reset all player statuses for ${date}` 
      });
    }

    // Get player (case-insensitive)
    const playerResult = await pool.query(
      `SELECT id FROM players WHERE LOWER(player_name) = LOWER($1);`,
      [playerName]
    );

    if (playerResult.rowCount === 0) {
      return res.status(404).json({ error: "Player not found" });
    }

    const playerId = playerResult.rows[0].id;

    // Delete from daily_players
    await pool.query(
      `DELETE FROM daily_players WHERE game_id = $1 AND player_id = $2;`,
      [gameId, playerId]
    );

    // Delete from scores
    await pool.query(
      `DELETE FROM scores WHERE game_id = $1 AND player_id = $2;`,
      [gameId, playerId]
    );

    // Delete from player_games
    // Delete all player_games rows for this player and date (join to games on game_id and filter by play_date)
    await pool.query(
      `DELETE FROM player_games 
        WHERE player_id = $1 
        AND game_id IN (SELECT id FROM games WHERE play_date = $2);`,
      [playerId, date]
    );

    // Delete from golf_rounds for this player on this date
    await pool.query(
      `DELETE FROM golf_rounds WHERE player_id = $1 AND started_at::date = $2::date;`,
      [playerId, date]
    );

    return res.status(200).json({ 
      ok: true, 
      message: `Reset status for ${playerName} on ${date}` 
    });
  } catch (err) {
    console.error("reset-player-status function error", err);
    return res.status(500).json({
      error: "Server error in reset-player-status",
      details: err.message
    });
  }
};
