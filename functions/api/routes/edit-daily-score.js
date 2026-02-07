// Cloudflare Pages Function: edit-daily-score handler

export async function editDailyScoreHandler(c) {
  const sql = c.get("sql");
  const org_id = c.get("org_id");

  if (c.req.method !== "POST") {
    return c.json({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await c.req.json();
    const { playerName, date, attempts, adminPassword } = body;

    if (adminPassword !== "admin123") {
      return c.json({ error: "Invalid admin password" }, 403);
    }

    if (!playerName || !date || !attempts) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    const playerResult = await sql(
      `SELECT id FROM players WHERE LOWER(player_name) = LOWER($1) AND COALESCE(org_id, 0) = COALESCE($2, 0)`,
      [playerName, org_id]
    );

    if (playerResult.length === 0) {
      return c.json({ error: "Player not found" }, 404);
    }

    const playerId = playerResult[0].id;

    let gameResult = await sql(
      `SELECT id FROM games WHERE play_date = $1 AND COALESCE(org_id, 0) = COALESCE($2, 0)`,
      [date, org_id]
    );

    let gameId;
    if (gameResult.length === 0) {
      const newGame = await sql(
        `INSERT INTO games (play_date, org_id) VALUES ($1, $2) RETURNING id`,
        [date, org_id]
      );
      gameId = newGame[0].id;
    } else {
      gameId = gameResult[0].id;
    }

    const existingScore = await sql(
      `SELECT id FROM scores WHERE player_id = $1 AND game_id = $2`,
      [playerId, gameId]
    );

    let result;
    if (existingScore.length > 0) {
      result = await sql(
        `UPDATE scores SET attempts = $1 WHERE player_id = $2 AND game_id = $3 RETURNING *`,
        [attempts, playerId, gameId]
      );
    } else {
      const success = attempts <= 6;
      result = await sql(
        `INSERT INTO scores (player_id, game_id, attempts, success) VALUES ($1, $2, $3, $4) RETURNING *`,
        [playerId, gameId, attempts, success]
      );
    }

    const existingDailyPlayer = await sql(
      `SELECT player_id FROM daily_players WHERE player_id = $1 AND game_id = $2`,
      [playerId, gameId]
    );

    if (existingDailyPlayer.length === 0) {
      await sql(
        `INSERT INTO daily_players (player_id, game_id) VALUES ($1, $2)`,
        [playerId, gameId]
      );
    }

    return c.json({
      ok: true,
      message: `Updated ${playerName}'s score for ${date} to ${attempts} attempts`,
      score: result[0]
    });
  } catch (err) {
    console.error("edit-daily-score error", err);
    return c.json({
      error: "Server error",
      details: err.message
    }, 500);
  }
}
