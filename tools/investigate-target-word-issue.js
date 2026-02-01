import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

// Same seed function as in game-state.js
function computeSeed(date) {
  const targetPrefix = "TARGET:";
  const seedString = targetPrefix + date;
  let seed = 0;
  for (let i = 0; i < seedString.length; i++) {
    seed = (seed * 31 + seedString.charCodeAt(i)) >>> 0;
  }
  return seed;
}

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

async function investigate() {
  try {
    const today = getAustralianDate();
    console.log(`\n=== Investigating Target Word Issue ===`);
    console.log(`Today's date (Australian): ${today}`);

    const seed = computeSeed(today);
    console.log(`Computed seed for "${today}": ${seed}`);

    // Get wordlist count
    const countResult = await pool.query(`SELECT COUNT(*) as count FROM wordlist`);
    const wordlistLength = parseInt(countResult.rows[0].count);
    console.log(`Wordlist length: ${wordlistLength}`);

    const expectedIndex = seed % wordlistLength;
    console.log(`Expected index (seed % length): ${expectedIndex}`);

    // Get the words LUNAR and JELLY with their positions
    console.log(`\n--- Checking LUNAR and JELLY positions ---`);

    const lunarResult = await pool.query(`
      SELECT id, word, ctid,
             ROW_NUMBER() OVER (ORDER BY ctid) - 1 as ctid_position,
             ROW_NUMBER() OVER (ORDER BY id) - 1 as id_position,
             ROW_NUMBER() OVER (ORDER BY word) - 1 as alpha_position
      FROM wordlist
      WHERE UPPER(word) IN ('LUNAR', 'JELLY')
    `);

    console.log('\nPositions of LUNAR and JELLY:');
    console.table(lunarResult.rows);

    // Get what word is at the expected index using different orderings
    console.log(`\n--- Word at index ${expectedIndex} with different orderings ---`);

    const byCtid = await pool.query(`
      SELECT word FROM wordlist ORDER BY ctid LIMIT 1 OFFSET $1
    `, [expectedIndex]);

    const byId = await pool.query(`
      SELECT word FROM wordlist ORDER BY id LIMIT 1 OFFSET $1
    `, [expectedIndex]);

    const byWord = await pool.query(`
      SELECT word FROM wordlist ORDER BY word LIMIT 1 OFFSET $1
    `, [expectedIndex]);

    console.log(`ORDER BY ctid: ${byCtid.rows[0]?.word || 'N/A'}`);
    console.log(`ORDER BY id: ${byId.rows[0]?.word || 'N/A'}`);
    console.log(`ORDER BY word (alphabetical): ${byWord.rows[0]?.word || 'N/A'}`);

    // Check what target words players have stored today
    console.log(`\n--- Target words stored in player_games for today ---`);
    const storedTargets = await pool.query(`
      SELECT DISTINCT pg.target_word, COUNT(*) as player_count
      FROM player_games pg
      JOIN games g ON pg.game_id = g.id
      WHERE g.play_date = $1
      GROUP BY pg.target_word
      ORDER BY player_count DESC
    `, [today]);

    console.table(storedTargets.rows);

    // Show which players got which word
    console.log(`\n--- Players and their target words today ---`);
    const playerTargets = await pool.query(`
      SELECT p.player_name, pg.target_word
      FROM player_games pg
      JOIN games g ON pg.game_id = g.id
      JOIN players p ON pg.player_id = p.id
      WHERE g.play_date = $1
      ORDER BY pg.target_word, p.player_name
    `, [today]);

    console.table(playerTargets.rows);

    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    await pool.end();
    process.exit(1);
  }
}

investigate();
