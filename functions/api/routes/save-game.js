// Cloudflare Pages Function: save-game handler

export async function saveGameHandler(c) {
  const sql = c.get("sql");

  try {
    const body = await c.req.json();
    const { date, playerName, guesses, completed, targetWord } = body;

    if (!date || !playerName || !Array.isArray(guesses)) {
      return c.text("Missing or invalid fields", 400);
    }

    // Get or create game for this date
    const gameResult = await sql(
      `INSERT INTO games (play_date) VALUES ($1)
       ON CONFLICT (play_date) DO UPDATE SET play_date = EXCLUDED.play_date
       RETURNING id;`,
      [date]
    );
    const gameId = gameResult[0].id;

    // Get or create player (case-insensitive lookup)
    let existingPlayer = await sql(
      `SELECT id, player_name FROM players WHERE LOWER(player_name) = LOWER($1);`,
      [playerName]
    );

    let playerId;
    if (existingPlayer.length > 0) {
      playerId = existingPlayer[0].id;
    } else {
      const playerResult = await sql(
        `INSERT INTO players (player_name) VALUES ($1) RETURNING id;`,
        [playerName]
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
