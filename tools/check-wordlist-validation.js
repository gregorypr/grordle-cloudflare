import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read wordlist from database format (word difficulty length par)
const wordlistPath = path.join(__dirname, '../data/wordlist-table-filtered.txt');
const validationPath = path.join(__dirname, '../public/validation-words.txt');

console.log('Reading wordlist...');
const wordlistContent = fs.readFileSync(wordlistPath, 'utf-8');
const wordlistLines = wordlistContent.split('\n').filter(line => line.trim());

// Extract just the words (first column)
const wordlistWords = new Set();
for (const line of wordlistLines) {
  const word = line.split('\t')[0].trim().toLowerCase();
  if (word && word.length === 5) {
    wordlistWords.add(word);
  }
}

console.log(`Found ${wordlistWords.size} words in wordlist`);

// Read validation list
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
for (const word of wordlistWords) {
  if (!validationWords.has(word)) {
    missingWords.push(word);
  }
}

if (missingWords.length === 0) {
  console.log('\n✓ All wordlist words are in the validation list!');
} else {
  console.log(`\n✗ Found ${missingWords.length} words in wordlist that are NOT in validation list:`);
  console.log(missingWords.sort().join('\n'));
  
  console.log('\n---');
  console.log('Adding missing words to validation list...');
  
  // Add missing words to validation list
  const allValidationWords = [...validationWords, ...missingWords].sort();
  fs.writeFileSync(validationPath, allValidationWords.join('\n') + '\n', 'utf-8');
  
  console.log(`✓ Added ${missingWords.length} words to validation list`);
  console.log(`✓ Validation list now has ${allValidationWords.length} words`);
}
