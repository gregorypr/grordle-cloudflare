// api/completed-games.js
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function ensureTables() {
  // Ensure all necessary tables exist
  await pool.query(`
    CREATE TABLE IF NOT EXISTS games (
      id SERIAL PRIMARY KEY,
      play_date DATE NOT NULL UNIQUE
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS players (
      id SERIAL PRIMARY KEY,
      player_name TEXT NOT NULL UNIQUE
    );
  `);

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
}

export default async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).send("Method Not Allowed");
  }

  try {
    if (!connectionString) {
      throw new Error("DATABASE_URL not set");
    }

    await ensureTables();

    const { date } = req.query;

    if (!date) {
      return res.status(400).send("Missing date parameter");
    }

    // Get or create game for this date
    let gameResult = await pool.query(
      `INSERT INTO games (play_date) VALUES ($1)
       ON CONFLICT (play_date) DO UPDATE SET play_date = EXCLUDED.play_date
       RETURNING id;`,
      [date]
    );
    const gameId = gameResult.rows[0].id;

    // Get all players who have ever played
    const allNamesResult = await pool.query(`
      SELECT player_name as name 
      FROM players
      ORDER BY LOWER(player_name);
    `);

    // Get all completed games for this date
    const completedResult = await pool.query(
      `SELECT 
        p.player_name,
        pg.guesses,
        pg.completed,
        pg.target_word
      FROM player_games pg
      JOIN players p ON pg.player_id = p.id
      WHERE pg.game_id = $1 AND pg.completed = true;`,
      [gameId]
    );

    console.log('[completed-games] Date:', date, 'GameId:', gameId);
    console.log('[completed-games] Completed games found:', completedResult.rowCount);
    console.log('[completed-games] Completed games rows:', JSON.stringify(completedResult.rows, null, 2));

    // Build a map of completed games (case-insensitive)
    const completedMap = {};
    for (const row of completedResult.rows) {
      const key = row.player_name.toLowerCase();
      completedMap[key] = {
        playerName: row.player_name,
        guesses: row.guesses || [],
        completed: row.completed,
        targetWord: row.target_word
      };
    }

    // Build result array with all members
    const result = { rows: [] };
    for (const nameRow of allNamesResult.rows) {
      const name = nameRow.name;
      const key = name.toLowerCase();
      if (completedMap[key]) {
        result.rows.push(completedMap[key]);
      }
    }

    const games = result.rows.map(row => {
      const guesses = row.guesses || [];
      const attempts = guesses.length;
      
      return {
        playerName: row.playerName,
        guesses: guesses,
        attempts: attempts,
        completed: row.completed,
        targetWord: row.targetWord
      };
    });

    console.log('[completed-games] Returning games:', games.length);
    console.log('[completed-games] Games data:', JSON.stringify(games, null, 2));

    return res.status(200).json({
      ok: true,
      games,
      count: games.length
    });
  } catch (err) {
    console.error("completed-games function error", err);
    return res.status(500).json({
      error: "Server error in completed-games",
      details: err.message
    });
  }
};
