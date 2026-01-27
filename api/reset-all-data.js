// api/reset-all-data.js
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

    const { confirmPassword } = req.body;

    // Require admin password confirmation
    if (confirmPassword !== "admin123") {
      return res.status(403).json({ error: "Invalid password" });
    }

    console.log("Starting reset all data operation...");

    // First, check what's in the players table
    const checkPlayers = await pool.query(`SELECT id, player_name FROM players ORDER BY id;`);
    console.log("Current players before deletion:", checkPlayers.rows);

    // Delete in correct order to avoid foreign key issues
    console.log("Deleting all user/game and word state data (except wordlist)...");

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

    console.log("Reset all data operation completed successfully");
    console.log("All tables cleared and sequences reset");

    return res.status(200).json({ 
      ok: true, 
      message: "All user data has been reset" 
    });
  } catch (err) {
    console.error("reset-all-data function error", err);
    return res.status(500).json({
      error: "Server error in reset-all-data",
      details: err.message
    });
  }
};
