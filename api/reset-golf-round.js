// api/reset-golf-round.js
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
    const { playerName } = req.body;

    if (!playerName) {
      return res.status(400).json({ error: "playerName is required" });
    }

    console.log("[reset-golf-round] Resetting golf round for player:", playerName);

    // Get player ID
    const playerResult = await pool.query(
      `SELECT id FROM players WHERE LOWER(player_name) = LOWER($1);`,
      [playerName]
    );

    if (playerResult.rowCount === 0) {
      return res.status(404).json({ error: "Player not found" });
    }

    const playerId = playerResult.rows[0].id;

    // Delete all golf rounds and their holes for this player
    const deleteResult = await pool.query(
      `DELETE FROM golf_rounds WHERE player_id = $1 RETURNING id;`,
      [playerId]
    );

    console.log(`[reset-golf-round] Deleted ${deleteResult.rowCount} rounds for player ${playerName}`);

    return res.status(200).json({
      ok: true,
      message: `Deleted ${deleteResult.rowCount} round(s)`,
      deletedRounds: deleteResult.rowCount
    });
  } catch (err) {
    console.error("[reset-golf-round] Error:", err);
    return res.status(500).json({ error: err.message });
  }
};
