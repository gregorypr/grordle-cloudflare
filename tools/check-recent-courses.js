import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function checkRecentCourses() {
  try {
    const result = await pool.query(
      "SELECT * FROM daily_golf_course WHERE course_date >= '2026-01-09' ORDER BY course_date DESC, hole_number"
    );
    
    if (result.rows.length === 0) {
      console.log("No recent courses found.");
    } else {
      console.log("All recent courses:");
      console.table(result.rows);
    }
    
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    await pool.end();
    process.exit(1);
  }
}

checkRecentCourses();
