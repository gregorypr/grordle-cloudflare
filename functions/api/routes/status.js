// Cloudflare Pages Function: status handler

export async function statusHandler(c) {
  const sql = c.get("sql");

  try {
    const date = c.req.query("date") || new Date().toISOString().split("T")[0];

    console.log('[status] Received date parameter:', date);

    // Get or create game for this date
    const gameResult = await sql(
      `INSERT INTO games (play_date) VALUES ($1)
       ON CONFLICT (play_date) DO UPDATE SET play_date = EXCLUDED.play_date
       RETURNING id;`,
      [date]
    );
    const gameId = gameResult[0].id;

    // Get all players who have ever played
    const allNamesRows = await sql(`
      SELECT player_name as name
      FROM players
      ORDER BY LOWER(player_name);
    `);

    // Daily players for this game
    const playersRows = await sql(
      `SELECT p.player_name
       FROM daily_players dp
       JOIN players p ON dp.player_id = p.id
       WHERE dp.game_id = $1
       ORDER BY LOWER(p.player_name);`,
      [gameId]
    );

    // All scores for that date
    const scoreRows = await sql(
      `SELECT p.player_name, s.attempts, s.success, g.play_date
       FROM scores s
       JOIN players p ON s.player_id = p.id
       JOIN games g ON s.game_id = g.id
       WHERE s.game_id = $1 AND g.play_date = $2;`,
      [gameId, date]
    );

    const dailyScores = {};
    const dailyScoresLowercase = {};
    for (const row of scoreRows) {
      const name = row.player_name;
      const attempts = Number(row.attempts);
      if (!dailyScores[name] || attempts < dailyScores[name]) {
        dailyScores[name] = attempts;
      }
      const key = name.toLowerCase();
      if (!dailyScoresLowercase[key] || attempts < dailyScoresLowercase[key]) {
        dailyScoresLowercase[key] = attempts;
      }
    }

    // Build allPlayers array with scores or null
    const allPlayers = allNamesRows.map(row => {
      const name = row.name;
      const score = dailyScoresLowercase[name.toLowerCase()];
      return {
        name: name,
        score: score !== undefined ? score : null
      };
    });

    // All-time totals
    const allRows = await sql(`
      SELECT p.player_name, SUM(s.attempts) AS total_attempts
      FROM scores s
      JOIN players p ON s.player_id = p.id
      GROUP BY p.player_name;
    `);

    const allScores = {};
    for (const row of allRows) {
      allScores[row.player_name] = Number(row.total_attempts);
    }

    return c.json({
      date,
      dailyPlayers: playersRows.map((r) => r.player_name),
      dailyScores,
      allScores,
      allPlayers
    });
  } catch (err) {
    console.error("status function error", err);
    return c.json({
      error: "Server error in status",
      details: err.message
    }, 500);
  }
}
