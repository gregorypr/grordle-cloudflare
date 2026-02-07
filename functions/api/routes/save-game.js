// Cloudflare Pages Function: save-game handler

export async function saveGameHandler(c) {
  const sql = c.get("sql");
  const org_id = c.get("org_id");

  try {
    const body = await c.req.json();
    const { date, playerName, guesses, completed, targetWord } = body;

    if (!date || !playerName || !Array.isArray(guesses)) {
      return c.text("Missing or invalid fields", 400);
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

    // Upsert game state
    await sql(
      `INSERT INTO player_games (game_id, player_id, guesses, completed, target_word, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (game_id, player_id)
       DO UPDATE SET
         guesses = EXCLUDED.guesses,
         completed = EXCLUDED.completed,
         target_word = EXCLUDED.target_word,
         updated_at = NOW();`,
      [gameId, playerId, JSON.stringify(guesses), completed || false, targetWord || null]
    );

    return c.json({ ok: true });
  } catch (err) {
    console.error("save-game function error", err);
    return c.json({
      error: "Server error in save-game",
      details: err.message
    }, 500);
  }
}
