import { useState, useEffect } from "react";
import GameBoard from "./GameBoard";
import Keyboard from "./Keyboard";
import { fetchJson } from "../utils/apiClient";
import { getGuessStatuses } from "../utils/wordUtils";
import { API_BASE, FLIP_DURATION, FLIP_STAGGER } from "../constants/gameConstants";

// Share handler for golf course results - creates a text table
function handleShareCourseResult({ playerName, completedHoles, totalScore }) {
  const scoreText = totalScore > 0 ? `+${totalScore}` : totalScore === 0 ? 'E' : `${totalScore}`;
  
  let shareText = `🏌️ Grordle Golf - ${playerName}\n`;
  shareText += `Total Score: ${scoreText}\n\n`;
  
  completedHoles.forEach(hole => {
    const holeScore = hole.score === 0 ? 'E' : hole.score > 0 ? `+${hole.score}` : `${hole.score}`;
    const emoji = hole.score < 0 ? '🟢' : hole.score === 0 ? '🔵' : '🔴';
    
    // Check if player failed: score = (attempts + 1) - par means failure
    // Success: score = attempts - par
    const failed = hole.score === (hole.attempts + 1 - hole.par);
    const attemptText = failed ? 'Failed' : `${hole.attempts} ${hole.attempts === 1 ? 'shot' : 'shots'}`;
    
    shareText += `${emoji} Hole ${hole.hole_number}: Par ${hole.par} → ${attemptText} (${holeScore})\n`;
  });
  
  if (navigator && navigator.clipboard) {
    navigator.clipboard.writeText(shareText);
  }
  const waUrl = 'https://wa.me/?text=' + encodeURIComponent(shareText);
  window.open(waUrl, '_blank');
}

export default function GolfGame({ playerName, setMessage, validationWords }) {
    // Viewing mode state
    const [isViewingMode, setIsViewingMode] = useState(false);
    // State to save game before viewing a completed hole
    const [savedGameState, setSavedGameState] = useState(null);
    // Track which hole is being viewed in viewing mode
    const [viewingHoleNumber, setViewingHoleNumber] = useState(null);
  const [roundId, setRoundId] = useState(null);
  const [currentHole, setCurrentHole] = useState(1);
  const [targetWord, setTargetWord] = useState("");
  const [startWord, setStartWord] = useState("");
  const [par, setPar] = useState(3);
  const [currentGuess, setCurrentGuess] = useState("");
  const [guesses, setGuesses] = useState([]);
  const [gameOver, setGameOver] = useState(false);
  const [keyboardStatus, setKeyboardStatus] = useState({});
  const [completedHoles, setCompletedHoles] = useState([]);
  const [roundCompleted, setRoundCompleted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Viewing mode state
  // (already declared above)

  console.log("[GolfGame] Component mounted", { playerName });

  const [revealRowIndex, setRevealRowIndex] = useState(null);
  const [shakeRowIndex, setShakeRowIndex] = useState(null);
  const [isRevealing, setIsRevealing] = useState(false);
  const [winningRowIndex, setWinningRowIndex] = useState(null);

  // Track if we've initialized to prevent re-running useEffect when exiting viewing mode
  const [hasInitialized, setHasInitialized] = useState(false);

  // Reset hasInitialized when component unmounts (user leaves golf game)
  useEffect(() => {
    return () => {
      setHasInitialized(false);
    };
  }, []);

  // Start or resume golf round
  useEffect(() => {
    console.log("[GolfGame] useEffect triggered", { playerName, hasInitialized, isViewingMode });
    if (!playerName || hasInitialized || isViewingMode) return;

    const initRound = async () => {
      setIsLoading(true);
      try {
        // Single API call to get round + current hole data
        const result = await fetchJson(`${API_BASE}/golf-game-state`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerName })
        });

        if (result.ok) {
          setRoundId(result.roundId);
          setCurrentHole(result.currentHole);
          setCompletedHoles(result.completedHoles || []);

          console.log('[GolfGame] Result from golf-game-state:', JSON.stringify(result, null, 2));

          // Check if round is already completed
          if (result.roundCompleted) {
            console.log('[GolfGame] Round is completed, showing summary');
            setRoundCompleted(true);
            setHasInitialized(true);
            setIsLoading(false);
            return;
          }

          // Load hole data from the combined response (no additional API call needed)
          if (result.currentHoleData) {
            setTargetWord(result.currentHoleData.targetWord);
            setStartWord(result.currentHoleData.startWord);
            setPar(result.currentHoleData.par);

            console.log(`[GolfGame] 🎯 TARGET WORD: ${result.currentHoleData.targetWord}`);

            // Load saved guesses if resuming
            let savedGuesses = [];
            if (result.currentHoleData.guesses) {
              if (Array.isArray(result.currentHoleData.guesses)) {
                savedGuesses = result.currentHoleData.guesses;
              } else if (typeof result.currentHoleData.guesses === 'string') {
                try {
                  savedGuesses = JSON.parse(result.currentHoleData.guesses);
                } catch (e) {
                  console.error('[GolfGame] Failed to parse guesses:', e);
                  savedGuesses = [];
                }
              }
            }
            
            setGuesses(savedGuesses);
            setCurrentGuess("");
            setGameOver(false);
            setMessage("");
              // Rebuild keyboard status from saved guesses
              if (savedGuesses.length > 0) {
                const newKeyboardStatus = {};
                savedGuesses.forEach(guess => {
                  const statuses = getGuessStatuses(guess, result.currentHoleData.targetWord);
                  for (let i = 0; i < guess.length; i++) {
                    const letter = guess[i];
                    const status = statuses[i];
                    if (!newKeyboardStatus[letter] || status === "correct" ||
                        (status === "present" && newKeyboardStatus[letter] !== "correct")) {
                      newKeyboardStatus[letter] = status;
                    }
                  }
                });
                setKeyboardStatus(newKeyboardStatus);
              } else {
                setKeyboardStatus({});
              }
            
            console.log('[GolfGame] Loaded hole', result.currentHole, '- Par:', result.currentHoleData.par, 'Guesses:', savedGuesses.length);
          }
          
          setHasInitialized(true);
        }
      } catch (err) {
        console.error("Error starting round:", err);
      } finally {
        setIsLoading(false);
      }
    };
    initRound();
  }, [playerName, hasInitialized, isViewingMode]);

  // Physical keyboard handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (gameOver || isRevealing || isLoading || isViewingMode) return;
      const key = e.key.toUpperCase();
      if (key === "ENTER") {
        e.preventDefault();
        handleSubmitGuess();
      } else if (key === "BACKSPACE") {
        e.preventDefault();
        setCurrentGuess(prev => prev.slice(0, -1));
      } else if (key === "ESCAPE") {
        e.preventDefault();
        setCurrentGuess("");
      } else if (/^[A-Z]$/.test(key) && currentGuess.length < 5) {
        e.preventDefault();
        setCurrentGuess(prev => prev + key);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentGuess, gameOver, isRevealing, isLoading, isViewingMode]);
      // Word voting UI removed

  const loadNextHole = async (rid) => {
    const roundIdToUse = rid || roundId;
    if (!roundIdToUse) return;

    setIsLoading(true);
    try {
      const result = await fetchJson(`${API_BASE}/golf-next-hole`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roundId: roundIdToUse })
      });

      if (result.ok) {
        setTargetWord(result.targetWord);
        setStartWord(result.startWord);
        setPar(result.par);

        console.log(`[GolfGame] 🎯 TARGET WORD (Next Hole): ${result.targetWord}`);

        // Load saved guesses if resuming, otherwise start fresh - handle both JSONB and array formats
        let savedGuesses = [];
        if (result.guesses) {
          if (Array.isArray(result.guesses)) {
            savedGuesses = result.guesses;
          } else if (typeof result.guesses === 'string') {
            try {
              savedGuesses = JSON.parse(result.guesses);
            } catch (e) {
              console.error("[GolfGame] Error parsing saved guesses:", e);
              savedGuesses = [];
            }
          }
        }
        setGuesses(savedGuesses);
        
        // Rebuild keyboard status from saved guesses
        if (savedGuesses.length > 0) {
          const newKeyboardStatus = {};
          savedGuesses.forEach(guess => {
            const statuses = getGuessStatuses(guess, result.targetWord);
            for (let i = 0; i < guess.length; i++) {
              const letter = guess[i];
              const status = statuses[i];
              if (!newKeyboardStatus[letter] || status === "correct" ||
                  (status === "present" && newKeyboardStatus[letter] !== "correct")) {
                newKeyboardStatus[letter] = status;
              }
            }
          });
          setKeyboardStatus(newKeyboardStatus);
        } else {
          setKeyboardStatus({});
        }
        
        setCurrentGuess("");
        setGameOver(false);
        setRevealRowIndex(null);
        setWinningRowIndex(null);
        setMessage(`Hole ${result.holeNumber} - Par ${result.par}`);
      }
    } catch (err) {
      console.error("Error loading next hole:", err);
      console.error("Error response:", err.response);
      const errorMsg = err.response?.error || err.response?.details || err.message;
      setMessage(`Error loading hole: ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitGuess = async () => {
    if (currentGuess.length !== 5) {
      setMessage("Guess must be 5 letters");
      return;
    }

    // Validate word (client-side if available, server-side as fallback)
    if (validationWords) {
      // Fast client-side validation
      if (!validationWords.has(currentGuess)) {
        setShakeRowIndex(guesses.length);
        setMessage(`"${currentGuess}" is not in the word list`);
        setTimeout(() => {
          setShakeRowIndex(null);
          setMessage("");
        }, 600);
        return;
      }
    } else {
      // Fallback to server validation
      try {
        const response = await fetch("/api/validate-word", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ word: currentGuess })
        });
        const data = await response.json();

        if (!data.valid) {
          setShakeRowIndex(guesses.length);
          setMessage(`"${currentGuess}" is not in the word list`);
          setTimeout(() => {
            setShakeRowIndex(null);
            setMessage("");
          }, 600);
          return;
        }
      } catch (err) {
        console.error("Error validating word:", err);
        setMessage("Error validating word");
        return;
      }
    }

    const newGuesses = [...guesses, currentGuess];
    
    // Set animation states FIRST, before updating guesses
    // This ensures the reveal animation starts immediately with neutral colors
    setRevealRowIndex(newGuesses.length - 1);
    setIsRevealing(true);
    
    // Then update the guesses array and clear current guess
    setGuesses(newGuesses);
    setCurrentGuess("");

    // Save guesses to backend
    try {
      console.log('[GolfGame] Saving guesses:', { roundId, holeNumber: currentHole, guesses: newGuesses });
      const saveResult = await fetchJson(`${API_BASE}/golf-save-guesses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roundId,
          holeNumber: currentHole,
          guesses: newGuesses
        })
      });
      console.log('[GolfGame] Save result:', saveResult);
    } catch (err) {
      console.error("Error saving guesses:", err);
      // Don't block gameplay if save fails
    }

    const revealTime = FLIP_DURATION + (4 * FLIP_STAGGER);
    setTimeout(() => {
      setIsRevealing(false);
      setRevealRowIndex(null);

      // Update keyboard status AFTER animation completes
      const statuses = getGuessStatuses(currentGuess, targetWord);
      const newKeyboardStatus = { ...keyboardStatus };
      for (let i = 0; i < currentGuess.length; i++) {
        const letter = currentGuess[i];
        const status = statuses[i];
        if (!newKeyboardStatus[letter] || status === "correct" ||
            (status === "present" && newKeyboardStatus[letter] !== "correct")) {
          newKeyboardStatus[letter] = status;
        }
      }
      setKeyboardStatus(newKeyboardStatus);

      const isWin = currentGuess === targetWord;
      const isLoss = newGuesses.length >= 6 && !isWin;

      if (isWin) {
        setWinningRowIndex(newGuesses.length - 1);
        handleHoleComplete(newGuesses.length, true);
      } else if (isLoss) {
        handleHoleComplete(newGuesses.length, false);
      }
    }, revealTime);
  };

  const handleHoleComplete = async (attempts, success) => {
    setGameOver(true);

    console.log('[GolfGame] handleHoleComplete called', { attempts, success, currentHole, completedHoles });

    try {
      const result = await fetchJson(`${API_BASE}/golf-submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roundId,
          holeNumber: currentHole,
          attempts,
          success
        })
      });

      console.log('[GolfGame] golf-submit result:', result);

      if (result.ok) {
        const score = result.score;
        const scoreText = score === 0 ? "Par" : score > 0 ? `+${score}` : `${score}`;
        
        // Add to completed holes
        const newCompletedHole = {
          hole_number: currentHole,
          par,
          attempts,
          score
        };
        
        console.log('[GolfGame] Adding completed hole:', newCompletedHole);
        
        setCompletedHoles(prev => {
          // Replace or add the completed hole entry
          const filtered = prev.filter(h => h.hole_number !== newCompletedHole.hole_number);
          const updated = [...filtered, newCompletedHole].sort((a, b) => a.hole_number - b.hole_number);
          console.log('[GolfGame] Updated completedHoles:', updated);
          return updated;
        });

        if (result.roundCompleted) {
          setRoundCompleted(true);
          setHasInitialized(true); // Prevent re-initialization
          const failMessage = !success ? `The word was: ${targetWord}. ` : '';
          setMessage(`${failMessage}Round Complete! Total Score: ${result.totalScore > 0 ? '+' : ''}${result.totalScore}`);
        } else {
          const failMessage = !success ? `The word was: ${targetWord}. ` : '';
          setMessage(`${failMessage}Hole ${currentHole} Complete! Score: ${scoreText}. Click 'Next Hole' to continue.`);
        }
      }
    } catch (err) {
      console.error("Error submitting hole:", err);
      setMessage("Error submitting score. Please try again.");
    }
  };

  const handleNextHole = () => {
    setCurrentHole(prev => prev + 1);
    loadNextHole(roundId);
  };

  const handleNewRound = () => {
    setRoundCompleted(false);
    setCompletedHoles([]);
    setCurrentHole(1);
    setRoundId(null);
    // Will trigger useEffect to start new round
    const initRound = async () => {
      setIsLoading(true);
      try {
        // Use combined endpoint for faster loading
        const result = await fetchJson(`${API_BASE}/golf-game-state`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerName })
        });

        if (result.ok) {
          setRoundId(result.roundId);
          setCurrentHole(1);
          setCompletedHoles([]);
          setRoundCompleted(false);
          
          // Load hole data from combined response
          if (result.currentHoleData) {
            setTargetWord(result.currentHoleData.targetWord);
            setStartWord(result.currentHoleData.startWord);
            setPar(result.currentHoleData.par);

            console.log(`[GolfGame] 🎯 TARGET WORD (New Round): ${result.currentHoleData.targetWord}`);

            setGuesses([]);
            setCurrentGuess("");
            setGameOver(false);
            setKeyboardStatus({});
            setMessage(`Hole 1 - Par ${result.currentHoleData.par}`);
          }
        }
      } catch (err) {
        console.error("Error starting new round:", err);
        setMessage("Error starting new round. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };
    initRound();
  };

  const handleKeyPress = (key) => {
    if (gameOver || isRevealing || isViewingMode) return;

    if (key === "ENTER") {
      handleSubmitGuess();
    } else if (key === "CLEAR") {
      setCurrentGuess("");
    } else if (key === "BACKSPACE") {
      setCurrentGuess(prev => prev.slice(0, -1));
    } else if (currentGuess.length < 5) {
      setCurrentGuess(prev => prev + key);
    }
  };

  const handleViewHole = async (holeNumber) => {
    console.log('[GolfGame] handleViewHole called', { holeNumber, roundId, currentHole, gameOver });
    
    if (!roundId) {
      console.log('[GolfGame] No roundId, returning');
      return;
    }
    
    // Don't view the current active hole in view mode
    if (holeNumber === currentHole && !gameOver) {
      console.log('[GolfGame] Cannot view current active hole');
      return;
    }

    setIsLoading(true);
    try {
      console.log('[GolfGame] Fetching hole data for hole', holeNumber);
      const result = await fetchJson(`${API_BASE}/golf-get-hole`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roundId, holeNumber })
      });

      console.log('[GolfGame] Received result:', result);

      if (result.ok && result.holeData) {
        // Save current game state before entering viewing mode (ONLY if not already viewing)
        if (!isViewingMode) {
          console.log('[GolfGame] Saving game state before viewing', {
            currentHole,
            targetWord,
            guesses: guesses.length,
            gameOver
          });
          setSavedGameState({
            currentHole,
            targetWord,
            startWord,
            par,
            guesses,
            currentGuess,
            gameOver,
            keyboardStatus
          });
        } else {
          console.log('[GolfGame] Already in viewing mode, keeping original saved state');
        }

        // Load hole data for viewing
        const { holeData } = result;
        setIsViewingMode(true);
        setViewingHoleNumber(holeNumber);
        setTargetWord(holeData.targetWord);
        setStartWord(holeData.startWord);
        setPar(holeData.par);

        console.log(`[GolfGame] 🎯 TARGET WORD (Viewing Hole ${holeNumber}): ${holeData.targetWord}`);

        setGuesses(holeData.guesses || []);
        setCurrentGuess("");
        setGameOver(true); // Make it read-only

        // Rebuild keyboard status
        if (holeData.guesses && holeData.guesses.length > 0) {
          const newKeyboardStatus = {};
          holeData.guesses.forEach(guess => {
            const statuses = getGuessStatuses(guess, holeData.targetWord);
            for (let i = 0; i < guess.length; i++) {
              const letter = guess[i];
              const status = statuses[i];
              if (!newKeyboardStatus[letter] || status === "correct" ||
                  (status === "present" && newKeyboardStatus[letter] !== "correct")) {
                newKeyboardStatus[letter] = status;
              }
            }
          });
          setKeyboardStatus(newKeyboardStatus);
        } else {
          setKeyboardStatus({});
        }

        // Set message based on hole completion
        if (holeData.isCompleted) {
          if (holeData.success) {
            setMessage(`Viewing Hole ${holeNumber} - Completed in ${holeData.attempts} attempts`);
          } else {
            setMessage(`Viewing Hole ${holeNumber} - Failed. The word was: ${holeData.targetWord}`);
          }
        } else if (holeData.guesses && holeData.guesses.length > 0) {
          setMessage(`Viewing Hole ${holeNumber} - In progress (${holeData.guesses.length} guesses)`);
        } else {
          setMessage(`Viewing Hole ${holeNumber}`);
        }
      }
    } catch (err) {
      console.error("Error loading hole for viewing:", err);
      setMessage("Error loading hole");
    } finally {
      setIsLoading(false);
    }
  };

  const handleExitViewingMode = () => {
    console.log('[GolfGame] Exiting viewing mode', { savedGameState, currentHole, viewingHoleNumber });
    
    if (!savedGameState) {
      console.warn('[GolfGame] No saved game state to restore!');
      setIsViewingMode(false);
      setViewingHoleNumber(null);
      return;
    }
    
    // First, clear viewing mode flags
    setIsViewingMode(false);
    setViewingHoleNumber(null);
    
    // Then restore all game state in one go
    const restored = savedGameState;
    console.log('[GolfGame] Restoring game state:', restored);
    
    setCurrentHole(restored.currentHole);
    setTargetWord(restored.targetWord);
    setStartWord(restored.startWord);
    setPar(restored.par);
    setGuesses(restored.guesses);
    setCurrentGuess(restored.currentGuess);
    setGameOver(restored.gameOver);
    setKeyboardStatus(restored.keyboardStatus);
    
    // Clear saved state
    setSavedGameState(null);
    
    // Clear animation states
    setRevealRowIndex(null);
    setShakeRowIndex(null);
    setWinningRowIndex(null);
    setIsRevealing(false);
    
    // Clear message
    setMessage("");
    
    console.log('[GolfGame] Viewing mode exited, restored to hole', restored.currentHole);
  };

  if (isLoading) {
    console.log("[GolfGame] Rendering loading state");
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-white">
        <div className="mb-6">
          <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
        </div>
        <div className="text-2xl font-bold mb-2">🏌️ Loading Golf Mode</div>
        <div className="text-white/60">
          {isViewingMode ? "Reviewing golf hole..." : "Setting up your round..."}
        </div>
      </div>
    );
  }

  if (roundCompleted && !isViewingMode) {
    console.log("[GolfGame] Rendering round complete state");
    const totalScore = completedHoles.reduce((sum, hole) => sum + hole.score, 0);
    // Build a map of hole_number to targetWord for sharing
    const holeWords = {};
    completedHoles.forEach(hole => {
      if (hole.targetWord) holeWords[hole.hole_number] = hole.targetWord;
      else if (hole.hole_number === currentHole && targetWord) holeWords[hole.hole_number] = targetWord;
    });
    // Also try to add guesses to each hole if not present
    const holesWithGuesses = completedHoles.map(hole => {
      if (!hole.guesses && hole.hole_number === currentHole) {
        return { ...hole, guesses };
      }
      return hole;
    });
    return (
      <div className="space-y-6">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 shadow-2xl">
          <h2 className="text-3xl font-bold text-white mb-6 text-center">🏌️ Round Complete!</h2>
          <div className="bg-white/20 rounded-xl p-6 mb-6">
            <h3 className="text-2xl font-bold text-white text-center mb-4">
              Total Score: {totalScore > 0 ? '+' : ''}{totalScore}
            </h3>
            <div className="text-white/80 text-center mb-4">
              Click any hole below to review your game
            </div>
            <div className="space-y-2">
              {completedHoles.map((hole) => {
                const scoreText = hole.score === 0 ? "Par" : hole.score > 0 ? `+${hole.score}` : `${hole.score}`;
                const colorClass = hole.score < 0 ? "text-green-400" : hole.score === 0 ? "text-blue-400" : "text-red-400";
                const parColor = hole.par === 3 ? "text-green-300" : hole.par === 4 ? "text-yellow-300" : "text-red-300";
                
                // Check if player failed: score = (attempts + 1) - par means failure
                const failed = hole.score === (hole.attempts + 1 - hole.par);
                const attemptText = failed ? 'Failed' : `${hole.attempts} ${hole.attempts === 1 ? 'shot' : 'shots'}`;
                
                return (
                  <div 
                    key={hole.hole_number} 
                    onClick={() => handleViewHole(hole.hole_number)}
                    className="flex justify-between items-center bg-white/10 rounded p-3 cursor-pointer hover:bg-white/20 transition"
                  >
                    <span className="text-white font-semibold">Hole {hole.hole_number}</span>
                    <span className={`font-bold ${parColor}`}>Par {hole.par}</span>
                    <span className="text-white">{attemptText}</span>
                    <span className={`font-bold ${colorClass}`}>{scoreText}</span>
                  </div>
                );
              })}
            </div>
            {/* Share Course Result button - only show if not in viewing mode */}
            {!isViewingMode && (
              <div className="flex justify-center mt-6">
                <button
                  className="px-6 py-3 bg-green-500 text-white rounded-xl font-bold hover:bg-green-600 transition text-lg"
                  onClick={() => handleShareCourseResult({
                    playerName,
                    completedHoles: holesWithGuesses,
                    totalScore,
                    holeWords
                  })}
                  title="Share your course result to WhatsApp"
                >
                  SHARE COURSE RESULT
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // If viewing mode while round is complete, show the viewing interface
  if (roundCompleted && isViewingMode) {
    return (
      <div className="space-y-6">
        {/* Return to Summary Button */}
        <button
          onClick={() => {
            setIsViewingMode(false);
            setViewingHoleNumber(null);
            setSavedGameState(null);
            setMessage("");
          }}
          className="w-full py-3 bg-purple-500 text-white rounded-xl font-bold hover:bg-purple-600 transition"
        >
          ← Back to Round Summary
        </button>

        {/* Scorecard for navigation */}
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-xl font-bold text-white">Viewing Hole {viewingHoleNumber} of 9</h3>
            <div className="text-lg font-bold text-yellow-400">Par {par}</div>
          </div>
          
          <div className="grid grid-cols-9 gap-1 mb-2">
            {[1,2,3,4,5,6,7,8,9].map(holeNum => {
              const hole = completedHoles.find(h => h.hole_number === holeNum);
              const isViewing = holeNum === viewingHoleNumber;
              const isCompleted = hole && hole.score !== null;
              
              const getScoreLabel = (score) => {
                if (score === 0) return "E";
                if (score > 0) return `+${score}`;
                return `${score}`;
              };
              
              return (
                <div 
                  key={holeNum}
                  onClick={() => handleViewHole(holeNum)}
                  className={`text-center p-2 rounded cursor-pointer hover:ring-2 hover:ring-white/50 transition ${
                    isViewing ? 'bg-purple-500 text-white font-bold ring-2 ring-purple-300' :
                    isCompleted ? (hole.score < 0 ? 'bg-green-500/50 text-white' : 
                           hole.score === 0 ? 'bg-blue-500/50 text-white' : 
                           'bg-red-500/50 text-white') : 
                    'bg-white/10 text-gray-400'
                  }`}
                  title={`Click to view Hole ${holeNum}`}
                >
                  <div className="text-xs">#{holeNum}</div>
                  {isCompleted && (
                    <>
                      <div className="text-xs">Par {hole.par}</div>
                      <div className="text-xs font-bold">{getScoreLabel(hole.score)}</div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Game Board in view-only mode */}
        <GameBoard
          guesses={guesses}
          currentGuess=""
          todayWord={targetWord}
          targetWord={targetWord}
          maxGuesses={6}
          revealRowIndex={revealRowIndex}
          shakeRowIndex={shakeRowIndex}
          winningRowIndex={winningRowIndex}
          gameOver={true}
          keyboardStatus={keyboardStatus}
          onKeyPress={() => {}}
          isRevealing={isRevealing}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Scorecard */}
      <div className="bg-white/10 backdrop-blur-md rounded-xl p-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-xl font-bold text-white">
            {isViewingMode ? `Viewing Hole ${viewingHoleNumber} of 9` : `Hole ${currentHole} of 9`}
          </h3>
          <h3 className="text-xl font-bold text-white">
            {isViewingMode ? `Viewing Hole ${viewingHoleNumber} of 9` : `Hole ${currentHole} of 9`}
          </h3>
          <div className="text-lg font-bold text-yellow-400">Par {par}</div>
        </div>
        
        {console.log('[GolfGame Scorecard Render] completedHoles:', completedHoles, 'length:', completedHoles.length)}
        {console.log('[GolfGame Scorecard Render] completedHoles detail:', completedHoles.map(h => `Hole ${h.hole_number}: score=${h.score}`))}
        
        <div className="grid grid-cols-9 gap-1 mb-2">
          {[1,2,3,4,5,6,7,8,9].map(holeNum => {
            const hole = completedHoles.find(h => h.hole_number === holeNum);
            const isActive = holeNum === currentHole && !isViewingMode;
            const isViewing = isViewingMode && holeNum === viewingHoleNumber;
            // A hole is clickable if it's completed and not the current active hole
            const isCompleted = hole && hole.score !== null;
            const isClickable = isCompleted && (!isActive || isViewingMode);

            // Format score as +/-/0
            const getScoreLabel = (score) => {
              if (score === 0) return "E";
              if (score > 0) return `+${score}`;
              return `${score}`;
            };

            return (
              <div 
                key={holeNum}
                onClick={() => {
                  console.log(`[GolfGame] Clicked hole ${holeNum}, isClickable: ${isClickable}`);
                  if (isClickable) {
                    handleViewHole(holeNum);
                  }
                }}
                className={`text-center p-2 rounded ${
                  isViewing ? 'bg-purple-500 text-white font-bold ring-2 ring-purple-300' :
                  isActive ? 'bg-blue-500 text-white font-bold' : 
                  isCompleted ? (hole.score < 0 ? 'bg-green-500/50 text-white' : 
                         hole.score === 0 ? 'bg-blue-500/50 text-white' : 
                         'bg-red-500/50 text-white') : 
                  'bg-white/10 text-gray-400'
                } ${isClickable ? 'cursor-pointer hover:ring-2 hover:ring-white/50 transition' : ''}`}
                title={isClickable ? `Click to view Hole ${holeNum}` : ''}
              >
                <div className="text-xs">#{holeNum}</div>
                {isCompleted ? (
                  <>
                    <div className="text-xs">Par {hole.par}</div>
                    <div className="text-xs font-bold">{getScoreLabel(hole.score)}</div>
                  </>
                ) : (
                  <div className="text-xs opacity-50">-</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Exit Viewing Mode Button */}

      {isViewingMode && (
        <button
          onClick={handleExitViewingMode}
          className="w-full py-3 bg-purple-500 text-white rounded-xl font-bold hover:bg-purple-600 transition"
        >
          ← Return to Current Hole ({currentHole}/9)
        </button>
      )}

      {/* Game Board */}
      <GameBoard
        guesses={guesses}
        currentGuess={isViewingMode ? "" : currentGuess}
        todayWord={targetWord}
        targetWord={targetWord}
        maxGuesses={6}
        revealRowIndex={revealRowIndex}
        shakeRowIndex={shakeRowIndex}
        winningRowIndex={winningRowIndex}
        gameOver={gameOver}
        keyboardStatus={keyboardStatus}
        onKeyPress={isViewingMode ? () => {} : handleKeyPress}
        isRevealing={isRevealing}
        showShareButton={false}
      />



      {/* Next Hole Button */}
      {gameOver && !roundCompleted && !isViewingMode && (
        <button
          onClick={handleNextHole}
          className="w-full py-4 bg-gradient-to-r from-green-500 to-blue-500 text-white rounded-xl font-bold text-lg hover:from-green-600 hover:to-blue-600 transition"
        >
          {currentHole < 9 ? `➡️ Next Hole (${currentHole + 1}/9)` : "🏁 Finish Round"}
        </button>
      )}

      {/* Share Button is only rendered in the round complete summary, never at the bottom of each hole. */}
    </div>
  );
}
