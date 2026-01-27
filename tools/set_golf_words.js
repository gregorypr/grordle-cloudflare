// tools/set_golf_words.js
// Set custom golf words for today's course
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

const today = process.argv[2] || new Date().toISOString().split('T')[0];
const words = ["BRAND", "CLUMP", "AUDIO", "MOUSE", "JAUNT", "LOOSE", "MAGIC", "ZESTY", "PRANK"];

(async () => {
  try {
    // Delete any existing course for today
    await pool.query('DELETE FROM daily_golf_course WHERE course_date = $1;', [today]);
    for (let i = 0; i < words.length; i++) {
      await pool.query(
        'INSERT INTO daily_golf_course (course_date, hole_number, target_word, start_word, par) VALUES ($1, $2, $3, \'\', 4);',
        [today, i + 1, words[i]]
      );
      console.log(`Set hole ${i + 1} to word: ${words[i]}`);
    }
    await pool.end();
    console.log('Golf course updated for', today);
  } catch (err) {
    console.error('Error setting golf words:', err.message);
    process.exit(1);
  }
})();
