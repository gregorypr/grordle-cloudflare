
// api/save-game.js
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
}

export default async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  try {
    if (!connectionString) {
      throw new Error("DATABASE_URL not set");
    }

    const body = req.body || {};
    const { date, playerName, guesses, completed, targetWord } = body;

    if (!date || !playerName || !Array.isArray(guesses)) {
      return res.status(400).send("Missing or invalid fields");
    }

    await ensureTables();

    // Get or create game for this date
    let gameResult = await pool.query(
      `INSERT INTO games (play_date) VALUES ($1)
       ON CONFLICT (play_date) DO UPDATE SET play_date = EXCLUDED.play_date
       RETURNING id;`,
      [date]
    );
    const gameId = gameResult.rows[0].id;

    // Get or create player (case-insensitive lookup)
    let existingPlayer = await pool.query(
      `SELECT id, player_name FROM players WHERE LOWER(player_name) = LOWER($1);`,
      [playerName]
    );
    
    let playerResult;
    if (existingPlayer.rowCount > 0) {
      playerResult = existingPlayer;
    } else {
      playerResult = await pool.query(
        `INSERT INTO players (player_name) VALUES ($1) RETURNING id;`,
        [playerName]
      );
    }
    const playerId = playerResult.rows[0].id;

    // Upsert game state
    await pool.query(
      `INSERT INTO player_games (game_id, player_id, guesses, completed, target_word, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (game_id, player_id)
       DO UPDATE SET 
         guesses = EXCLUDED.guesses,
         completed = EXCLUDED.completed,
         target_word = EXCLUDED.target_word,
         updated_at = NOW();`,
      [gameId, playerId, JSON.stringify(guesses), completed || false, targetWord || null]
    );

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("save-game function error", err);
    return res.status(500).json({
      error: "Server error in save-game",
      details: err.message
    });
  }
};
