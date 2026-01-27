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

    // Get all players
    const playersResult = await sql('SELECT id, player_name FROM players ORDER BY player_name');
    const allPlayers = playersResult;

    // Get all game dates in the period
    let datesResult;
    if (startDate) {
      datesResult = await sql(
        `SELECT DISTINCT play_date
         FROM games
         WHERE play_date >= $1 AND play_date <= $2
         ORDER BY play_date`,
        [startDate, endDate]
      );
    } else {
      datesResult = await sql(
        `SELECT DISTINCT play_date
         FROM games
         ORDER BY play_date`
      );
    }

    const gameDates = datesResult.map(r => r.play_date);

    // For each player, calculate their score
    const leaderboard = [];

    for (const player of allPlayers) {
      let totalScore = 0;
      let gamesPlayed = 0;

      for (const gameDate of gameDates) {
        const scoreResult = await sql(
          `SELECT s.attempts
           FROM scores s
           JOIN games g ON s.game_id = g.id
           WHERE s.player_id = $1 AND g.play_date = $2
           LIMIT 1`,
          [player.id, gameDate]
        );

        if (scoreResult.length > 0) {
          totalScore += scoreResult[0].attempts;
          gamesPlayed++;
        } else {
          totalScore += 8;
        }
      }

      if (gameDates.length > 0) {
        leaderboard.push({
          name: player.player_name,
          score: totalScore,
          gamesPlayed: gamesPlayed
        });
      }
    }

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
