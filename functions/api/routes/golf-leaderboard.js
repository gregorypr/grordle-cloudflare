// Cloudflare Pages Function: golf-leaderboard handler

// Helper to get Australian date
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

function getAustralianNow() {
  const formatter = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Sydney',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const parts = formatter.formatToParts(new Date());
  const year = parts.find(p => p.type === 'year').value;
  const month = parts.find(p => p.type === 'month').value;
  const day = parts.find(p => p.type === 'day').value;
  const hour = parts.find(p => p.type === 'hour').value;
  const minute = parts.find(p => p.type === 'minute').value;
  const second = parts.find(p => p.type === 'second').value;
  return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
}

export async function golfLeaderboardHandler(c) {
  const sql = c.get("sql");

  try {
    const period = c.req.query("period") || "all";

    console.log("[golf-leaderboard] Fetching leaderboard for period:", period);

    // Calculate date filter based on period
    let dateFilter = "";
    let queryParams = [];
    const now = getAustralianNow();

    if (period === "daily") {
      const today = getAustralianDate();
      dateFilter = `AND gr.completed_at::date = $1::date`;
      queryParams.push(today);
    } else if (period === "weekly") {
      const currentYear = now.getFullYear();
      const startOfYear = new Date(currentYear, 0, 1);

      const daysSinceYearStart = Math.floor((now - startOfYear) / (24 * 60 * 60 * 1000));
      const weekNumber = Math.floor(daysSinceYearStart / 7) + 1;

      const weekStartDay = (weekNumber - 1) * 7;
      const weekStart = new Date(currentYear, 0, 1 + weekStartDay);
      const weekEnd = new Date(currentYear, 0, 1 + weekStartDay + 7);

      dateFilter = `AND gr.completed_at >= $1 AND gr.completed_at < $2`;
      queryParams.push(weekStart.toISOString(), weekEnd.toISOString());
    } else if (period === "monthly") {
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFilter = `AND gr.completed_at >= $1`;
      queryParams.push(firstOfMonth.toISOString());
    } else if (period === "yearly") {
      const firstOfYear = new Date(now.getFullYear(), 0, 1);
      dateFilter = `AND gr.completed_at >= $1`;
      queryParams.push(firstOfYear.toISOString());
    }

    // Get all completed rounds
    const result = await sql(`
      SELECT
        p.player_name,
        gr.id as round_id,
        gr.total_score,
        gr.completed_at,
        json_agg(
          json_build_object(
            'hole', gh.hole_number,
            'par', gh.par,
            'attempts', gh.attempts,
            'score', gh.score,
            'word', gh.target_word
          ) ORDER BY gh.hole_number
        ) as holes
      FROM golf_rounds gr
      JOIN players p ON gr.player_id = p.id
      LEFT JOIN golf_holes gh ON gr.id = gh.round_id
      WHERE gr.is_completed = TRUE ${dateFilter}
      GROUP BY p.player_name, gr.id, gr.total_score, gr.completed_at
      ORDER BY gr.total_score ASC, gr.completed_at ASC
      LIMIT 100;
    `, queryParams);

    // Calculate week info if weekly period
    let weekInfo = null;
    if (period === "weekly") {
      const currentYear = now.getFullYear();
      const startOfYear = new Date(currentYear, 0, 1);
      const daysSinceYearStart = Math.floor((now - startOfYear) / (24 * 60 * 60 * 1000));
      const weekNumber = Math.floor(daysSinceYearStart / 7) + 1;
      weekInfo = { weekNumber, year: currentYear };
    }

    return c.json({
      ok: true,
      leaderboard: result,
      weekInfo
    });
  } catch (err) {
    console.error("golf-leaderboard function error", err);
    return c.json({
      error: "Server error in golf-leaderboard",
      details: err.message
    }, 500);
  }
}
