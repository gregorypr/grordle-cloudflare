// Combined API to get all initial game state in one call
// Returns: target word, player status, scores, daily players
// Eliminates multiple round-trips on login

import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

// Get Australian date (handles AEST/AEDT automatically)
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

export default async function handler(req, res) {
  try {
    const date = req.query.date || getAustralianDate();
    
    console.log("[game-state] Fetching game state for date:", date);

    // Get target word
    const wordResult = await pool.query(
      "SELECT word FROM wordlist ORDER BY ctid"
    );
    const wordlist = wordResult.rows.map((row) => row.word);
    
    console.log("[game-state] Wordlist length:", wordlist.length);
    
    if (wordlist.length === 0) {
      return res.status(500).json({ 
        ok: false, 
        error: "Wordlist is empty" 
      });
    }

    // Generate deterministic seed from date
    const targetPrefix = "TARGET:";
    const seedString = targetPrefix + date;
    let seed = 0;
    for (let i = 0; i < seedString.length; i++) {
      seed = (seed * 31 + seedString.charCodeAt(i)) >>> 0;
    }
    const index = seed % wordlist.length;
    const targetWord = wordlist[index];
    
    console.log("[game-state] Target word:", targetWord);

    // Get or create game for this date
    const gameResult = await pool.query(
      `INSERT INTO games (play_date) VALUES ($1)
       ON CONFLICT (play_date) DO UPDATE SET play_date = EXCLUDED.play_date
       RETURNING id;`,
      [date]
    );
    const gameId = gameResult.rows[0].id;

    // Get all players who have played today (from daily_players + players join)
    const playersResult = await pool.query(
      `SELECT p.player_name, 
              COALESCE((SELECT s.attempts FROM scores s WHERE s.player_id = p.id AND s.game_id = $1 LIMIT 1), 0) as attempts,
              COALESCE((SELECT s.success FROM scores s WHERE s.player_id = p.id AND s.game_id = $1 LIMIT 1), false) as completed
       FROM daily_players dp
       JOIN players p ON dp.player_id = p.id
       WHERE dp.game_id = $1
       ORDER BY LOWER(p.player_name);`,
      [gameId]
    );
    
    const dailyPlayers = playersResult.rows.map((row) => ({
      name: row.player_name,
      attempts: row.attempts,
      completed: row.completed,
    }));

    // Get daily scores (best score per player for this date)
    const dailyScoresResult = await pool.query(
      `SELECT p.player_name, MIN(s.attempts) as best_score
       FROM scores s
       JOIN players p ON s.player_id = p.id
       WHERE s.game_id = $1 AND s.success = true
       GROUP BY p.player_name`,
      [gameId]
    );

    const dailyScores = {};
    dailyScoresResult.rows.forEach((row) => {
      dailyScores[row.player_name] = row.best_score;
    });

    // Get all-time scores
    const allScoresResult = await pool.query(
      `SELECT p.player_name, SUM(s.attempts) as total_score
       FROM scores s
       JOIN players p ON s.player_id = p.id
       WHERE s.success = true
       GROUP BY p.player_name
       ORDER BY total_score ASC`
    );

    const allScores = {};
    const allPlayers = [];
    allScoresResult.rows.forEach((row) => {
      allScores[row.player_name] = row.total_score;
      allPlayers.push(row.player_name);
    });

    // Get target word difficulty/par from database
    const wordInfoResult = await pool.query(
      "SELECT difficulty, par FROM wordlist WHERE word = $1",
      [targetWord]
    );

    const wordInfo = wordInfoResult.rows[0] || { difficulty: null, par: null };

    const response = {
      ok: true,
      targetWord,
      difficulty: wordInfo.difficulty,
      par: wordInfo.par,
      date,
      dailyPlayers,
      dailyScores,
      allScores,
      allPlayers,
    };
    
    console.log("[game-state] Returning success response");
    return res.status(200).json(response);
  } catch (err) {
    console.error("[game-state] Error:", err);
    console.error("[game-state] Stack:", err.stack);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
