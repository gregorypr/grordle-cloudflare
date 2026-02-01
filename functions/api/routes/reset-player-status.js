// Cloudflare Pages Function: reset-player-status handler

export async function resetPlayerStatusHandler(c) {
  const sql = c.get("sql");

  try {
    const body = await c.req.json();
    const { playerName, date } = body;

    if (!playerName || !date) {
      return c.json({ error: "playerName and date are required" }, 400);
    }

    // Get or create game for this date
    const gameResult = await sql(
      `INSERT INTO games (play_date) VALUES ($1)
       ON CONFLICT (play_date) DO UPDATE SET play_date = EXCLUDED.play_date
       RETURNING id;`,
      [date]
    );
    const gameId = gameResult[0].id;

    // Handle "ALL" to reset all players for today
    if (playerName === "ALL") {
      await sql(`DELETE FROM daily_players WHERE game_id = $1;`, [gameId]);
      await sql(`DELETE FROM scores WHERE game_id = $1;`, [gameId]);
      await sql(`DELETE FROM player_games WHERE game_id = $1;`, [gameId]);
      await sql(`DELETE FROM golf_rounds WHERE started_at::date = $1::date;`, [date]);

      return c.json({
        ok: true,
        message: `Reset all player statuses for ${date}`
      });
    }

    // Get player (case-insensitive)
    const playerResult = await sql(
      `SELECT id FROM players WHERE LOWER(player_name) = LOWER($1);`,
      [playerName]
    );

    if (playerResult.length === 0) {
      return c.json({ error: "Player not found" }, 404);
    }

    const playerId = playerResult[0].id;

    // Delete from daily_players
    await sql(
      `DELETE FROM daily_players WHERE game_id = $1 AND player_id = $2;`,
      [gameId, playerId]
    );

    // Delete from scores
    await sql(
      `DELETE FROM scores WHERE game_id = $1 AND player_id = $2;`,
      [gameId, playerId]
    );

    // Delete from player_games
    await sql(
      `DELETE FROM player_games
        WHERE player_id = $1
        AND game_id IN (SELECT id FROM games WHERE play_date = $2);`,
      [playerId, date]
    );

    // Delete from golf_rounds for this player on this date
    await sql(
      `DELETE FROM golf_rounds WHERE player_id = $1 AND started_at::date = $2::date;`,
      [playerId, date]
    );

    return c.json({
      ok: true,
      message: `Reset status for ${playerName} on ${date}`
    });
  } catch (err) {
    console.error("reset-player-status function error", err);
    return c.json({
      error: "Server error in reset-player-status",
      details: err.message
    }, 500);
  }
}
