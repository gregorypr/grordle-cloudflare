// Difficulty helpers: categorize words based on their position
// in the word list (assuming the list is ordered by commonality/frequency).

export function calculateDifficulty(word, wordListArray) {
  if (!wordListArray || !word) return "";
  if (!Array.isArray(wordListArray) || !wordListArray.length) return "";

  // Find the position of the word in the list
  const position = wordListArray.indexOf(word);
  
  // If word is not found, default to medium
  if (position === -1) return "medium";

  // Calculate percentile based on position
  // Lower position = more common = easier
  const percentile = position / wordListArray.length;

  let label = "medium";
  if (percentile <= 0.33) label = "easy";      // First third = common words
  else if (percentile > 0.66) label = "hard";  // Last third = rare words
  
  return label;
}
