// Filter wordlist to remove plurals and create optimized version
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Plural detection logic (same as in app)
function isPlural(word) {
  if (!word || word.length !== 5) return false;
  if (!word.endsWith('S')) return false;
  
  // Keep words ending in double-S (CHESS, GLASS, CROSS, BRASS, etc.)
  if (word.endsWith('SS')) return false;
  
  // Keep words ending in US (GENUS, FOCUS, BOGUS, VIRUS, etc.)
  if (word.endsWith('US')) return false;
  
  // Keep words ending in IS (BASIS, OASIS, CRISIS, etc.)
  if (word.endsWith('IS')) return false;
  
  // Keep words ending in OS (CHAOS, KUDOS, etc.)
  if (word.endsWith('OS')) return false;
  
  // Keep words ending in AS (ATLAS, TEXAS, TAPAS, etc.)
  if (word.endsWith('AS')) return false;
  
  // Keep words ending in XES (BOXES, FOXES, TAXES, VEXES)
  if (word.endsWith('XES')) return false;
  
  // Everything else ending in S is likely a plural or verb form
  return true;
}

function filterWordlist() {
  const inputPath = path.join(__dirname, '../data/wordlist-table.txt');
  const outputPath = path.join(__dirname, '../data/wordlist-table-filtered.txt');
  const publicOutputPath = path.join(__dirname, '../public/wordlist-table.txt');
  
  console.log('Reading wordlist from:', inputPath);
  const content = fs.readFileSync(inputPath, 'utf-8');
  
  const lines = content.split(/\r?\n/);
  const header = lines[0];
  
  console.log('Total lines (including header):', lines.length);
  
  const filteredLines = [header];
  let removedCount = 0;
  const removedWords = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const parts = line.split(/\t/);
    const word = parts[0].toUpperCase().trim();
    
    // Check if valid 5-letter word
    if (!/^[A-Z]{5}$/.test(word)) {
      console.log('Skipping invalid word format:', word);
      continue;
    }
    
    if (isPlural(word)) {
      removedCount++;
      removedWords.push(word);
    } else {
      filteredLines.push(line);
    }
  }
  
  console.log('\nFiltering complete:');
  console.log('Original words:', lines.length - 1);
  console.log('Filtered words:', filteredLines.length - 1);
  console.log('Removed words:', removedCount);
  console.log('\nSample removed words:', removedWords.slice(0, 20).join(', '));
  
  const outputContent = filteredLines.join('\n');
  
  // Save to data folder (backup)
  fs.writeFileSync(outputPath, outputContent);
  console.log('\nFiltered wordlist saved to:', outputPath);
  
  // Save to public folder (used by app)
  fs.writeFileSync(publicOutputPath, outputContent);
  console.log('Filtered wordlist saved to:', publicOutputPath);
  
  console.log('\n✅ Done! You can now remove client-side plural filtering for better performance.');
}

filterWordlist();
