// Cloudflare Pages Function: leaderboard handler

// Helper function for Australian date
const getAustralianDate = () => {
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
};

export async function leaderboardHandler(c) {
  const sql = c.get("sql");
  const org_id = c.get("org_id");

  try {
    const period = c.req.query("period"); // 'today', 'week', 'month', 'year', or 'all'

    const today = getAustralianDate();

    let startDate = null;
    let endDate = today;
    let weekInfo = null;

    if (period === 'today') {
      startDate = today;
    } else if (period === 'week') {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-AU', {
        timeZone: 'Australia/Sydney',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      const parts = formatter.formatToParts(now);
      const year = parseInt(parts.find(p => p.type === 'year').value);
      const month = parseInt(parts.find(p => p.type === 'month').value);
      const day = parseInt(parts.find(p => p.type === 'day').value);

      const currentDate = new Date(year, month - 1, day);
      const startOfYear = new Date(year, 0, 1);

      const daysSinceYearStart = Math.floor((currentDate - startOfYear) / (24 * 60 * 60 * 1000));
      const weekNumber = Math.floor(daysSinceYearStart / 7) + 1;

      const weekStartDay = (weekNumber - 1) * 7;
      const weekStart = new Date(year, 0, 1 + weekStartDay);
      const weekEnd = new Date(year, 0, 1 + weekStartDay + 6);

      startDate = weekStart.toISOString().split('T')[0];
      endDate = weekEnd.toISOString().split('T')[0];
      weekInfo = { weekNumber, year };
    } else if (period === 'month') {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-AU', {
        timeZone: 'Australia/Sydney',
        year: 'numeric',
        month: '2-digit'
      });
      const parts = formatter.formatToParts(now);
      const year = parts.find(p => p.type === 'year').value;
      const month = parts.find(p => p.type === 'month').value;
      startDate = `${year}-${month}-01`;
    } else if (period === 'year') {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-AU', {
        timeZone: 'Australia/Sydney',
        year: 'numeric'
      });
      const parts = formatter.formatToParts(now);
      const year = parts.find(p => p.type === 'year').value;
      startDate = `${year}-01-01`;
    }

    // Get leaderboard data in a single efficient query
    let leaderboardResult;
    if (startDate) {
      leaderboardResult = await sql(
        `WITH game_dates AS (
          SELECT DISTINCT play_date
          FROM games
          WHERE play_date >= $1 AND play_date <= $2
            AND COALESCE(org_id, 0) = COALESCE($3, 0)
        ),
        game_count AS (
          SELECT COUNT(*) as total_games FROM game_dates
        ),
        player_scores AS (
          SELECT
            p.id as player_id,
            p.player_name,
            COUNT(s.id) as games_played,
            COALESCE(SUM(s.attempts), 0) as total_attempts
          FROM players p
          LEFT JOIN scores s ON s.player_id = p.id
          LEFT JOIN games g ON s.game_id = g.id
            AND g.play_date >= $1 AND g.play_date <= $2
            AND COALESCE(g.org_id, 0) = COALESCE($3, 0)
          WHERE COALESCE(p.org_id, 0) = COALESCE($3, 0)
          GROUP BY p.id, p.player_name
        )
        SELECT
          ps.player_name,
          ps.games_played,
          ps.total_attempts,
          gc.total_games,
          (ps.total_attempts + (gc.total_games - ps.games_played) * 8) as total_score
        FROM player_scores ps
        CROSS JOIN game_count gc
        WHERE gc.total_games > 0
        ORDER BY total_score ASC`,
        [startDate, endDate, org_id]
      );
    } else {
      leaderboardResult = await sql(
        `WITH game_dates AS (
          SELECT DISTINCT play_date FROM games
          WHERE COALESCE(org_id, 0) = COALESCE($1, 0)
        ),
        game_count AS (
          SELECT COUNT(*) as total_games FROM game_dates
        ),
        player_scores AS (
          SELECT
            p.id as player_id,
            p.player_name,
            COUNT(s.id) as games_played,
            COALESCE(SUM(s.attempts), 0) as total_attempts
          FROM players p
          LEFT JOIN scores s ON s.player_id = p.id
          LEFT JOIN games g ON s.game_id = g.id
            AND COALESCE(g.org_id, 0) = COALESCE($1, 0)
          WHERE COALESCE(p.org_id, 0) = COALESCE($1, 0)
          GROUP BY p.id, p.player_name
        )
        SELECT
          ps.player_name,
          ps.games_played,
          ps.total_attempts,
          gc.total_games,
          (ps.total_attempts + (gc.total_games - ps.games_played) * 8) as total_score
        FROM player_scores ps
        CROSS JOIN game_count gc
        WHERE gc.total_games > 0
        ORDER BY total_score ASC`,
        [org_id]
      );
    }

    const leaderboard = leaderboardResult.map(row => ({
      name: row.player_name,
      score: parseInt(row.total_score),
      gamesPlayed: parseInt(row.games_played)
    }));

    // Sort by total score ascending (lower is better)
    leaderboard.sort((a, b) => a.score - b.score);

    return c.json({
      ok: true,
      period: period || 'all',
      leaderboard,
      weekInfo
    });
  } catch (err) {
    console.error("leaderboard function error", err);
    return c.json({
      error: "Server error in leaderboard",
      details: err.message
    }, 500);
  }
}
