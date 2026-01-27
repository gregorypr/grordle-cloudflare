import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function checkActiveRounds() {
  try {
    // Get recent rounds
    const rounds = await pool.query(
      `SELECT gr.id, gr.player_id, gr.started_at, gh.hole_number, gh.target_word 
       FROM golf_rounds gr
       JOIN golf_holes gh ON gr.id = gh.round_id
       WHERE gr.started_at >= NOW() - INTERVAL '2 hours'
       AND gh.hole_number = 1
       ORDER BY gr.started_at DESC
       LIMIT 10`
    );
    
    console.log("Recent rounds (last 2 hours) - Hole 1:");
    console.table(rounds.rows);
    
    // Check if any have DELVE
    const delveRounds = rounds.rows.filter(r => r.target_word === 'DELVE');
    if (delveRounds.length > 0) {
      console.log(`\nFound ${delveRounds.length} rounds with DELVE as hole 1`);
      
      // Get all holes for the first DELVE round
      const roundId = delveRounds[0].id;
      const holes = await pool.query(
        "SELECT * FROM golf_holes WHERE round_id = $1 ORDER BY hole_number",
        [roundId]
      );
      console.log(`\nAll holes for round ${roundId}:`);
      console.table(holes.rows);
    }
    
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    await pool.end();
    process.exit(1);
  }
}

checkActiveRounds();
