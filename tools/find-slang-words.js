// Tool to find potential slang/informal words in the wordlist database
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Known slang patterns and words to flag for review
const knownSlang = new Set([
  // Abbreviations/informal
  'AMIGO', 'BINGO', 'COMBO', 'DINGO', 'DISCO', 'KIDDO', 'LINGO', 'MAMBO', 'PINTO', 'PROMO',
  // Internet/modern slang
  'EMOJI', 'MEMES', 'NOOBS', 'NERDS', 'GEEKS',
  // Informal terms
  'BUCKS', 'DOUGH', 'GONNA', 'GOTTA', 'KINDA', 'SORTA', 'WANNA',
  // Food slang
  'GRUBS', 'NUMMY', 'YUMMY',
  // Exclamations
  'OOPSY', 'WHOAH', 'YIKES', 'YOWZA',
  // Other informal
  'BONKY', 'CORNY', 'CUTIE', 'DOOZY', 'FLAKY', 'GOOFY', 'HOKEY', 'LOOPY', 'NUTTY', 'WACKY', 'ZAPPY',
]);

async function findSlangWords() {
  const client = await pool.connect();

  try {
    // Get all words with high difficulty (harder = more obscure)
    const highDifficulty = await client.query(`
      SELECT word, difficulty, par
      FROM wordlist
      WHERE difficulty >= 80
      ORDER BY difficulty DESC, word
    `);

    console.log('=== HIGH DIFFICULTY WORDS (difficulty >= 80) ===');
    console.log('These are harder/more obscure words:\n');
    for (const row of highDifficulty.rows) {
      console.log(`  ${row.word.padEnd(8)} difficulty: ${parseFloat(row.difficulty).toFixed(1)}, par: ${row.par}`);
    }
    console.log(`\nTotal: ${highDifficulty.rows.length} words\n`);

    // Check for known slang in database
    const allWords = await client.query('SELECT word, difficulty, par FROM wordlist ORDER BY word');

    console.log('=== KNOWN INFORMAL/SLANG TERMS IN DATABASE ===\n');
    const foundSlang = [];
    for (const row of allWords.rows) {
      if (knownSlang.has(row.word.toUpperCase())) {
        foundSlang.push(row);
        console.log(`  ${row.word.padEnd(8)} difficulty: ${parseFloat(row.difficulty).toFixed(1)}, par: ${row.par}`);
      }
    }
    console.log(`\nTotal: ${foundSlang.length} words\n`);

    // Words with foreign origin patterns
    const foreignPatterns = await client.query(`
      SELECT word, difficulty, par
      FROM wordlist
      WHERE word ~* '(ito|ita|ismo|ista|cion|illo|ella|oso|osa)$'
      ORDER BY word
    `);

    if (foreignPatterns.rows.length > 0) {
      console.log('=== POSSIBLE FOREIGN/BORROWED WORDS ===\n');
      for (const row of foreignPatterns.rows) {
        console.log(`  ${row.word.padEnd(8)} difficulty: ${parseFloat(row.difficulty).toFixed(1)}, par: ${row.par}`);
      }
      console.log(`\nTotal: ${foreignPatterns.rows.length} words\n`);
    }

    // Get all words for manual review
    console.log('=== ALL WORDS (for manual review) ===\n');
    const sorted = allWords.rows.sort((a, b) => a.word.localeCompare(b.word));
    for (const row of sorted) {
      console.log(`${row.word}`);
    }
    console.log(`\nTotal words in database: ${allWords.rows.length}`);

  } finally {
    client.release();
    await pool.end();
  }
}

findSlangWords().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
