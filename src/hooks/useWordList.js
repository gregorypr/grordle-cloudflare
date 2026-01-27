import { useState, useEffect } from "react";

// Load validation wordlist client-side for instant validation
// Target words still generated server-side for security
export const useWordList = () => {
  const [wordListLoaded, setWordListLoaded] = useState(false);
  const [validationWords, setValidationWords] = useState(null);
  const [loadingError, setLoadingError] = useState(null);

  useEffect(() => {
    const loadValidationWords = async () => {
      try {
        const response = await fetch("/validation-words.txt");
        const text = await response.text();
        const words = text.split("\n").map(w => w.trim().toUpperCase()).filter(w => w.length === 5);
        const wordSet = new Set(words);
        setValidationWords(wordSet);
        setWordListLoaded(true);
        console.log(`[useWordList] Loaded ${words.length} validation words`);
      } catch (err) {
        console.error("[useWordList] Error loading validation words:", err);
        setLoadingError(err.message);
        setWordListLoaded(true); // Continue without validation list (will fall back to server)
      }
    };

    loadValidationWords();
  }, []);

  return { 
    wordListLoaded, 
    validationWords,
    loadingError 
  };
};
