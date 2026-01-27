// Cloudflare Pages Function: submit handler

export async function submitHandler(c) {
  const sql = c.get("sql");

  try {
    const body = await c.req.json();
    const { date, playerName, attempts, success } = body;

    if (!date || !playerName || attempts == null || typeof success !== "boolean") {
      return c.text("Missing fields", 400);
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
