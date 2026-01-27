// api/config.js
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

  // Create member_start_words table (no FK - members may not be in players table)
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
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(game_id, player_id)
    );
  `);

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

  // Create wordlist table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS wordlist (
      id SERIAL PRIMARY KEY,
      word VARCHAR(5) NOT NULL UNIQUE,
      difficulty DECIMAL(5,2) NOT NULL,
      scrabble_score INTEGER NOT NULL,
      par INTEGER NOT NULL CHECK (par IN (3, 4, 5))
    );
  `);

  // Create index on word for fast lookups
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_wordlist_word ON wordlist(word);
  `);

  // Create index on par for filtering
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_wordlist_par ON wordlist(par);
  `);
}

function normalizeConfig(raw) {
  const result = {};
  if (!raw || typeof raw !== "object") return result;
  for (const [member, words] of Object.entries(raw)) {
    if (!member || !Array.isArray(words)) continue;
    const trimmedMember = String(member).trim();
    if (!trimmedMember) continue;
    const cleanWords = [];
    for (const w of words) {
      const upper = String(w || "").toUpperCase().trim();
      if (/^[A-Z]{5}$/.test(upper)) {
        cleanWords.push(upper);
      }
    }
    if (cleanWords.length) {
      result[trimmedMember] = Array.from(new Set(cleanWords));
    }
  }
  return result;
}

export { pool, ensureTables, normalizeConfig };

// Removed illegal top-level return statements and API handler logic.
