// Cloudflare Pages Function: status handler

export async function statusHandler(c) {
  const sql = c.get("sql");
  const org_id = c.get("org_id"); // Get tenant ID from middleware

  try {
    const date = c.req.query("date") || new Date().toISOString().split("T")[0];

    console.log('[status] Received date parameter:', date);
    console.log('[status] Tenant org_id:', org_id);

    // Get or create game for this date and tenant
    let gameResult = await sql(
      `SELECT id FROM games WHERE play_date = $1 AND COALESCE(org_id, 0) = COALESCE($2, 0);`,
      [date, org_id]
    );

    let gameId;
    if (gameResult.length === 0) {
      // Create new game
      gameResult = await sql(
        `INSERT INTO games (play_date, org_id) VALUES ($1, $2) RETURNING id;`,
        [date, org_id]
      );
      gameId = gameResult[0].id;
    } else {
      gameId = gameResult[0].id;
    }

    // Get all players who have ever played in this tenant
    const allNamesRows = await sql(`
      SELECT player_name as name
      FROM players
      WHERE COALESCE(org_id, 0) = COALESCE($1, 0)
      ORDER BY LOWER(player_name);
    `, [org_id]);

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

    // All-time totals for this tenant
    const allRows = await sql(`
      SELECT p.player_name, SUM(s.attempts) AS total_attempts
      FROM scores s
      JOIN players p ON s.player_id = p.id
      JOIN games g ON s.game_id = g.id
      WHERE COALESCE(p.org_id, 0) = COALESCE($1, 0)
        AND COALESCE(g.org_id, 0) = COALESCE($1, 0)
      GROUP BY p.player_name;
    `, [org_id]);

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
