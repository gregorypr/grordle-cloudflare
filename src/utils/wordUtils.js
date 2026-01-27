export const isPlural = (word) => {
  if (!word || word.length !== 5) return false;
  if (!word.endsWith("S")) return false;
  
  // Keep words ending in double-S (CHESS, GLASS, CROSS, BRASS, etc.)
  if (word.endsWith("SS")) return false;
  
  // Keep words ending in US (GENUS, FOCUS, BOGUS, VIRUS, etc.)
  if (word.endsWith("US")) return false;
  
  // Keep words ending in IS (BASIS, OASIS, CRISIS, etc.)
  if (word.endsWith("IS")) return false;
  
  // Keep words ending in OS (CHAOS, KUDOS, etc.)
  if (word.endsWith("OS")) return false;
  
  // Keep words ending in AS (ATLAS, TEXAS, TAPAS, etc.)
  if (word.endsWith("AS")) return false;
  
  // Keep words ending in XES (BOXES, FOXES, TAXES, VEXES)
  if (word.endsWith("XES")) return false;
  
  // Everything else ending in S is likely a plural or verb form - filter it out
  return true;
};

export const getGuessStatuses = (guess, targetWord) => {
  if (!guess || !targetWord) return Array(5).fill("absent");
  
  const statuses = [];
  const targetChars = targetWord.split("");
  const guessChars = guess.split("");

  for (let i = 0; i < guess.length; i++) {
    if (guessChars[i] === targetChars[i]) {
      statuses[i] = "correct";
      targetChars[i] = "";
    }
  }

  for (let i = 0; i < guess.length; i++) {
    if (statuses[i] !== "correct") {
      const char = guessChars[i];
      const targetIndex = targetChars.indexOf(char);
      if (targetIndex > -1) {
        statuses[i] = "present";
        targetChars[targetIndex] = "";
      } else {
        statuses[i] = "absent";
      }
    }
  }
  return statuses;
};

export const getLetterColor = (status) => {
  switch (status) {
    case "correct":
      return "bg-green-600 border-green-700";
    case "present":
      return "bg-yellow-500 border-yellow-600";
    case "absent":
      return "bg-gray-700 border-gray-900";
    default:
      return "bg-white/10 border-white/30";
  }
};
