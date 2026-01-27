import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function checkYourRound() {
  try {
    // Check your most recent round
    const result = await pool.query(
      `SELECT gr.id, gr.player_id, gr.started_at, gr.current_hole, gr.is_completed,
              gh.hole_number, gh.target_word, gh.attempts, gh.score, gh.guesses
       FROM golf_rounds gr
       JOIN golf_holes gh ON gr.id = gh.round_id
       WHERE gr.player_id = 1 
       AND gr.started_at >= NOW() - INTERVAL '2 hours'
       ORDER BY gr.started_at DESC, gh.hole_number`
    );
    
    console.log("Your recent rounds:");
    console.table(result.rows);
    
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    await pool.end();
    process.exit(1);
  }
}

checkYourRound();
