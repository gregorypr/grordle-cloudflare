// Quick diagnostic to check wordlist status
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

export default async (req, res) => {
  try {
    // Check curated wordlist count
    const curatedResult = await pool.query("SELECT COUNT(*) FROM wordlist");
    const curatedCount = parseInt(curatedResult.rows[0].count);

    // Check validation wordlist count
    let validationCount = 0;
    try {
      const validationResult = await pool.query("SELECT COUNT(*) FROM validation_words");
      validationCount = parseInt(validationResult.rows[0].count);
    } catch (err) {
      // Table doesn't exist yet
    }

    // Get sample words from each list
    const curatedSample = await pool.query("SELECT word FROM wordlist ORDER BY id LIMIT 5");
    
    let validationSample = [];
    if (validationCount > 0) {
      const validationSampleResult = await pool.query("SELECT word FROM validation_words LIMIT 5");
      validationSample = validationSampleResult.rows.map(r => r.word);
    }

    // Get today's word (handles AEST/AEDT automatically)
    const getAustralianDate = () => {
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
    };

    const today = getAustralianDate();
    const wordlistForDate = await pool.query("SELECT word FROM wordlist ORDER BY id");
    const wordlist = wordlistForDate.rows.map(r => r.word);
    
    const targetPrefix = "TARGET:";
    const seedString = targetPrefix + today;
    let seed = 0;
    for (let i = 0; i < seedString.length; i++) {
      seed = (seed * 31 + seedString.charCodeAt(i)) >>> 0;
    }
    const index = seed % wordlist.length;
    const todayWord = wordlist[index];

    res.json({
      ok: true,
      curated: {
        count: curatedCount,
        expected: 3306,
        deployed: curatedCount === 3306,
        sample: curatedSample.rows.map(r => r.word)
      },
      validation: {
        count: validationCount,
        expected: 13909,
        deployed: validationCount === 13909,
        sample: validationSample
      },
      today: {
        date: today,
        word: todayWord,
        index: index
      }
    });
  } catch (err) {
    console.error("[wordlist-stats] Error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
};
