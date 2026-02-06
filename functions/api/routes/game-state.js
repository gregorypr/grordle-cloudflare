// Cloudflare Pages Function: game-state handler
// Combined API to get all initial game state in one call

function getAustralianDate() {
  const formatter = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Sydney',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = formatter.formatToParts(new Date());
  const year = parts.find(p => p.type === 'year').value;
  const month = parts.find(p => p.type === 'month').value;
  const day = parts.find(p => p.type === 'day').value;
  return `${year}-${month}-${day}`;
}

export async function gameStateHandler(c) {
  const sql = c.get("sql");
  const org_id = c.get("org_id"); // Get tenant ID from middleware

  try {
    const date = c.req.query("date") || getAustralianDate();

    console.log("[game-state] Fetching game state for date:", date, "org_id:", org_id);

    // Get target word
    const wordResult = await sql("SELECT word FROM wordlist ORDER BY id");

    if (wordResult.length === 0) {
      return c.json({ ok: false, error: "Wordlist is empty" }, 500);
    }

    const wordlist = wordResult.map((row) => row.word);

    // Generate deterministic seed from date
    const targetPrefix = "TARGET:";
    const seedString = targetPrefix + date;
    let seed = 0;
    for (let i = 0; i < seedString.length; i++) {
      seed = (seed * 31 + seedString.charCodeAt(i)) >>> 0;
    }
    const index = seed % wordlist.length;
    const targetWord = wordlist[index];

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

    // Get all players who have played today
    const playersResult = await sql(
      `SELECT p.player_name,
              COALESCE((SELECT s.attempts FROM scores s WHERE s.player_id = p.id AND s.game_id = $1 LIMIT 1), 0) as attempts,
              COALESCE((SELECT s.success FROM scores s WHERE s.player_id = p.id AND s.game_id = $1 LIMIT 1), false) as completed
       FROM daily_players dp
       JOIN players p ON dp.player_id = p.id
       WHERE dp.game_id = $1
       ORDER BY LOWER(p.player_name);`,
      [gameId]
    );

    const dailyPlayers = playersResult.map((row) => ({
      name: row.player_name,
      attempts: row.attempts,
      completed: row.completed,
    }));

    // Get daily scores
    const dailyScoresResult = await sql(
      `SELECT p.player_name, MIN(s.attempts) as best_score
       FROM scores s
       JOIN players p ON s.player_id = p.id
       WHERE s.game_id = $1 AND s.success = true
       GROUP BY p.player_name`,
      [gameId]
    );

    const dailyScores = {};
    dailyScoresResult.forEach((row) => {
      dailyScores[row.player_name] = row.best_score;
    });

    // Get all-time scores (tenant-scoped)
    const allScoresResult = await sql(
      `SELECT p.player_name, SUM(s.attempts) as total_score
       FROM scores s
       JOIN players p ON s.player_id = p.id
       WHERE s.success = true AND COALESCE(p.org_id, 0) = COALESCE($1, 0)
       GROUP BY p.player_name
       ORDER BY total_score ASC`,
      [org_id]
    );

    const allScores = {};
    const allPlayers = [];
    allScoresResult.forEach((row) => {
      allScores[row.player_name] = row.total_score;
      allPlayers.push(row.player_name);
    });

    // Get target word difficulty/par
    const wordInfoResult = await sql(
      "SELECT difficulty, par FROM wordlist WHERE word = $1",
      [targetWord]
    );

    const wordInfo = wordInfoResult[0] || { difficulty: null, par: null };

    return c.json({
      ok: true,
      targetWord,
      difficulty: wordInfo.difficulty,
      par: wordInfo.par,
      date,
      dailyPlayers,
      dailyScores,
      allScores,
      allPlayers,
    });
  } catch (err) {
    console.error("[game-state] Error:", err);
    return c.json({ ok: false, error: err.message }, 500);
  }
}
