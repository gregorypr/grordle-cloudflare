// Test what word Jan 7 should generate
import fs from 'fs';

// Read current deployed wordlist
const wordlistContent = fs.readFileSync('public/wordlist-table.txt', 'utf-8');
const lines = wordlistContent.trim().split('\n');
const words = lines.slice(1).map(line => line.split('\t')[0]); // Skip header, get first column

console.log(`Current wordlist size: ${words.length}`);

// Calculate seed for Jan 7, 2026 (Australian timezone)
const today = "2026-01-07"; // Format used in App.jsx
const dateStr = "TARGET:" + today;
let seed = 0;
for (let i = 0; i < dateStr.length; i++) {
  seed = (seed * 31 + dateStr.charCodeAt(i)) >>> 0;
}

console.log(`Date string: ${dateStr}`);
console.log(`Seed: ${seed}`);

const index = seed % words.length;
const secret = words[index];

console.log(`Index: ${index}`);
console.log(`Word at index ${index}: ${secret}`);

// Check if NIFFS or COLON are in the list
const niffsIndex = words.indexOf('NIFFS');
const colonIndex = words.indexOf('COLON');

console.log(`\nNIFFS index: ${niffsIndex} (${niffsIndex >= 0 ? 'FOUND' : 'NOT FOUND'})`);
console.log(`COLON index: ${colonIndex} (${colonIndex >= 0 ? 'FOUND' : 'NOT FOUND'})`);

// Test with larger wordlist sizes to see if NIFFS appears
console.log('\n--- Testing with different wordlist sizes ---');
const testSizes = [1741, 1987, 3001, 14855];
testSizes.forEach(size => {
  const testIndex = seed % size;
  console.log(`Size ${size}: index would be ${testIndex}`);
});
