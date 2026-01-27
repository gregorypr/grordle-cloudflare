import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function checkLatest() {
  try {
    // Get the absolute latest course date
    const latestDate = await pool.query(
      "SELECT MAX(course_date) as latest FROM daily_golf_course"
    );
    
    console.log("Latest course date in database:");
    console.log(latestDate.rows[0]);
    
    // Get that course
    const latest = latestDate.rows[0].latest;
    const course = await pool.query(
      "SELECT * FROM daily_golf_course WHERE course_date = $1 ORDER BY hole_number",
      [latest]
    );
    
    console.log("\nLatest course holes:");
    console.table(course.rows);
    
    // Also check for any course with DELVE
    const delve = await pool.query(
      "SELECT * FROM daily_golf_course WHERE target_word = 'DELVE'"
    );
    
    if (delve.rows.length > 0) {
      console.log("\nFound DELVE:");
      console.table(delve.rows);
    } else {
      console.log("\nNo DELVE found in database");
    }
    
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    await pool.end();
    process.exit(1);
  }
}

checkLatest();
