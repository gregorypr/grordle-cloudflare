import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function findCourse() {
  try {
    const result = await pool.query(
      "SELECT * FROM daily_golf_course WHERE target_word = 'DELVE' ORDER BY hole_number"
    );
    
    if (result.rows.length > 0) {
      console.log("Course with DELVE:");
      console.table(result.rows);
      
      // Get all holes for this date
      const courseDate = result.rows[0].course_date;
      const allHoles = await pool.query(
        "SELECT * FROM daily_golf_course WHERE course_date = $1 ORDER BY hole_number",
        [courseDate]
      );
      console.log("\nAll holes for this course:");
      console.table(allHoles.rows);
    } else {
      console.log("No course with DELVE found");
    }
    
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    await pool.end();
    process.exit(1);
  }
}

findCourse();
