import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read wordlist
const wordlistPath = path.join(__dirname, '../data/wordlist-table.txt');
const content = fs.readFileSync(wordlistPath, 'utf-8');
const lines = content.trim().split('\n');
const header = lines[0];

// Words to remove
const specificRemove = new Set(['ACHES', 'AWAYS', 'BABES', 'CAFES', 'CHEWS']);

// Parse and filter
const filtered = [header];
const removed = [];

for (let i = 1; i < lines.length; i++) {
  const parts = lines[i].split('\t');
  const word = parts[0];
  
  // Check if should be removed
  if (specificRemove.has(word) || word.endsWith('WS') || word.endsWith('YS')) {
    removed.push(word);
  } else {
    filtered.push(lines[i]);
  }
}

console.log(`Removed ${removed.length} words:`);
removed.sort().forEach(w => console.log(`  ${w}`));

// Write filtered list
const outputPath = path.join(__dirname, '../data/wordlist-table-cleaned.txt');
fs.writeFileSync(outputPath, filtered.join('\n') + '\n', 'utf-8');

console.log(`\n✅ Created wordlist-table-cleaned.txt with ${filtered.length - 1} words (removed ${removed.length})`);
