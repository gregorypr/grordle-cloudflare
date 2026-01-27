// api/golf-leaderboard.js
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

// Helper to get Australian date/time (AEST/AEDT)
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
  // Get current date in Australian timezone
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

export default async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!connectionString) {
      throw new Error("DATABASE_URL not set");
    }

    const { period = "all" } = req.query;

    console.log("[golf-leaderboard] Fetching leaderboard for period:", period);

    // Calculate date filter based on period using parameterized queries
    let dateFilter = "";
    let queryParams = [];
    const now = getAustralianNow();
    
    if (period === "daily") {
      // Today only (Australian date)
      const today = getAustralianDate();
      dateFilter = `AND gr.completed_at::date = $1::date`;
      queryParams.push(today);
    } else if (period === "weekly") {
      // Fixed week periods starting from January 1st
      const currentYear = now.getFullYear();
      const startOfYear = new Date(currentYear, 0, 1); // Jan 1
      
      // Calculate which week we're in (starting from 1)
      const daysSinceYearStart = Math.floor((now - startOfYear) / (24 * 60 * 60 * 1000));
      const weekNumber = Math.floor(daysSinceYearStart / 7) + 1;
      
      // Calculate start and end dates for this week
      const weekStartDay = (weekNumber - 1) * 7;
      const weekStart = new Date(currentYear, 0, 1 + weekStartDay);
      const weekEnd = new Date(currentYear, 0, 1 + weekStartDay + 7);
      
      dateFilter = `AND gr.completed_at >= $1 AND gr.completed_at < $2`;
      queryParams.push(weekStart.toISOString(), weekEnd.toISOString());
    } else if (period === "monthly") {
      // This month
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFilter = `AND gr.completed_at >= $1`;
      queryParams.push(firstOfMonth.toISOString());
    } else if (period === "yearly") {
      // This year
      const firstOfYear = new Date(now.getFullYear(), 0, 1);
      dateFilter = `AND gr.completed_at >= $1`;
      queryParams.push(firstOfYear.toISOString());
    }
    // "all" = no filter

    // Get all completed rounds with player names and hole scores
    const result = await pool.query(`
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

    // Calculate week number if weekly period
    let weekInfo = null;
    if (period === "weekly") {
      const currentYear = now.getFullYear();
      const startOfYear = new Date(currentYear, 0, 1);
      const daysSinceYearStart = Math.floor((now - startOfYear) / (24 * 60 * 60 * 1000));
      const weekNumber = Math.floor(daysSinceYearStart / 7) + 1;
      weekInfo = { weekNumber, year: currentYear };
    }

    return res.status(200).json({
      ok: true,
      leaderboard: result.rows,
      weekInfo
    });
  } catch (err) {
    console.error("golf-leaderboard function error", err);
    return res.status(500).json({
      error: "Server error in golf-leaderboard",
      details: err.message
    });
  }
};
