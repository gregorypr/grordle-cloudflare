// api/leaderboard.js
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

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

export default async (req, res) => {
  try {
    if (!connectionString) {
      throw new Error("DATABASE_URL not set");
    }

    const { period } = req.query; // 'today', 'week', 'month', 'year', or 'all'

    const today = getAustralianDate();
    
    let startDate = null;
    let endDate = today;
    let weekInfo = null;
    
    if (period === 'today') {
      startDate = today;
    } else if (period === 'week') {
      // Fixed week periods starting from January 1st
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
      
      // Calculate which week we're in (starting from 1)
      const daysSinceYearStart = Math.floor((currentDate - startOfYear) / (24 * 60 * 60 * 1000));
      const weekNumber = Math.floor(daysSinceYearStart / 7) + 1;
      
      // Calculate start and end dates for this week
      const weekStartDay = (weekNumber - 1) * 7;
      const weekStart = new Date(year, 0, 1 + weekStartDay);
      const weekEnd = new Date(year, 0, 1 + weekStartDay + 6); // 6 days later (7-day week)
      
      startDate = weekStart.toISOString().split('T')[0];
      endDate = weekEnd.toISOString().split('T')[0];
      weekInfo = { weekNumber, year };
    } else if (period === 'month') {
      // Current calendar month
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
      // Current calendar year
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-AU', {
        timeZone: 'Australia/Sydney',
        year: 'numeric'
      });
      const parts = formatter.formatToParts(now);
      const year = parts.find(p => p.type === 'year').value;
      startDate = `${year}-01-01`;
    }

    console.log(`[leaderboard] Period: ${period}, Start: ${startDate}, End: ${endDate}`);

    // Get all players
    const playersQuery = 'SELECT id, player_name FROM players ORDER BY player_name';
    const playersResult = await pool.query(playersQuery);
    const allPlayers = playersResult.rows;

    // Get all game dates in the period
    let datesQuery;
    if (startDate) {
      datesQuery = `
        SELECT DISTINCT play_date 
        FROM games 
        WHERE play_date >= $1 AND play_date <= $2
        ORDER BY play_date
      `;
    } else {
      datesQuery = `
        SELECT DISTINCT play_date 
        FROM games 
        ORDER BY play_date
      `;
    }

    const datesResult = startDate 
      ? await pool.query(datesQuery, [startDate, endDate])
      : await pool.query(datesQuery);
    
    const gameDates = datesResult.rows.map(r => r.play_date);

    console.log(`[leaderboard] Found ${gameDates.length} game dates`);

    // For each player, calculate their score
    const leaderboard = [];

    for (const player of allPlayers) {
      let totalScore = 0;
      let gamesPlayed = 0;

      for (const gameDate of gameDates) {
        // Check if player played on this date
        const scoreQuery = `
          SELECT s.attempts
          FROM scores s
          JOIN games g ON s.game_id = g.id
          WHERE s.player_id = $1 AND g.play_date = $2
          LIMIT 1
        `;
        
        const scoreResult = await pool.query(scoreQuery, [player.id, gameDate]);

        if (scoreResult.rows.length > 0) {
          // Player played - add their score
          totalScore += scoreResult.rows[0].attempts;
          gamesPlayed++;
        } else {
          // Player didn't play - add 8 points
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

    console.log(`[leaderboard] Returning ${leaderboard.length} players`);

    return res.status(200).json({
      ok: true,
      period: period || 'all',
      leaderboard,
      weekInfo
    });
  } catch (err) {
    console.error("leaderboard function error", err);
    return res.status(500).json({
      error: "Server error in leaderboard",
      details: err.message
    });
  }
};
