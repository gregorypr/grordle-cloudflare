
// api/start.js
import { Pool } from "pg";
import fs from "fs";
import path from "path";

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

// Load wordlist once at startup
let wordlistArray = null;
function loadWordlist() {
  if (wordlistArray) return wordlistArray;

  const wordlistPath = path.join(process.cwd(), "data", "wordlist-table-cleaned.txt");
  const content = fs.readFileSync(wordlistPath, "utf8");
  const lines = content.trim().split("\n").slice(1); // Skip header
  wordlistArray = lines.map(line => line.split(/\t/)[0].toUpperCase());
  return wordlistArray;
}

// Generate start word from date using server's wordlist
function generateStartWord(date) {
  const words = loadWordlist();
  const dateStr = "START:" + date;
  let seed = 0;
  for (let i = 0; i < dateStr.length; i++) {
    seed = (seed * 31 + dateStr.charCodeAt(i)) >>> 0;
  }
  const wordIndex = seed % words.length;
  return words[wordIndex];
}

// Run table setup once when the module first loads
let tablesInitialized = false;

async function ensureTables() {
  if (tablesInitialized) return;
  tablesInitialized = true;
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

  // Drop play_date column if it exists (old schema - date is stored in games table)
  try {
    await pool.query(`ALTER TABLE daily_players DROP COLUMN IF EXISTS play_date;`);
  } catch (e) {
    // Column doesn't exist or already dropped
  }

  // Drop player_name column if it exists (old schema - name is stored in players table)
  try {
    await pool.query(`ALTER TABLE daily_players DROP COLUMN IF EXISTS player_name;`);
  } catch (e) {
    // Column doesn't exist or already dropped
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

  // Create daily_start_words table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS daily_start_words (
      id SERIAL PRIMARY KEY,
      play_date DATE NOT NULL UNIQUE,
      word TEXT NOT NULL,
      member_name TEXT NOT NULL
    );
  `);

  // Create index on play_date for faster lookups
  try {
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_daily_start_words_date 
      ON daily_start_words(play_date);
    `);
  } catch (e) {
    // Index already exists
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
    const { date, playerName } = body;

    console.log("start.js called with:", { date, playerName });

    if (!date || !playerName) {
      console.error("Missing required fields", { date, playerName });
      return res.status(400).json({ error: "Missing date or playerName" });
    }

    console.log("Ensuring tables...");
    await ensureTables();

    // Get or generate start word - check database first for consistency
    let startWord;
    const existingStartWord = await pool.query(
      `SELECT word FROM daily_start_words WHERE play_date = $1;`,
      [date]
    );

    if (existingStartWord.rowCount > 0) {
      // Use the stored start word for consistency
      startWord = existingStartWord.rows[0].word;
      console.log("Using stored start word from database:", startWord);
    } else {
      // Generate and store the start word for this date
      startWord = generateStartWord(date);
      console.log("Generated new start word:", startWord);

      // Store it in the database so all players get the same word
      try {
        await pool.query(
          `INSERT INTO daily_start_words (play_date, word, member_name)
           VALUES ($1, $2, $3)
           ON CONFLICT (play_date) DO NOTHING;`,
          [date, startWord, "System"]
        );
        console.log("Stored start word in database for consistency");
      } catch (err) {
        console.log("Start word already stored by another request:", err.message);
      }
    }
    console.log("Tables ensured");

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

    // Check if this player already started this game
    const existing = await pool.query(
      `SELECT id FROM daily_players
       WHERE game_id = $1 AND player_id = $2
       LIMIT 1;`,
      [gameId, playerId]
    );

    console.log(`[start.js] Checking existing entry for ${playerName} (ID: ${playerId}, GameID: ${gameId}):`, existing.rowCount > 0 ? 'FOUND' : 'NOT FOUND');

    if (existing.rowCount > 0) {
      // Player already started - check if they have a completed score
      const completedScore = await pool.query(
        `SELECT id FROM scores
         WHERE game_id = $1 AND player_id = $2 AND success = TRUE
         LIMIT 1;`,
        [gameId, playerId]
      );

      console.log(`[start.js] Checking if ${playerName} has completed score:`, completedScore.rowCount > 0 ? 'YES' : 'NO');

      // If they completed the game, block them
      if (completedScore.rowCount > 0) {
        // Player already completed - return all players for this game
        const playersRows = await pool.query(
          `SELECT p.player_name
           FROM daily_players dp
           JOIN players p ON dp.player_id = p.id
           WHERE dp.game_id = $1
           ORDER BY LOWER(p.player_name);`,
          [gameId]
        );

        // Check if player has existing game state to resume (only for today's date)
        const gameState = await pool.query(
          `SELECT pg.guesses, pg.completed, pg.target_word
           FROM player_games pg
           JOIN games g ON pg.game_id = g.id
           WHERE pg.game_id = $1 AND pg.player_id = $2 AND g.play_date = $3;`,
          [gameId, playerId, date]
        );

        const response = {
          allowed: false,
          dailyPlayers: playersRows.rows.map((r) => r.player_name)
        };

        // Include game state if it exists
        if (gameState.rowCount > 0) {
          response.gameState = {
            guesses: gameState.rows[0].guesses,
            completed: gameState.rows[0].completed,
            targetWord: gameState.rows[0].target_word
          };
        }

      // Use generated start word or try to get from database
      if (startWord) {
        response.startWord = startWord;
        response.startWordOwner = "System";
      } else {
        const startWordResult = await pool.query(
          `SELECT word, member_name FROM daily_start_words WHERE play_date = $1;`,
          [date]
        );

        if (startWordResult.rowCount > 0) {
          response.startWord = startWordResult.rows[0].word;
          response.startWordOwner = startWordResult.rows[0].member_name;
        }
      }

      return res.status(200).json(response);
      }

      // Player started but didn't complete - allow them to resume
      console.log(`[start.js] ${playerName} started but didn't complete. Allowing resume.`);
      // Fall through to allow them to play/resume
    }

    // Insert this player as having started today (if not already)
    if (existing.rowCount === 0) {
      await pool.query(
        `INSERT INTO daily_players (game_id, player_id)
         VALUES ($1, $2);`,
        [gameId, playerId]
      );
    }

    // Return all players for this game
    const playersRows = await pool.query(
      `SELECT p.player_name
       FROM daily_players dp
       JOIN players p ON dp.player_id = p.id
       WHERE dp.game_id = $1
       ORDER BY LOWER(p.player_name);`,
      [gameId]
    );

    // Check if player has existing game state to resume (only for today's date)
    const gameState = await pool.query(
      `SELECT pg.guesses, pg.completed, pg.target_word
       FROM player_games pg
       JOIN games g ON pg.game_id = g.id
       WHERE pg.game_id = $1 AND pg.player_id = $2 AND g.play_date = $3;`,
      [gameId, playerId, date]
    );

    const response = {
      allowed: true,
      dailyPlayers: playersRows.rows.map((r) => r.player_name)
    };

    // Include game state if it exists
    if (gameState.rowCount > 0) {
      response.gameState = {
        guesses: gameState.rows[0].guesses,
        completed: gameState.rows[0].completed,
        targetWord: gameState.rows[0].target_word
      };
    }

    // Use generated start word or try to get from database
    if (startWord) {
      response.startWord = startWord;
      response.startWordOwner = "System";
    } else {
      const startWordResult = await pool.query(
        `SELECT word, member_name FROM daily_start_words WHERE play_date = $1;`,
        [date]
      );

      if (startWordResult.rowCount > 0) {
        response.startWord = startWordResult.rows[0].word;
        response.startWordOwner = startWordResult.rows[0].member_name;
      }
    }

    return res.status(200).json(response);
  } catch (err) {
    console.error("start function error", err);
    console.error("Error stack:", err.stack);
    console.error("Error details:", {
      message: err.message,
      code: err.code,
      detail: err.detail
    });
    return res.status(500).json({
      error: "Server error in start",
      details: err.message,
      code: err.code
    });
  }
};
