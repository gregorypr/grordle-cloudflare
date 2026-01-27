import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

const today = '2026-01-01';

async function checkDailyWordOverride() {
  try {
    const result = await pool.query(
      "SELECT * FROM daily_word_overrides WHERE play_date = $1",
      [today]
    );
    if (result.rows.length === 0) {
      console.log("No entries found for today in daily_word_overrides.");
    } else {
      console.log("Entries for today in daily_word_overrides:");
      console.table(result.rows);
    }
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error("Error checking daily_word_overrides:", err);
    await pool.end();
    process.exit(1);
  }
}

checkDailyWordOverride();
