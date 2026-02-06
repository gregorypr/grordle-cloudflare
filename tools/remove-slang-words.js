// Tool to remove slang words from the wordlist database
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Words to remove (slang, informal, obscure abbreviations)
const slangWords = [
  // Contractions
  'GONNA',
  'GOTTA',
  'KINDA',
  'SORTA',
  'WANNA',
  // Slang
  'HELLA',
  'KIDDO',
  'PROMO',
  'YUMMY',
];

async function removeSlangWords() {
  const client = await pool.connect();

  try {
    console.log('Removing slang words from wordlist...\n');

    for (const word of slangWords) {
      // Check if word exists
      const check = await client.query(
        'SELECT id, word, par, difficulty FROM wordlist WHERE UPPER(word) = $1',
        [word.toUpperCase()]
      );

      if (check.rows.length > 0) {
        console.log(`Found: ${word} (par: ${check.rows[0].par}, difficulty: ${check.rows[0].difficulty})`);

        // Delete the word
        await client.query('DELETE FROM wordlist WHERE UPPER(word) = $1', [word.toUpperCase()]);
        console.log(`  -> Removed from wordlist`);

        // Also remove from daily_golf_course if it's there (future courses)
        const golfCheck = await client.query(
          'DELETE FROM daily_golf_course WHERE UPPER(target_word) = $1 RETURNING course_date, hole_number',
          [word.toUpperCase()]
        );
        if (golfCheck.rows.length > 0) {
          console.log(`  -> Removed from ${golfCheck.rows.length} daily golf course(s)`);
        }
      } else {
        console.log(`Not found: ${word} (already removed or doesn't exist)`);
      }
    }

    console.log('\nDone!');

  } finally {
    client.release();
    await pool.end();
  }
}

removeSlangWords().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
