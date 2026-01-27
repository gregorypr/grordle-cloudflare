import https from 'https';
import fs from 'fs';

const WORDLIST_URL = "https://raw.githubusercontent.com/tabatkins/wordle-list/main/words";

// Same logic as isPlural from wordUtils.js
function isPlural(word, allowedSet) {
  if (!word || word.length !== 5) return false;
  if (!word.endsWith("S")) return false;
  if (!allowedSet) return false;
  const root = word.slice(0, -1);
  return allowedSet.has(root);
}

// Fetch and process the word list
https.get(WORDLIST_URL, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('Word list fetched successfully');
    
    // Parse the raw words
    const rawWords = data
      .split(/\r?\n/)
      .map(w => w.trim().toUpperCase())
      .filter(w => /^[A-Z]{5}$/.test(w));
    
    console.log(`Total 5-letter words: ${rawWords.length}`);
    
    // Build a non-plural master list, maintaining order
    const baseSet = new Set(rawWords);
    const nonPluralWords = rawWords.filter(w => !isPlural(w, baseSet));
    
    console.log(`Non-plural words: ${nonPluralWords.length}`);
    console.log(`Plurals removed: ${rawWords.length - nonPluralWords.length}`);
    
    // Save to file (one word per line)
    const outputPath = './filtered-wordlist.txt';
    fs.writeFileSync(outputPath, nonPluralWords.join('\n'));
    
    console.log(`\nWord list saved to ${outputPath}`);
  });

}).on('error', (err) => {
  console.error('Error fetching word list:', err);
});
