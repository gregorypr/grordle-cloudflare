import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

const today = '2026-01-10';

async function checkDailyGolfCourse() {
  try {
    const result = await pool.query(
      "SELECT * FROM daily_golf_course WHERE course_date = $1 ORDER BY hole_number",
      [today]
    );
    if (result.rows.length === 0) {
      console.log("No entries found for today in daily_golf_course.");
    } else {
      console.log("Entries for today in daily_golf_course:");
      console.table(result.rows);
    }
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error("Error checking daily_golf_course:", err);
    await pool.end();
    process.exit(1);
  }
}

checkDailyGolfCourse();
