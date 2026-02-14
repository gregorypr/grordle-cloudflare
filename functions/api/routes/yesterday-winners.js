// Cloudflare Pages Function: yesterday-winners handler
// Returns the daily and golf winners from yesterday

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

function getYesterdayDate() {
  const today = getAustralianDate();
  const [year, month, day] = today.split('-').map(Number);
  const yesterday = new Date(year, month - 1, day - 1);
  const pad = (n) => String(n).padStart(2, '0');
  return `${yesterday.getFullYear()}-${pad(yesterday.getMonth() + 1)}-${pad(yesterday.getDate())}`;
}

export async function yesterdayWinnersHandler(c) {
  const sql = c.get("sql");
  const org_id = c.get("org_id");

  try {
    const yesterday = getYesterdayDate();

    // Get yesterday's daily winners (all players tied for lowest attempts)
    const dailyResult = await sql(
      `SELECT p.player_name, s.attempts
       FROM scores s
       JOIN players p ON s.player_id = p.id
       JOIN games g ON s.game_id = g.id
       WHERE g.play_date = $1
         AND s.success = true
         AND COALESCE(p.org_id, 0) = COALESCE($2, 0)
         AND COALESCE(g.org_id, 0) = COALESCE($2, 0)
         AND s.attempts = (
           SELECT MIN(s2.attempts)
           FROM scores s2
           JOIN games g2 ON s2.game_id = g2.id
           WHERE g2.play_date = $1
             AND s2.success = true
             AND COALESCE(g2.org_id, 0) = COALESCE($2, 0)
         )
       ORDER BY p.player_name ASC`,
      [yesterday, org_id]
    );

    // Get yesterday's golf winners (all players tied for lowest total_score)
    const golfResult = await sql(
      `SELECT p.player_name, gr.total_score
       FROM golf_rounds gr
       JOIN players p ON gr.player_id = p.id
       WHERE gr.is_completed = true
         AND gr.completed_at::date = $1
         AND COALESCE(p.org_id, 0) = COALESCE($2, 0)
         AND COALESCE(gr.org_id, 0) = COALESCE($2, 0)
         AND gr.total_score = (
           SELECT MIN(gr2.total_score)
           FROM golf_rounds gr2
           JOIN players p2 ON gr2.player_id = p2.id
           WHERE gr2.is_completed = true
             AND gr2.completed_at::date = $1
             AND COALESCE(p2.org_id, 0) = COALESCE($2, 0)
             AND COALESCE(gr2.org_id, 0) = COALESCE($2, 0)
         )
       ORDER BY p.player_name ASC`,
      [yesterday, org_id]
    );

    return c.json({
      ok: true,
      date: yesterday,
      dailyWinners: dailyResult.length > 0
        ? dailyResult.map(r => ({ name: r.player_name, attempts: r.attempts }))
        : null,
      golfWinners: golfResult.length > 0
        ? golfResult.map(r => ({ name: r.player_name, score: r.total_score }))
        : null,
    });
  } catch (err) {
    console.error("[yesterday-winners] Error:", err);
    return c.json({ ok: false, error: err.message }, 500);
  }
}
