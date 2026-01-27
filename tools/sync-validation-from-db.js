import { Pool } from "pg";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function syncValidationList() {
  try {
    // Get all words from database
    console.log('Fetching words from database...');
    const result = await pool.query("SELECT word FROM wordlist ORDER BY word");
    const dbWords = new Set(result.rows.map(r => r.word.toLowerCase()));
    console.log(`Found ${dbWords.size} words in database`);
    
    // Read current validation list
    const validationPath = path.join(__dirname, '../public/validation-words.txt');
    console.log('Reading validation list...');
    const validationContent = fs.readFileSync(validationPath, 'utf-8');
    const validationWords = new Set(
      validationContent.split('\n')
        .map(w => w.trim().toLowerCase())
        .filter(w => w.length === 5)
    );
    console.log(`Found ${validationWords.size} words in validation list`);
    
    // Find missing words
    const missingWords = [];
    for (const word of dbWords) {
      if (!validationWords.has(word)) {
        missingWords.push(word);
      }
    }
    
    if (missingWords.length === 0) {
      console.log('\n✓ All database words are in the validation list!');
    } else {
      console.log(`\n✗ Found ${missingWords.length} words in database that are NOT in validation list:`);
      console.log(missingWords.sort().slice(0, 20).join(', '), '...');
      
      console.log('\n---');
      console.log('Adding missing words to validation list...');
      
      // Add missing words to validation list
      const allValidationWords = [...validationWords, ...missingWords].sort();
      fs.writeFileSync(validationPath, allValidationWords.join('\n') + '\n', 'utf-8');
      
      console.log(`✓ Added ${missingWords.length} words to validation list`);
      console.log(`✓ Validation list now has ${allValidationWords.length} words`);
    }
    
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    await pool.end();
    process.exit(1);
  }
}

syncValidationList();
