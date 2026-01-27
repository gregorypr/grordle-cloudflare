// Script to remove problematic words from wordlist
// Run with: node scripts/remove-words.js

import fs from 'fs';
import path from 'path';

// Words to remove - foreign words, brand names, proper nouns, offensive terms
const wordsToRemove = new Set([
  // Offensive/inappropriate
  'NIGGA',

  // Hindi/Indian words
  'YATRA', 'NAGAR', 'CRORE', 'LAKHS', 'SAHIB', 'BEGUM', 'NAWAB', 'SABHA',
  'SAREE', 'RAITA', 'RUPEE',

  // Arabic words
  'DINAR', 'NAIRA', 'FATWA', 'HARAM', 'HIJAB',

  // Japanese obscure words (keeping well-known ones like SUSHI, ANIME, NINJA)
  'TORII', 'ONSEN', 'TANTO', 'ISSEI', 'NISEI', 'ROSHI', 'SENSU', 'OTAKU',

  // Brand names
  'PEPSI', 'CISCO', 'LINUX', 'FEDEX', 'PRIUS', 'VESPA', 'LOWES', 'CHEVY',

  // Famous people/characters primarily known as names
  'DHONI', 'ROGAN', 'LOHAN', 'DIDDY', 'BAMBI', 'BILBO', 'SIMBA', 'SANSA',
  'DALEK', 'BUFFY', 'WALDO',

  // Place names (capitals, cities)
  'ACCRA', 'AMMAN', 'PARMA', 'MACON', 'SURAT', 'DERRY', 'CREWE', 'DELFT',
  'ROUEN', 'CAPRI', 'LAVAL', 'WIGAN', 'ALAMO',

  // First names primarily used as names (not common words)
  'DENIS', 'MITCH', 'CLINT', 'OLLIE', 'DELLA', 'PAOLO', 'LOUIE', 'BRITT',
  'GUIDO', 'MALIK', 'MANNY', 'MOIRA', 'KYLIE', 'GEMMA', 'MONTY', 'TANIA',
  'LOTTE', 'RAMON', 'GARTH', 'ROHAN', 'LEVIN', 'CLAIR', 'SONNY', 'GINNY',
  'KIRBY', 'NELLY', 'MANDY', 'FOLEY', 'SAMMY', 'MISSY', 'PATSY', 'LACEY',
  'TAMMY', 'TILLY', 'VINNY', 'NICKY', 'JOLIE', 'MILLY', 'KYRIE', 'RISHI',
  'MATTY', 'LETTY', 'DOTTY', 'SYBIL', 'EMMET', 'BROCK', 'ERICK', 'BENJI',
  'LAZAR', 'DONNY', 'MADDY', 'GABBY',

  // Surnames primarily used as names
  'SLOAN', 'BURKE', 'CONTE', 'RUBIO', 'BLANC', 'BOWIE', 'RUBIN', 'FONDA',
  'TWAIN', 'LOWRY', 'WELCH', 'FOYLE', 'ANNAN', 'PLATT', 'EMERY', 'CAMUS',
  'BEVAN', 'DEVOS', 'DEWAR', 'GAUSS', 'CURIE', 'FERMI', 'ROCHE', 'PARRA',
  'FROMM',

  // French words not commonly used in English
  'GARDE', 'CARTE', 'MASSE', 'ENTRE', 'MONDE', 'FEMME', 'HOMME', 'COMME',
  'PARTI', 'SALLE',

  // Italian/Spanish words not commonly used in English
  'DOLCE', 'AMORE', 'CARNE', 'PORTA', 'PRIMO', 'MADRE', 'PADRE', 'NUEVO',
  'SENOR', 'BUENA', 'SALUD', 'PARTE', 'TUTTI', 'MOLTO', 'CANTO', 'BASTA',
  'POLLO', 'FORZA', 'ROSSO', 'BARCA',

  // Sanskrit/yoga terms (keeping KARMA, MANTRA as they're well-known)
  'PRANA', 'ASANA', 'SUTRA',

  // Very obscure English words
  'STELE', 'VITRO', 'SIGIL', 'PAEAN', 'AUGHT',
]);

const wordlistPath = path.join(process.cwd(), 'data', 'wordlist-table-cleaned.txt');
const content = fs.readFileSync(wordlistPath, 'utf8');
const lines = content.trim().split('\n');

const header = lines[0];
const dataLines = lines.slice(1);

console.log(`Original word count: ${dataLines.length}`);

const filteredLines = dataLines.filter(line => {
  const word = line.split('\t')[0].toUpperCase();
  if (wordsToRemove.has(word)) {
    console.log(`Removing: ${word}`);
    return false;
  }
  return true;
});

console.log(`\nFiltered word count: ${filteredLines.length}`);
console.log(`Removed: ${dataLines.length - filteredLines.length} words`);

const newContent = [header, ...filteredLines].join('\n');
fs.writeFileSync(wordlistPath, newContent, 'utf8');

console.log('\nWordlist updated successfully!');
console.log('Remember to run the migration to update the database:');
console.log('  npm run migrate:wordlist');
