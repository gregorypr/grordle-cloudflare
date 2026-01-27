// tools/reset-all-data-standalone.js
// Standalone script to reset all user/game and word state data except the wordlist table
// Usage: node tools/reset-all-data-standalone.js

import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function resetAllData() {
  try {
    if (!connectionString) {
      throw new Error("DATABASE_URL not set");
    }
    console.log("Starting standalone reset all data operation...");

    // Golf and daily word/game tables
    await pool.query(`DELETE FROM golf_holes WHERE 1=1;`);
    console.log("Deleted golf_holes");
    await pool.query(`DELETE FROM golf_rounds WHERE 1=1;`);
    console.log("Deleted golf_rounds");
    await pool.query(`DELETE FROM daily_golf_course WHERE 1=1;`);
    console.log("Deleted daily_golf_course");
    await pool.query(`DELETE FROM daily_word_overrides WHERE 1=1;`);
    console.log("Deleted daily_word_overrides");

    // Existing user/game tables
    await pool.query(`DELETE FROM player_games WHERE 1=1;`);
    console.log("Deleted player_games");
    await pool.query(`DELETE FROM scores WHERE 1=1;`);
    console.log("Deleted scores");
    await pool.query(`DELETE FROM daily_players WHERE 1=1;`);
    console.log("Deleted daily_players");
    await pool.query(`DELETE FROM games WHERE 1=1;`);
    console.log("Deleted games");
    await pool.query(`DELETE FROM players WHERE 1=1;`);
    console.log("Deleted players");
    await pool.query(`DELETE FROM member_start_words WHERE 1=1;`);
    console.log("Deleted member_start_words");
    await pool.query(`DELETE FROM daily_start_words WHERE 1=1;`);
    console.log("Deleted daily_start_words");

    // Reset all sequences to 1
    await pool.query(`ALTER SEQUENCE IF EXISTS player_games_id_seq RESTART WITH 1;`);
    await pool.query(`ALTER SEQUENCE IF EXISTS scores_id_seq RESTART WITH 1;`);
    await pool.query(`ALTER SEQUENCE IF EXISTS daily_players_id_seq RESTART WITH 1;`);
    await pool.query(`ALTER SEQUENCE IF EXISTS games_id_seq RESTART WITH 1;`);
    await pool.query(`ALTER SEQUENCE IF EXISTS players_id_seq RESTART WITH 1;`);
    console.log("Reset all sequences");

    // Verify deletion
    const verifyPlayers = await pool.query(`SELECT COUNT(*) as count FROM players;`);
    const verifyGames = await pool.query(`SELECT COUNT(*) as count FROM games;`);
    const verifyScores = await pool.query(`SELECT COUNT(*) as count FROM scores;`);
    const verifyDailyPlayers = await pool.query(`SELECT COUNT(*) as count FROM daily_players;`);
    const verifyPlayerGames = await pool.query(`SELECT COUNT(*) as count FROM player_games;`);
    
    console.log("Verification counts:", {
      players: verifyPlayers.rows[0].count,
      games: verifyGames.rows[0].count,
      scores: verifyScores.rows[0].count,
      daily_players: verifyDailyPlayers.rows[0].count,
      player_games: verifyPlayerGames.rows[0].count
    });

    console.log("Standalone reset all data operation completed successfully");
    console.log("All tables cleared and sequences reset");
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error("reset-all-data-standalone error", err);
    await pool.end();
    process.exit(1);
  }
}

resetAllData();
