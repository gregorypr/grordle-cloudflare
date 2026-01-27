// Cloudflare Pages Function: completed-games handler

export async function completedGamesHandler(c) {
  const sql = c.get("sql");

  try {
    const date = c.req.query("date");

    if (!date) {
      return c.text("Missing date parameter", 400);
    }

    // Get or create game for this date
    const gameResult = await sql(
      `INSERT INTO games (play_date) VALUES ($1)
       ON CONFLICT (play_date) DO UPDATE SET play_date = EXCLUDED.play_date
       RETURNING id;`,
      [date]
    );
    const gameId = gameResult[0].id;

    // Get all players who have ever played
    const allNamesResult = await sql(`
      SELECT player_name as name
      FROM players
      ORDER BY LOWER(player_name);
    `);

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
