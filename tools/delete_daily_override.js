// tools/delete_daily_override.js
// Run this script to delete today's daily word override from the database

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

// Use Australian date (handles AEST/AEDT automatically)
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

const today = process.argv[2] || getAustralianDate();

(async () => {
  try {
    const result = await pool.query('DELETE FROM daily_word_overrides WHERE play_date = $1 RETURNING *;', [today]);
    console.log(`Deleted ${result.rowCount} override(s) for ${today}`);
    if (result.rows.length > 0) {
      console.log('Deleted rows:', result.rows);
    }
    await pool.end();
  } catch (err) {
    console.error('Error deleting override:', err.message);
    process.exit(1);
  }
})();
