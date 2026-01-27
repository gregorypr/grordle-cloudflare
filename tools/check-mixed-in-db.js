import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function checkMixed() {
  try {
    const result = await pool.query(
      "SELECT * FROM wordlist WHERE word = 'MIXED'"
    );
    
    if (result.rows.length > 0) {
      console.log("MIXED found in wordlist table:");
      console.table(result.rows);
    } else {
      console.log("MIXED NOT found in wordlist table");
    }
    
    // Also check how many words total
    const count = await pool.query("SELECT COUNT(*) FROM wordlist");
    console.log(`\nTotal words in database wordlist: ${count.rows[0].count}`);
    
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    await pool.end();
    process.exit(1);
  }
}

checkMixed();
