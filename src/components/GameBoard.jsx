
import { useState, useCallback, useEffect } from "react";
import GuessRow from "./GuessRow";
import Keyboard from "./Keyboard";
import { getGuessStatuses, isPlural } from "../utils/wordUtils";

// Emoji grid generator for Wordle-style sharing (trivial change for commit)
// This function returns a grid of 🟩🟨⬛ for each guess, matching the gameboard
// Emoji blocks for Wordle-style sharing
function generateEmojiGrid(guesses, targetWord) {
  if (!Array.isArray(guesses) || !targetWord) return '';
  return guesses
    .map((guess) => {
      const statuses = getGuessStatuses(guess, targetWord);
      return statuses
        .map((status) => {
          if (status === 'correct') return '🟩';
          if (status === 'present') return '🟨';
          return '⬛';
        })
        .join('');
    })
    .join('\n');
}

// Share handler: copies to clipboard and opens WhatsApp
function handleShare({ playerName, guesses, targetWord }) {
  const attempts = guesses && guesses.includes(targetWord)
    ? guesses.indexOf(targetWord) + 1
    : 'X';
  const summary = `Grordle - ${playerName} ${attempts}/6`;
  const grid = generateEmojiGrid(guesses, targetWord);
  const shareText = `${summary}\n${grid}`;
  if (navigator && navigator.clipboard) {
    navigator.clipboard.writeText(shareText);
  }
  const waUrl =
    'https://wa.me/?text=' + encodeURIComponent(shareText);
  window.open(waUrl, '_blank');
}
import { FLIP_DURATION, FLIP_STAGGER } from "../constants/gameConstants";

const Fireworks = () => {
  useEffect(() => {
    const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ff8800', '#ff0088'];
    const container = document.getElementById('fireworks-container');
    
    const createFirework = (x, y) => {
      const particleCount = 50;
      const color = colors[Math.floor(Math.random() * colors.length)];
      
      for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'firework-particle';
        
        const angle = (Math.PI * 2 * i) / particleCount;
        const velocity = 80 + Math.random() * 150;
        const xVel = Math.cos(angle) * velocity;
        const yVel = Math.sin(angle) * velocity;
        
        particle.style.left = `${x}px`;
        particle.style.top = `${y}px`;
        particle.style.setProperty('--color', color);
        particle.style.setProperty('--x', `${xVel}px`);
        particle.style.setProperty('--y', `${yVel}px`);
        particle.style.animation = 'firework-explode 2.5s ease-out forwards';
        
        container.appendChild(particle);
        
        setTimeout(() => particle.remove(), 2500);
      }
    };
    
    const launchFirework = () => {
      const x = Math.random() * window.innerWidth;
      const y = Math.random() * (window.innerHeight * 0.6) + (window.innerHeight * 0.1);
      createFirework(x, y);
    };
    
    // Launch multiple fireworks
    const intervals = [];
    for (let i = 0; i < 12; i++) {
      intervals.push(setTimeout(() => launchFirework(), i * 300));
    }
    
    return () => {
      intervals.forEach(id => clearTimeout(id));
    };
  }, []);
  
  return <div id="fireworks-container" className="fireworks-container" />;
};

export default function GameBoard({ 
  playerName,
  isPlaying,
  gameOver,
  guesses,
  setGuesses,
  currentGuess,
  setCurrentGuess,
  todayWord,
  setMessage,
  keyboardStatus,
  setKeyboardStatus,
  onGameOver,
  isRevealing,
  setIsRevealing,
  revealRowIndex,
  setRevealRowIndex,
  shakeRowIndex,
  setShakeRowIndex,
  winningRowIndex,
  setWinningRowIndex,
  onKeyPress,
  showShareButton,
  validationWords
}) {
  const [showFireworks, setShowFireworks] = useState(false);

    const updateKeyboardStatus = useCallback((guess, statuses) => {
      setKeyboardStatus(prevStatus => {
        const newStatus = { ...prevStatus };
        for (let i = 0; i < guess.length; i++) {
          const letter = guess[i];
          const status = statuses[i];
          const current = newStatus[letter];
          const currentPriority =
            current === "correct" ? 3 :
            current === "present" ? 2 :
            current === "absent" ? 1 : 0;
          const newPriority =
            status === "correct" ? 3 :
            status === "present" ? 2 :
            status === "absent" ? 1 : 0;

          if (newPriority > currentPriority) {
            newStatus[letter] = status;
          }
        }
        return newStatus;
      });
    }, [setKeyboardStatus]);

    const submitGuess = useCallback(async () => {
      if (gameOver || !todayWord || !isPlaying || isRevealing) return;

      const guess = currentGuess.toUpperCase();
      const currentRow = guesses.length;

      if (guess.length !== 5) {
        setMessage("Word must be 5 letters");
        setShakeRowIndex(currentRow);
        setTimeout(() => setShakeRowIndex(null), 450);
        return;
      }

      // Validate word (client-side if available, server-side as fallback)
      if (validationWords) {
        // Fast client-side validation
        if (!validationWords.has(guess)) {
          setMessage("Not in word list");
          setShakeRowIndex(currentRow);
          setTimeout(() => setShakeRowIndex(null), 450);
          return;
        }
      } else {
        // Fallback to server validation
        try {
          const response = await fetch("/api/validate-word", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ word: guess })
          });
          const data = await response.json();

          if (!data.valid) {
            setMessage("Not in word list");
            setShakeRowIndex(currentRow);
            setTimeout(() => setShakeRowIndex(null), 450);
            return;
          }
        } catch (err) {
          console.error("Error validating word:", err);
          setMessage("Error validating word");
          return;
        }
      }

      const statuses = getGuessStatuses(guess, todayWord);

      const newGuesses = [...guesses, guess];
      const newRowIndex = newGuesses.length - 1;
      setGuesses(newGuesses);
      setCurrentGuess("");
      updateKeyboardStatus(guess, statuses);
      setRevealRowIndex(newRowIndex);
      setIsRevealing(true);

      const totalRevealTime = FLIP_DURATION + FLIP_STAGGER * (guess.length - 1);

      setTimeout(() => {
        setIsRevealing(false);
        setRevealRowIndex(null);
      }, totalRevealTime);

      const attemptsUsed = newGuesses.length;

      if (guess === todayWord) {
        onGameOver(attemptsUsed, true);
        setMessage(
          `🎉 Correct! You got it in ${attemptsUsed} ${attemptsUsed === 1 ? "try" : "tries"}!`
        );
        // Trigger winning row bounce after reveal finishes
        setTimeout(() => {
          setWinningRowIndex(newRowIndex);
          setShowFireworks(true);
          // Hide fireworks after animation
          setTimeout(() => setShowFireworks(false), 2500);
        }, totalRevealTime);
      } else if (newGuesses.length >= 6) {
        onGameOver(7, false);
        setMessage(`Game Over! The word was ${todayWord}`);
      } else {
        setMessage("");
      }
    }, [
      gameOver,
      todayWord,
      isPlaying,
      isRevealing,
      currentGuess,
      guesses,
      updateKeyboardStatus,
      setGuesses,
      setCurrentGuess,
      setMessage,
      setShakeRowIndex,
      setRevealRowIndex,
      setIsRevealing,
      setWinningRowIndex,
      onGameOver
    ]);

  const handleKeyPress = useCallback((key) => {
    // If parent provided onKeyPress handler, use that instead
    if (onKeyPress) {
      return onKeyPress(key === "BACK" ? "BACKSPACE" : key);
    }

    if (!isPlaying || gameOver || isRevealing) return;

    if (key === "ENTER") {
      submitGuess();
    } else if (key === "BACK") {
      setCurrentGuess(prev => prev.slice(0, -1));
    } else if (/^[A-Z]$/.test(key)) {
      setCurrentGuess(prev => {
        if (prev.length >= 5) return prev;
        return prev + key;
      });
    }
  }, [onKeyPress, isPlaying, gameOver, isRevealing, submitGuess, setCurrentGuess]);

  // Physical keyboard support
  useEffect(() => {
    // Skip if parent provided onKeyPress - they'll handle it
    if (onKeyPress) return;

    const onKeyDown = (e) => {
      {/* Comment removed: Word voting UI at game over */}
      const key = e.key;
      if (/^[a-zA-Z]$/.test(key)) {
        e.preventDefault();
        handleKeyPress(key.toUpperCase());
      } else if (key === "Enter") {
        e.preventDefault();
        handleKeyPress("ENTER");
      } else if (key === "Backspace") {
        e.preventDefault();
        handleKeyPress("BACK");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onKeyPress, isPlaying, gameOver, isRevealing, handleKeyPress]);

  return (
    <div className="pb-20">
      {showFireworks && <Fireworks />}

      <div className="flex justify-between items-center mb-6 px-3">
        <h2 className="text-2xl font-bold text-white">
          Playing: {playerName}
        </h2>
        <span className="text-purple-200 text-lg">
          Attempt {guesses.length}/6
        </span>
      </div>

      <div className="space-y-2 mb-6">
        {[...Array(6)].map((_, i) => {
          const guess = guesses[i];
          const isCurrentRow = i === guesses.length && !gameOver;

          return (
            <GuessRow
              key={i}
              guess={guess}
              isCurrentRow={isCurrentRow}
              currentGuess={currentGuess}
              targetWord={todayWord}
              rowIndex={i}
              shakeRowIndex={shakeRowIndex}
              revealRowIndex={revealRowIndex}
              winningRowIndex={winningRowIndex}
              gameOver={gameOver}
            />
          );
        })}
      </div>

      <p className="text-center text-xs text-purple-200 mb-4">
        Type letters on your keyboard to fill the current row. Press Enter to submit, or use the on-screen keys.
      </p>

      {showShareButton && gameOver && guesses.length > 0 && (
        <div className="flex justify-center mb-4">
          <button
            className="px-4 py-2 bg-green-500 text-white rounded font-bold hover:bg-green-600 transition"
            onClick={() => handleShare({ playerName, guesses, targetWord: todayWord })}
            title="Share your result to WhatsApp"
          >
            Share
          </button>
        </div>
      )}

      <Keyboard
        keyboardStatus={keyboardStatus}
        onKeyPress={handleKeyPress}
        gameOver={gameOver}
        isRevealing={isRevealing}
        currentGuessLength={currentGuess.length}
      />
    </div>
  );
}
