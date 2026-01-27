import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function checkAmigo() {
  try {
    const result = await pool.query(
      "SELECT * FROM wordlist WHERE word = 'AMIGO'"
    );
    
    if (result.rows.length > 0) {
      console.log("AMIGO found in wordlist table:");
      console.table(result.rows);
    } else {
      console.log("AMIGO NOT found in wordlist table");
    }
    
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    await pool.end();
    process.exit(1);
  }
}

checkAmigo();
