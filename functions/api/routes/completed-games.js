// Cloudflare Pages Function: completed-games handler

export async function completedGamesHandler(c) {
  const sql = c.get("sql");
  const org_id = c.get("org_id");

  try {
    const date = c.req.query("date");

    if (!date) {
      return c.text("Missing date parameter", 400);
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

    // Get all players who have ever played (tenant-scoped)
    const allNamesResult = await sql(
      `SELECT player_name as name
       FROM players
       WHERE COALESCE(org_id, 0) = COALESCE($1, 0)
       ORDER BY LOWER(player_name);`,
      [org_id]
    );

    // Get all completed games for this date
    const completedResult = await sql(
      `SELECT
        p.player_name,
        pg.guesses,
        pg.completed,
        pg.target_word
      FROM player_games pg
      JOIN players p ON pg.player_id = p.id
      WHERE pg.game_id = $1 AND pg.completed = true;`,
      [gameId]
    );

    // Build a map of completed games (case-insensitive)
    const completedMap = {};
    for (const row of completedResult) {
      const key = row.player_name.toLowerCase();
      completedMap[key] = {
        playerName: row.player_name,
        guesses: row.guesses || [],
        completed: row.completed,
        targetWord: row.target_word
      };
    }

    // Build result array with all members
    const result = [];
    for (const nameRow of allNamesResult) {
      const name = nameRow.name;
      const key = name.toLowerCase();
      if (completedMap[key]) {
        result.push(completedMap[key]);
      }
    }

    const games = result.map(row => {
      const guesses = row.guesses || [];
      const attempts = guesses.length;

      return {
        playerName: row.playerName,
        guesses: guesses,
        attempts: attempts,
        completed: row.completed,
        targetWord: row.targetWord
      };
    });

    return c.json({
      ok: true,
      games,
      count: games.length
    });
  } catch (err) {
    console.error("completed-games function error", err);
    return c.json({
      error: "Server error in completed-games",
      details: err.message
    }, 500);
  }
}
