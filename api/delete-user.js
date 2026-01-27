// api/delete-user.js
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

export default async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  try {
    if (!connectionString) {
      throw new Error("DATABASE_URL not set");
    }

    const body = req.body || {};
    const { playerName } = body;

    if (!playerName) {
      return res.status(400).json({ error: "Missing playerName" });
    }

    // First, get the player ID
    const playerResult = await pool.query(
      `SELECT id, player_name FROM players WHERE LOWER(player_name) = LOWER($1);`,
      [playerName]
    );

    if (playerResult.rowCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const playerId = playerResult.rows[0].id;
    const actualPlayerName = playerResult.rows[0].player_name;

    // Delete from all related tables explicitly (even though CASCADE should handle it)
    await pool.query(`DELETE FROM scores WHERE player_id = $1;`, [playerId]);
    await pool.query(`DELETE FROM daily_players WHERE player_id = $1;`, [playerId]);
    await pool.query(`DELETE FROM player_games WHERE player_id = $1;`, [playerId]);
    
    // Finally, delete the player
    await pool.query(`DELETE FROM players WHERE id = $1;`, [playerId]);

    return res.status(200).json({
      ok: true,
      message: `User ${actualPlayerName} deleted successfully`
    });
  } catch (err) {
    console.error("delete-user function error", err);
    console.error("Error stack:", err.stack);
    console.error("Error details:", {
      message: err.message,
      code: err.code,
      detail: err.detail,
      constraint: err.constraint
    });
    return res.status(500).json({
      error: "Server error in delete-user",
      details: err.message,
      code: err.code
    });
  }
};
