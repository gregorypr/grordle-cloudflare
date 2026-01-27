// api/setup-database.js
// This endpoint creates all necessary database tables
// Call this once to initialise your database

import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

export default async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!connectionString) {
      throw new Error("DATABASE_URL not set");
    }

    console.log("[setup-database] Starting database setup...");

    // 1. Create wordlist table
    console.log("[setup-database] Creating wordlist table...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS wordlist (
        id SERIAL PRIMARY KEY,
        word TEXT NOT NULL UNIQUE,
        difficulty INTEGER,
        scrabble_score INTEGER,
        par INTEGER
      );
    `);

    // Create index on word
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_wordlist_word ON wordlist(word);
    `);

    // Create index on par
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_wordlist_par ON wordlist(par);
    `);

    // 2. Create daily golf course table
    console.log("[setup-database] Creating daily_golf_course table...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS daily_golf_course (
        id SERIAL PRIMARY KEY,
        course_date DATE NOT NULL,
        hole_number INTEGER NOT NULL CHECK (hole_number >= 1 AND hole_number <= 9),
        target_word TEXT NOT NULL,
        start_word TEXT NOT NULL,
        par INTEGER NOT NULL,
        UNIQUE(course_date, hole_number)
      );
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_daily_golf_course_date ON daily_golf_course(course_date);
    `);

    // 3. Create golf tables
    console.log("[setup-database] Creating golf_rounds table...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS golf_rounds (
        id SERIAL PRIMARY KEY,
        player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        started_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP,
        total_score INTEGER,
        current_hole INTEGER DEFAULT 1,
        is_completed BOOLEAN DEFAULT FALSE
      );
    `);

    console.log("[setup-database] Creating golf_holes table...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS golf_holes (
        id SERIAL PRIMARY KEY,
        round_id INTEGER NOT NULL REFERENCES golf_rounds(id) ON DELETE CASCADE,
        hole_number INTEGER NOT NULL CHECK (hole_number >= 1 AND hole_number <= 9),
        target_word TEXT NOT NULL,
        start_word TEXT NOT NULL,
        par INTEGER NOT NULL,
        attempts INTEGER,
        score INTEGER,
        completed_at TIMESTAMP,
        UNIQUE(round_id, hole_number)
      );
    `);

    // Create golf indexes
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_golf_rounds_player ON golf_rounds(player_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_golf_holes_round ON golf_holes(round_id);`);

    console.log("[setup-database] Database setup complete!");

    // Get table counts
    const wordlistCount = await pool.query(`SELECT COUNT(*) FROM wordlist;`);
    const golfRoundsCount = await pool.query(`SELECT COUNT(*) FROM golf_rounds;`);

    return res.status(200).json({
      ok: true,
      message: "Database setup complete",
      tables: {
        wordlist: {
          exists: true,
          count: parseInt(wordlistCount.rows[0].count)
        },
        golf_rounds: {
          exists: true,
          count: parseInt(golfRoundsCount.rows[0].count)
        },
        golf_holes: {
          exists: true
        }
      }
    });
  } catch (err) {
    console.error("[setup-database] Error:", err);
    return res.status(500).json({
      error: "Server error in setup-database",
      details: err.message
    });
  }
};
