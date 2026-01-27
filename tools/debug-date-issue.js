import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

// Same function as in the API
function getAustralianDate() {
  const formatter = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Sydney',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  const parts = formatter.formatToParts(new Date());
  const year = parts.find(p => p.type === 'year').value;
  const month = parts.find(p => p.type === 'month').value;
  const day = parts.find(p => p.type === 'day').value;
  
  return `${year}-${month}-${day}`;
}

async function debugDateIssue() {
  try {
    const today = getAustralianDate();
    console.log('getAustralianDate() returns:', today);
    
    // Check what the query would find
    const result = await pool.query(
      `SELECT id, started_at, 
              (started_at AT TIME ZONE 'UTC' AT TIME ZONE 'Australia/Sydney')::date as aus_date,
              current_hole, is_completed
       FROM golf_rounds 
       WHERE player_id = 1 
       AND (started_at AT TIME ZONE 'UTC' AT TIME ZONE 'Australia/Sydney')::date = $1::date
       ORDER BY started_at DESC;`,
      [today]
    );
    
    console.log(`\nRounds found for player 1 on date ${today}:`);
    console.table(result.rows);
    
    // Also show all recent rounds with their converted dates
    const allRecent = await pool.query(
      `SELECT id, started_at,
              started_at AT TIME ZONE 'UTC' AT TIME ZONE 'Australia/Sydney' as aus_timestamp,
              (started_at AT TIME ZONE 'UTC' AT TIME ZONE 'Australia/Sydney')::date as aus_date,
              current_hole, is_completed
       FROM golf_rounds 
       WHERE player_id = 1 
       AND started_at >= NOW() - INTERVAL '1 day'
       ORDER BY started_at DESC;`
    );
    
    console.log('\n\nAll recent rounds with date conversion:');
    console.table(allRecent.rows);
    
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    await pool.end();
    process.exit(1);
  }
}

debugDateIssue();
