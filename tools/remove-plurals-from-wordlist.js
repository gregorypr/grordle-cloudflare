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

// Parse words
const words = new Map();
const wordSet = new Set();

for (let i = 1; i < lines.length; i++) {
  const parts = lines[i].split('\t');
  const word = parts[0];
  words.set(word, lines[i]);
  wordSet.add(word);
}

console.log(`Total words: ${words.size}`);

// Find plurals
const plurals = [];
const nonPluralS = new Set(['BASIS', 'OASIS', 'THESIS', 'CRISIS', 'AEGIS', 'KUDOS', 'CHAOS', 
  'NEXUS', 'LOTUS', 'FOCUS', 'BONUS', 'GENUS', 'BOGUS', 'VENUS', 'MINUS', 'VIRUS', 'LOCUS',
  'MODUS', 'TORUS', 'SINUS', 'FETUS', 'NEXUS', 'REBUS', 'MAGUS', 'NEGUS', 'ETHOS', 'PATHOS',
  'HUBRIS', 'AXIS', 'PRAXIS', 'TAXIS', 'SOLUS', 'MALUS', 'HUMUS', 'FICUS', 'POLIS', 'ANNUS',
  'CASUS', 'MANUS', 'CONUS', 'TONUS', 'LUPUS', 'TELOS', 'LOGOS', 'NOMOS', 'PIOUS', 'SILAS',
  'DENIS', 'LEWIS', 'LOUIS', 'TRAVIS', 'CHRIS', 'PARIS', 'ELLIS', 'CURTIS', 'MORRIS',
  'IGNIS', 'JURIS', 'LAPIS', 'VAGUS', 'VARUS', 'TALUS', 'FINIS', 'METIS', 'MANIS', 'RAMIS',
  'LEVIS', 'NEVIS', 'COCOS', 'DELOS', 'MINOS', 'LORIS', 'GYRUS', 'PULIS', 'PRIUS', 'CAMUS',
  'ATMOS', 'SEMIS', 'REAIS', 'CLAES', 'BAYES', 'NOYES', 'ARTIS', 'ALLIS', 'ARRIS', 'DEVOS',
  'MILOS', 'EMMYS', 'LAKHS', 'BOWES', 'HOWES', 'LOWES', 'BREES', 'SARIS', 'TROIS', 'MANOS',
  'ALTOS', 'LOBOS', 'TODOS', 'TOROS', 'DINOS', 'MINIS']); // Known non-plurals

for (const [word, line] of words) {
  if (word.endsWith('S') && !word.endsWith('SS')) {
    // Skip if it's a known non-plural
    if (nonPluralS.has(word)) {
      continue;
    }
    
    // Check if singular form exists
    const singular = word.slice(0, -1);
    const singularES = word.slice(0, -2); // for words like ACHES -> ACHE
    
    if (wordSet.has(singular)) {
      plurals.push({ word, singular, line });
    } else if (word.endsWith('ES') && wordSet.has(singularES)) {
      plurals.push({ word, singular: singularES, line });
    } else if (word.endsWith('IES') && wordSet.has(word.slice(0, -3) + 'Y')) {
      plurals.push({ word, singular: word.slice(0, -3) + 'Y', line });
    } else if (word.endsWith('VES') && wordSet.has(word.slice(0, -3) + 'FE')) {
      plurals.push({ word, singular: word.slice(0, -3) + 'FE', line });
    } else if (word.endsWith('VES') && wordSet.has(word.slice(0, -3) + 'F')) {
      plurals.push({ word, singular: word.slice(0, -3) + 'F', line });
    }
  }
}

console.log(`\nFound ${plurals.length} plurals:`);
plurals.forEach(p => console.log(`  ${p.word} (singular: ${p.singular})`));

// Create filtered list
const filtered = [header];
for (const [word, line] of words) {
  if (!plurals.some(p => p.word === word)) {
    filtered.push(line);
  }
}

// Write filtered list
const outputPath = path.join(__dirname, '../data/wordlist-table-no-plurals.txt');
fs.writeFileSync(outputPath, filtered.join('\n') + '\n', 'utf-8');

console.log(`\n✅ Created wordlist-table-no-plurals.txt with ${filtered.length - 1} words (removed ${plurals.length} plurals)`);
