// Cloudflare Pages Function: submit handler

export async function submitHandler(c) {
  const sql = c.get("sql");
  const org_id = c.get("org_id");

  try {
    const body = await c.req.json();
    const { date, playerName, attempts, success } = body;

    if (!date || !playerName || attempts == null || typeof success !== "boolean") {
      return c.text("Missing fields", 400);
    }

    // Get or create game for this date and tenant
    let gameResult = await sql(
      `SELECT id FROM games WHERE play_date = $1 AND COALESCE(org_id, 0) = COALESCE($2, 0);`,
      [date, org_id]
    );

    let gameId;
    if (gameResult.length === 0) {
      gameResult = await sql(
        `INSERT INTO games (play_date, org_id) VALUES ($1, $2) RETURNING id;`,
        [date, org_id]
      );
      gameId = gameResult[0].id;
    } else {
      gameId = gameResult[0].id;
    }

    // Get or create player (case-insensitive lookup) in this tenant
    let existingPlayer = await sql(
      `SELECT id, player_name FROM players WHERE LOWER(player_name) = LOWER($1) AND COALESCE(org_id, 0) = COALESCE($2, 0);`,
      [playerName, org_id]
    );

    let playerId;
    if (existingPlayer.length > 0) {
      playerId = existingPlayer[0].id;
    } else {
      const playerResult = await sql(
        `INSERT INTO players (player_name, org_id) VALUES ($1, $2) RETURNING id;`,
        [playerName, org_id]
      );
      playerId = playerResult[0].id;
    }

    // Insert score with foreign keys
    await sql(
      `INSERT INTO scores (game_id, player_id, attempts, success)
       VALUES ($1, $2, $3, $4);`,
      [gameId, playerId, attempts, success]
    );

    return c.json({ ok: true });
  } catch (err) {
    console.error("submit function error", err);
    return c.json({
      error: "Server error in submit",
      details: err.message
    }, 500);
  }
}
