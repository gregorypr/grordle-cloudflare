
// api/status.js
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function ensureTables() {
  // Create players table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS players (
      id SERIAL PRIMARY KEY,
      player_name TEXT NOT NULL UNIQUE
    );
  `);

  // Create games table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS games (
      id SERIAL PRIMARY KEY,
      play_date DATE NOT NULL UNIQUE
    );
  `);

  // Create daily_players junction table with foreign keys
  await pool.query(`
    CREATE TABLE IF NOT EXISTS daily_players (
      id SERIAL PRIMARY KEY,
      game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      UNIQUE(game_id, player_id)
    );
  `);

  // Rename columns if they exist with old names (camelCase to snake_case)
  try {
    await pool.query(`ALTER TABLE daily_players RENAME COLUMN "gameId" TO game_id;`);
  } catch (e) {
    // Column already renamed or doesn't exist
  }
  try {
    await pool.query(`ALTER TABLE daily_players RENAME COLUMN "playerId" TO player_id;`);
  } catch (e) {
    // Column already renamed or doesn't exist
  }

  // Ensure player_id and game_id columns exist (add them if missing)
  try {
    await pool.query(`
      ALTER TABLE daily_players 
      ADD COLUMN IF NOT EXISTS player_id INTEGER REFERENCES players(id) ON DELETE CASCADE;
    `);
  } catch (e) {
    // Column already exists
  }
  try {
    await pool.query(`
      ALTER TABLE daily_players 
      ADD COLUMN IF NOT EXISTS game_id INTEGER REFERENCES games(id) ON DELETE CASCADE;
    `);
  } catch (e) {
    // Column already exists
  }

  // Create scores table with foreign keys
  await pool.query(`
    CREATE TABLE IF NOT EXISTS scores (
      id SERIAL PRIMARY KEY,
      game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      attempts INTEGER NOT NULL,
      success BOOLEAN NOT NULL,
      played_at TIMESTAMP DEFAULT NOW()
    );
  `);

  // Rename columns if they exist with old names
  try {
    await pool.query(`ALTER TABLE scores RENAME COLUMN "gameId" TO game_id;`);
  } catch (e) {
    // Column already renamed or doesn't exist
  }
  try {
    await pool.query(`ALTER TABLE scores RENAME COLUMN "playerId" TO player_id;`);
  } catch (e) {
    // Column already renamed or doesn't exist
  }

  // Ensure player_id and game_id columns exist (add them if missing)
  try {
    await pool.query(`
      ALTER TABLE scores 
      ADD COLUMN IF NOT EXISTS player_id INTEGER REFERENCES players(id) ON DELETE CASCADE;
    `);
  } catch (e) {
    // Column already exists
  }
  try {
    await pool.query(`
      ALTER TABLE scores 
      ADD COLUMN IF NOT EXISTS game_id INTEGER REFERENCES games(id) ON DELETE CASCADE;
    `);
  } catch (e) {
    // Column already exists
  }

  // Create member_start_words table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS member_start_words (
      id SERIAL PRIMARY KEY,
      member_name TEXT NOT NULL,
      word TEXT NOT NULL
    );
  `);

  // Create player_games table with foreign keys
  await pool.query(`
    CREATE TABLE IF NOT EXISTS player_games (
      id SERIAL PRIMARY KEY,
      game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      guesses JSONB NOT NULL DEFAULT '[]',
      completed BOOLEAN NOT NULL DEFAULT FALSE,
      target_word TEXT,
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(game_id, player_id)
    );
  `);

  // Add target_word column if it doesn't exist
  try {
    await pool.query(`
      ALTER TABLE player_games 
      ADD COLUMN IF NOT EXISTS target_word TEXT;
    `);
  } catch (e) {
    // Column already exists
  }

  // Rename columns if they exist with old names
  try {
    await pool.query(`ALTER TABLE player_games RENAME COLUMN "gameId" TO game_id;`);
  } catch (e) {
    // Column already renamed or doesn't exist
  }
  try {
    await pool.query(`ALTER TABLE player_games RENAME COLUMN "playerId" TO player_id;`);
  } catch (e) {
    // Column already renamed or doesn't exist
  }

  // Ensure player_id and game_id columns exist (add them if missing)
  try {
    await pool.query(`
      ALTER TABLE player_games 
      ADD COLUMN IF NOT EXISTS player_id INTEGER REFERENCES players(id) ON DELETE CASCADE;
    `);
  } catch (e) {
    // Column already exists
  }
  try {
    await pool.query(`
      ALTER TABLE player_games 
      ADD COLUMN IF NOT EXISTS game_id INTEGER REFERENCES games(id) ON DELETE CASCADE;
    `);
  } catch (e) {
    // Column already exists
  }

  // Create daily_start_words table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS daily_start_words (
      id SERIAL PRIMARY KEY,
      play_date DATE NOT NULL UNIQUE,
      word TEXT NOT NULL,
      member_name TEXT NOT NULL
    );
  `);
}

export default async (req, res) => {
  try {
    if (!connectionString) {
      throw new Error("DATABASE_URL not set");
    }

    await ensureTables();

    const date = req.query.date || new Date().toISOString().split("T")[0];

    console.log('[status] Received date parameter:', date);

    // Get or create game for this date
    let gameResult = await pool.query(
      `INSERT INTO games (play_date) VALUES ($1)
       ON CONFLICT (play_date) DO UPDATE SET play_date = EXCLUDED.play_date
       RETURNING id;`,
      [date]
    );
    const gameId = gameResult.rows[0].id;

    console.log('[status] Game ID for date', date, 'is:', gameId);

    // Debug: Check all games in the database
    const allGames = await pool.query(`SELECT id, play_date FROM games ORDER BY play_date DESC LIMIT 10;`);
    console.log('[status] Recent games in database:', allGames.rows);

    // Get all players who have ever played
    const allNamesRows = await pool.query(`
      SELECT player_name as name 
      FROM players
      ORDER BY LOWER(player_name);
    `);

    // Daily players for this game
    const playersRows = await pool.query(
      `SELECT p.player_name
       FROM daily_players dp
       JOIN players p ON dp.player_id = p.id
       WHERE dp.game_id = $1
       ORDER BY LOWER(p.player_name);`,
      [gameId]
    );

    // All scores for that date - show all completed games
    const scoreRows = await pool.query(
      `SELECT p.player_name, s.attempts, s.success, g.play_date
       FROM scores s
       JOIN players p ON s.player_id = p.id
       JOIN games g ON s.game_id = g.id
       WHERE s.game_id = $1 AND g.play_date = $2;`,
      [gameId, date]
    );

    console.log('[status] Date:', date, 'GameId:', gameId);
    console.log('[status] Score rows from database:', scoreRows.rows);
    console.log('[status] Number of scores found:', scoreRows.rowCount);

    const dailyScores = {};
    const dailyScoresLowercase = {};
    for (const row of scoreRows.rows) {
      const name = row.player_name;
      const attempts = Number(row.attempts);
      // Keep original case for API response
      if (!dailyScores[name] || attempts < dailyScores[name]) {
        dailyScores[name] = attempts;
      }
      // Also store lowercase key for matching
      const key = name.toLowerCase();
      if (!dailyScoresLowercase[key] || attempts < dailyScoresLowercase[key]) {
        dailyScoresLowercase[key] = attempts;
      }
    }

    console.log('[status] dailyScores:', dailyScores);
    console.log('[status] dailyScoresLowercase:', dailyScoresLowercase);

    // Build allPlayers array with scores or null (case-insensitive matching)
    const allPlayers = allNamesRows.rows.map(row => {
      const name = row.name;
      // Look up score using lowercase key - use undefined check instead of || to allow 0
      const score = dailyScoresLowercase[name.toLowerCase()];
      return {
        name: name,
        score: score !== undefined ? score : null
      };
    });

    console.log('[status] allPlayers:', allPlayers);

    // All-time totals
    const allRows = await pool.query(`
      SELECT p.player_name, SUM(s.attempts) AS total_attempts
      FROM scores s
      JOIN players p ON s.player_id = p.id
      GROUP BY p.player_name;
    `);

    const allScores = {};
    for (const row of allRows.rows) {
      allScores[row.player_name] = Number(row.total_attempts);
    }

    return res.status(200).json({
      date,
      dailyPlayers: playersRows.rows.map((r) => r.player_name),
      dailyScores,
      allScores,
      allPlayers
    });
  } catch (err) {
    console.error("status function error", err);
    console.error("Error stack:", err.stack);
    return res.status(500).json({
      error: "Server error in status",
      details: err.message,
      stack: err.stack
    });
  }
};
