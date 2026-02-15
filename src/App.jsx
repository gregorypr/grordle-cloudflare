import { useState, useEffect } from "react";
import TabButton from "./components/TabButton";
import GameBoard from "./components/GameBoard";
import Leaderboard from "./components/Leaderboard";
import AdminPanel from "./components/AdminPanel";
import CompletedGames from "./components/CompletedGames";
import Login from "./components/Login";
import AnimatedLogo from "./components/AnimatedLogo";
import LoadingScreen from "./components/LoadingScreen";
import GolfGame from "./components/GolfGame";
import GolfLeaderboard from "./components/GolfLeaderboard";
import GolfMatchScores from "./components/GolfMatchScores";
import MessageCalendar from "./components/MessageCalendar";
import { useWordList } from "./hooks/useWordList";
import { useScores } from "./hooks/useScores";
import {
  getAustralianDate,
  getDailyIndex,
  formatDateDDMMMYY,
} from "./utils/dateUtils";
import { getGuessStatuses, isPlural } from "./utils/wordUtils";
import { fetchJson } from "./utils/apiClient";
import { calculateDifficulty } from "./utils/difficultyUtils";
import { getQuoteOfTheDay } from "./utils/quotes";
import {
  API_BASE,
  LOGO_SRC,
  FLIP_DURATION,
  FLIP_STAGGER,
} from "./constants/gameConstants";
import "./styles/animations.css";
import "./styles/scrollbar.css";

function ordinal(n) {
  const s = ["th","st","nd","rd"];
  return n + (s[(n % 100 - 20) % 10] || s[n % 100] || s[0]);
}

export default function App() {
  const [view, setView] = useState("game");
  const [playerName, setPlayerName] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentGuess, setCurrentGuess] = useState("");
  const [guesses, setGuesses] = useState([]);
  const [gameOver, setGameOver] = useState(false);
  const [message, setMessage] = useState("");
  const [keyboardStatus, setKeyboardStatus] = useState({});
  const [todayWord, setTodayWord] = useState("");
  const [todayDate, setTodayDate] = useState("");
  const [startWord, setStartWord] = useState("");
  const [startWordOwner, setStartWordOwner] = useState("");
  const [todayDifficulty, setTodayDifficulty] = useState("");

  const [revealRowIndex, setRevealRowIndex] = useState(null);
  const [shakeRowIndex, setShakeRowIndex] = useState(null);
  const [isRevealing, setIsRevealing] = useState(false);
  const [winningRowIndex, setWinningRowIndex] = useState(null);

  const [isAdmin, setIsAdmin] = useState(false);
  const [hasAutoStarted, setHasAutoStarted] = useState(false);
  const [scoresRefreshTrigger, setScoresRefreshTrigger] = useState(0);
  const [isGameLoading, setIsGameLoading] = useState(false);
  const [todayMessage, setTodayMessage] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [yesterdayWinners, setYesterdayWinners] = useState(null);

  // Fetch today's message of the day, tenant name, and yesterday's winners
  useEffect(() => {
    const fetchTodayMessage = async () => {
      try {
        const today = getAustralianDate();
        const response = await fetch(`${API_BASE}/motd?date=${today}`);
        if (response.ok) {
          const result = await response.json();
          if (result.ok && result.message) {
            setTodayMessage(result.message);
          }
        }
      } catch (err) {
        console.log("[App] MOTD not available (endpoint may not exist yet)");
      }
    };
    const fetchTenantName = async () => {
      try {
        const response = await fetch(`${API_BASE}/tenant-settings`);
        if (response.ok) {
          const result = await response.json();
          setTenantName(result.display_name || result.name || "");
        }
      } catch (err) {
        console.log("[App] Tenant settings not available");
      }
    };
    const fetchYesterdayWinners = async () => {
      try {
        const response = await fetch(`${API_BASE}/yesterday-winners`);
        if (response.ok) {
          const result = await response.json();
          if (result.ok && (result.dailyWinners || result.golfWinners)) {
            setYesterdayWinners(result);
          }
        }
      } catch (err) {
        console.log("[App] Yesterday winners not available");
      }
    };
    fetchTodayMessage();
    fetchTenantName();
    fetchYesterdayWinners();
  }, []);

  // Check for saved authentication on mount
  useEffect(() => {
    const savedUsername = localStorage.getItem("grordle_username");
    const savedPassword = localStorage.getItem("grordle_password");
    const savedRemember = localStorage.getItem("grordle_remember") === "true";
    const savedAuth = localStorage.getItem("grordle_authenticated") === "true";

    if (savedUsername && savedPassword && savedRemember && savedAuth) {
      // Attempt silent auto-login
      (async () => {
        try {
          const data = await fetchJson(`${API_BASE}/auth`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              username: savedUsername,
              password: savedPassword,
              action: "login"
            })
          });

          if (data.success) {
            setPlayerName(data.user.username);
            setIsAuthenticated(true);
          } else {
            // Clear invalid credentials
            localStorage.removeItem("grordle_authenticated");
          }
        } catch (err) {
          // Silent fail - user will see login screen
          localStorage.removeItem("grordle_authenticated");
        } finally {
          setIsCheckingAuth(false);
        }
      })();
    } else {
      setIsCheckingAuth(false);
    }
  }, []);

  // Custom hooks
  const { wordListLoaded, validationWords, loadingError } = useWordList();
  const {
    scores,
    dailyScores,
    dailyPlayers,
    allPlayers,
    setDailyPlayers,
    setScores,
    setDailyScores,
    setAllPlayers,
    recordScore,
  } = useScores(todayDate, wordListLoaded, null, scoresRefreshTrigger);

  // Fetch all game state in one API call (word + scores + players)
  useEffect(() => {
    if (!wordListLoaded) return;

    const today = getAustralianDate();
    setTodayDate(today);

    // Fetch all game state from server in single call
    const fetchGameState = async () => {
      try {
        const response = await fetch(`/api/game-state?date=${today}`);
        const data = await response.json();
        
        if (data.ok) {
          setTodayWord(data.targetWord);
          setDailyPlayers(data.dailyPlayers || []);
          setDailyScores(data.dailyScores || {});
          setScores(data.allScores || {});
          setAllPlayers(data.allPlayers || []);

          // Set difficulty based on par value
          if (data.par === 3) {
            setTodayDifficulty("Easy");
          } else if (data.par === 5) {
            setTodayDifficulty("Hard");
          } else {
            setTodayDifficulty("Medium");
          }

          console.log("[App] Game state loaded:", data.targetWord, "Par:", data.par);
          setIsGameLoading(false); // Done loading
        } else {
          console.error("[App] Failed to get game state:", data.error);
          setIsGameLoading(false); // Stop loading even on error
        }
      } catch (err) {
        console.error("[App] Error fetching game state:", err);
        setIsGameLoading(false); // Stop loading on error
      }
    };

    fetchGameState();

    // Shared handler for day change detection
    let lastCheckedDate = today;
    const checkForDayChange = () => {
      const currentDate = getAustralianDate();
      if (currentDate !== lastCheckedDate) {
        console.log("[App] Day changed!", lastCheckedDate, "->", currentDate, "Reloading...");
        lastCheckedDate = currentDate;
        // Reload the page to get fresh game state for the new day
        window.location.reload();
      }
    };

    // Check for day change every minute
    const dayCheckInterval = setInterval(checkForDayChange, 60000);

    // Also check when user returns to the tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkForDayChange();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(dayCheckInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [wordListLoaded]);

  // Difficulty is now returned from get-target-word API
  // No longer needs client-side calculation

  // Save game state whenever guesses change
  useEffect(() => {
    if (isPlaying && guesses.length > 0 && playerName.trim()) {
      saveGameState(guesses, gameOver);
    }
  }, [guesses, gameOver]);

  // Auto-start game when authenticated and ready
  useEffect(() => {
    if (
      isAuthenticated &&
      playerName &&
      wordListLoaded &&
      todayWord &&
      todayDate &&
      !hasAutoStarted
    ) {
      setHasAutoStarted(true);
      setIsGameLoading(true);
      // Refresh scores data to ensure we have the latest user list
      setScoresRefreshTrigger((prev) => prev + 1);
      // Auto-start the game immediately
      startGame();
    }
  }, [
    isAuthenticated,
    playerName,
    wordListLoaded,
    todayWord,
    todayDate,
    hasAutoStarted,
  ]);

  // Clear message when switching away from daily game view
  useEffect(() => {
    if (view !== "playing" && view !== "game") {
      setMessage("");
    }
  }, [view]);

  const startGame = async () => {
    const name = playerName.trim().toLowerCase();
    if (!name) return;

    if (!wordListLoaded || !todayWord) {
      setMessage("Still loading dictionary… please wait a moment.");
      return;
    }

    setMessage("Loading game, please wait...");
    const today = getAustralianDate();

    console.log("[App] Starting game...");

    try {
      const data = await fetchJson(`${API_BASE}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: today,
          playerName: name,
        }),
      });

      if (!data.allowed) {
        setDailyPlayers(data.dailyPlayers || []);

        // Check if there's saved game state to resume
        if (
          data.gameState &&
          Array.isArray(data.gameState.guesses) &&
          data.gameState.guesses.length > 0
        ) {
          // Restore the game state
          const savedGuesses = data.gameState.guesses;
          setGuesses(savedGuesses);
          setStartWord(savedGuesses[0]);
          setGameOver(data.gameState.completed || false);
          setIsPlaying(true);
          setCurrentGuess("");

          // Set start word owner if available
          if (data.startWordOwner) {
            setStartWordOwner(data.startWordOwner);
          }

          // Rebuild keyboard status from all saved guesses
          const newStatus = {};
          for (const guess of savedGuesses) {
            const statuses = getGuessStatuses(guess, todayWord);
            for (let i = 0; i < guess.length; i++) {
              const letter = guess[i];
              const status = statuses[i];
              // Keep the best status for each letter
              if (
                !newStatus[letter] ||
                status === "correct" ||
                (status === "present" && newStatus[letter] !== "correct")
              ) {
                newStatus[letter] = status;
              }
            }
          }
          setKeyboardStatus(newStatus);

          // Set appropriate message based on game state
          if (data.gameState.completed) {
            const won = savedGuesses.some((g) => g === todayWord);
            const savedTargetWord = data.gameState.targetWord;
            if (won) {
              setMessage(`You already won today! Here are your results.`);
              setWinningRowIndex(savedGuesses.length - 1);
            } else if (savedTargetWord) {
              setMessage(
                `You already played today. The word was ${savedTargetWord}. Here are your results.`
              );
            } else {
              setMessage(`You already played today. Here are your results.`);
            }
            // Refresh scores to show updated results
            setScoresRefreshTrigger((prev) => prev + 1);
            setIsGameLoading(false);
          } else {
            setMessage("Resuming your game from where you left off.");
            setIsGameLoading(false);
          }
        } else {
          setMessage(name + " has already played today.");
          // Refresh scores to show their result
          setScoresRefreshTrigger((prev) => prev + 1);
          setIsGameLoading(false);
        }
        return;
      }

      if (Array.isArray(data.dailyPlayers)) {
        setDailyPlayers(data.dailyPlayers);
      }

      // Get the start word from API response
      if (!data.startWord) {
        setMessage(
          "⚠️ No start word allocated for today. Please contact admin to allocate start words. You can still view other tabs."
        );
        return;
      }

      const chosenWord = data.startWord.toUpperCase();
      const chosenOwner = data.startWordOwner || "Unknown";

      setStartWord(chosenWord);
      setStartWordOwner(chosenOwner);

      // Check if player has existing game state to resume
      if (
        data.gameState &&
        Array.isArray(data.gameState.guesses) &&
        data.gameState.guesses.length > 0
      ) {
        // Restore the saved game state
        const savedGuesses = data.gameState.guesses;
        setGuesses(savedGuesses);

        // Rebuild keyboard status from all saved guesses
        const newStatus = {};
        for (const guess of savedGuesses) {
          const statuses = getGuessStatuses(guess, todayWord);
          for (let i = 0; i < guess.length; i++) {
            const letter = guess[i];
            const status = statuses[i];
            // Keep the best status for each letter
            if (
              !newStatus[letter] ||
              status === "correct" ||
              (status === "present" && newStatus[letter] !== "correct")
            ) {
              newStatus[letter] = status;
            }
          }
        }
        setKeyboardStatus(newStatus);
        setMessage("Resuming your game from where you left off.");
      } else {
        // Fresh start - use start word
        const statuses = getGuessStatuses(chosenWord, todayWord);
        const initialGuesses = [chosenWord];
        setGuesses(initialGuesses);

        // Update keyboard status
        const newStatus = {};
        for (let i = 0; i < chosenWord.length; i++) {
          const letter = chosenWord[i];
          const status = statuses[i];
          newStatus[letter] = status;
        }
        setKeyboardStatus(newStatus);
      }

      setIsPlaying(true);
      setGameOver(false);
      setCurrentGuess("");
      setMessage("");
      setShakeRowIndex(null);
      setWinningRowIndex(null);

      setRevealRowIndex(0);
      setIsRevealing(true);
      const totalRevealTime =
        FLIP_DURATION + FLIP_STAGGER * (chosenWord.length - 1) + 200;
      setTimeout(() => {
        setIsRevealing(false);
        setRevealRowIndex(null);
        setIsGameLoading(false);
      }, totalRevealTime);
    } catch (err) {
      console.error("Error calling start API", err);
      setMessage("Error talking to the server. Please try again.");
      setIsGameLoading(false);
      return;
    }
  };

  const saveGameState = async (guessesArray, isCompleted) => {
    const name = playerName.trim();
    if (
      !name ||
      !todayDate ||
      !Array.isArray(guessesArray) ||
      guessesArray.length === 0
    )
      return;

    try {
      await fetchJson(`${API_BASE}/save-game`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: todayDate,
          playerName: name.toLowerCase(),
          guesses: guessesArray,
          completed: isCompleted,
          targetWord: todayWord,
        }),
      });
    } catch (err) {
      console.error("Error saving game state", err);
    }
  };

  const handleGameOver = (attempts, success) => {
    console.log(
      "handleGameOver called with attempts:",
      attempts,
      "success:",
      success
    );
    setGameOver(true);
    recordScore(playerName.trim().toLowerCase(), todayDate, attempts, success);
  };


  if (loadingError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="max-w-md w-full bg-red-900/40 border border-red-500 rounded-xl p-6 text-center">
          <h1 className="text-2xl font-bold text-white mb-4">
            Problem Loading Word List
          </h1>
          <p className="text-red-100 mb-4">{loadingError}</p>
          <p className="text-red-100 text-sm">
            You need an internet connection the first time to download the
            dictionary.
          </p>
        </div>
      </div>
    );
  }

  if (!wordListLoaded || !todayWord) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-purple-100 text-lg font-semibold">
            Loading dictionary and today&apos;s word…
          </p>
        </div>
      </div>
    );
  }

  // Show loading screen before login if data isn't ready
  if (!wordListLoaded || !todayWord) {
    return (
      <LoadingScreen
        wordListLoaded={wordListLoaded}
        todayWord={todayWord}
        loadingError={loadingError}
      />
    );
  }

  // Show loading screen while checking saved authentication
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-12 shadow-2xl text-center">
          <div className="mb-6">
            <AnimatedLogo />
          </div>
          <p className="text-white/80 text-lg">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // Show login screen if not authenticated
  if (!isAuthenticated) {
    return (
      <Login
        onLoginSuccess={(username) => {
          setPlayerName(username);
          setIsAuthenticated(true);
          localStorage.setItem("grordle_authenticated", "true");
        }}
      />
    );
  }

  // Show loading screen after login while game initialises
  if (isAuthenticated && isGameLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-12 shadow-2xl text-center">
          <div className="mb-6">
            <AnimatedLogo />
          </div>
          <h2 className="text-3xl font-bold text-white mb-4">
            Initialising Game...
          </h2>
          <p className="text-purple-200">Loading your game state</p>
        </div>
      </div>
    );
  }

  const handleLogout = () => {
    setIsAuthenticated(false);
    setPlayerName("");
    setIsPlaying(false);
    setGuesses([]);
    setGameOver(false);
    setCurrentGuess("");
    setMessage("");
    setKeyboardStatus({});
    setView("game");
    setHasAutoStarted(false);
    setScoresRefreshTrigger(0);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 p-3 md:p-4 max-w-screen overflow-hidden overscroll-x-none">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-6 pt-4">
          <div className="flex flex-col items-center gap-3 mb-4">
            <div>
              <AnimatedLogo />
            </div>
            <div className="text-purple-200 text-sm">
              {(() => {
                const d = new Date(new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()).split('/').reverse().join('-') + 'T00:00:00');
                const month = d.toLocaleString('en-US', { month: 'long' });
                return `${month} ${ordinal(d.getDate())}, ${d.getFullYear()}`;
              })()}
            </div>
          </div>
          <div className="mt-3">
            <p className="text-purple-200 text-sm">
              Playing as: <span className="font-semibold">{playerName}</span>
              <button
                onClick={handleLogout}
                className="ml-3 text-xs text-purple-300 hover:text-white underline"
              >
                Logout
              </button>
            </p>
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 md:p-6 shadow-2xl">
          {/* Tenant name + Calendar and Settings buttons */}
          <div className="flex items-center justify-between mb-2">
            {tenantName ? (
              <span className="text-white/80 font-semibold text-sm">{tenantName}</span>
            ) : <span />}
            <div className="flex gap-2">
            <button
              className="p-2 rounded-full bg-purple-700 text-white hover:bg-purple-800 transition flex items-center justify-center"
              style={{ minWidth: 40, minHeight: 40 }}
              aria-label="Message Calendar"
              onClick={() => setView(view === "calendar" ? "game" : "calendar")}
            >
              {/* Calendar icon */}
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
            </button>
            <button
              className="p-2 rounded-full bg-purple-700 text-white hover:bg-purple-800 transition flex items-center justify-center"
              style={{ minWidth: 40, minHeight: 40 }}
              aria-label="Settings"
              onClick={() => setView(view === "admin" ? "game" : "admin")}
            >
              {/* Sprocket/Gear icon */}
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 2.25c.414-1.036 1.836-1.036 2.25 0a1.125 1.125 0 001.664.592c.928-.57 2.057.36 1.488 1.288a1.125 1.125 0 00.592 1.664c1.036.414 1.036 1.836 0 2.25a1.125 1.125 0 00-.592 1.664c.57.928-.36 2.057-1.288 1.488a1.125 1.125 0 00-1.664.592c-.414 1.036-1.836 1.036-2.25 0a1.125 1.125 0 00-1.664-.592c-.928.57-2.057-.36-1.488-1.288a1.125 1.125 0 00-.592-1.664c-1.036-.414-1.036-1.836 0-2.25a1.125 1.125 0 00.592-1.664c-.57-.928.36-2.057 1.288-1.488a1.125 1.125 0 001.664-.592z" />
                <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" fill="none" />
              </svg>
            </button>
            </div>
          </div>

          {/* Message of the Day or Quote of the Day - display above tabs */}
          <div className="mb-4 p-3 bg-yellow-500/30 backdrop-blur-sm rounded-lg text-white text-center border border-yellow-400/50">
            {todayMessage ? (
              <span className="font-semibold">{todayMessage}</span>
            ) : (
              <>
                <div className="font-medium italic">"{getQuoteOfTheDay(getAustralianDate()).text}"</div>
                <div className="text-xs text-yellow-200 mt-1">— {getQuoteOfTheDay(getAustralianDate()).author}</div>
              </>
            )}
          </div>

          {/* Yesterday's Winners */}
          {yesterdayWinners && (
            <div className="mb-4 p-1.5 bg-purple-500/20 backdrop-blur-sm rounded-lg text-white text-center text-xs border border-purple-400/30">
              <div className="flex flex-wrap justify-center items-center gap-x-2">
                <span>🏆 {ordinal(parseInt(yesterdayWinners.date.split('-')[2]))}</span>
                {yesterdayWinners.dailyWinners && (
                  <span>
                    Daily: <span className="font-bold">{yesterdayWinners.dailyWinners.map(w => w.name).join(" & ")}</span>
                    <span className="text-purple-200"> [{yesterdayWinners.dailyWinners[0].attempts}]</span>
                  </span>
                )}
                {yesterdayWinners.golfWinners && (
                  <span>
                    Golf: <span className="font-bold">{yesterdayWinners.golfWinners.map(w => w.name).join(" & ")}</span>
                    <span className="text-purple-200"> [{yesterdayWinners.golfWinners[0].score >= 0 ? "+" : ""}{yesterdayWinners.golfWinners[0].score}]</span>
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-2 mb-6 justify-center flex-wrap">
            <TabButton
              label={
                <div className="flex flex-col items-center gap-0.5">
                  <div className="flex items-center gap-2">
                    <span>Daily</span>
                  </div>
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                    todayDifficulty === "Easy" ? "bg-green-600 text-white" :
                    todayDifficulty === "Hard" ? "bg-red-600 text-white" :
                    "bg-amber-500 text-white"
                  }`}>
                    {todayDifficulty}
                  </span>
                </div>
              }
              isActive={view === "game"}
              onClick={() => setView("game")}
            />
            <TabButton
              label="Golf"
              isActive={view === "golf"}
              onClick={() => setView("golf")}
            />
            <TabButton
              label="Results"
              isActive={view === "completed"}
              onClick={() => setView("completed")}
            />
            <TabButton
              label="Scores"
              isActive={view === "leaderboard"}
              onClick={() => setView("leaderboard")}
            />
          </div>

          {view === "game" && (
            <>
              {message && (
                <div className="mb-4 p-4 bg-white/20 backdrop-blur-sm rounded-lg text-white text-center font-semibold">
                  {message}
                </div>
              )}

              {isPlaying && (
                <>
                  <GameBoard
                    playerName={playerName}
                    isPlaying={isPlaying}
                    gameOver={gameOver}
                    guesses={guesses}
                    setGuesses={setGuesses}
                    currentGuess={currentGuess}
                    setCurrentGuess={setCurrentGuess}
                    todayWord={todayWord}
                    setMessage={setMessage}
                    keyboardStatus={keyboardStatus}
                    setKeyboardStatus={setKeyboardStatus}
                    onGameOver={handleGameOver}
                    isRevealing={isRevealing}
                    setIsRevealing={setIsRevealing}
                    revealRowIndex={revealRowIndex}
                    setRevealRowIndex={setRevealRowIndex}
                    shakeRowIndex={shakeRowIndex}
                    setShakeRowIndex={setShakeRowIndex}
                    winningRowIndex={winningRowIndex}
                    setWinningRowIndex={setWinningRowIndex}
                    showShareButton={true}
                    validationWords={validationWords}
                  />

                </>
              )}
            </>
          )}

          {view === "golf" && (
            <div>
              <div className="mb-6 text-center">
                <h2 className="text-3xl font-bold text-white mb-2">
                  🏌️ Golf Mode
                </h2>
                <p className="text-purple-200">
                  Play 9 holes and compete for the best score!
                </p>
              </div>
              {!wordListLoaded ? (
                <div className="text-center text-white text-xl py-8">
                  Loading word list...
                </div>
              ) : (
                <>
                  {message && (
                    <div className="mb-4 p-4 bg-white/20 backdrop-blur-sm rounded-lg text-white text-center font-semibold">
                      {message}
                    </div>
                  )}
                  <GolfGame
                    playerName={playerName}
                    setMessage={setMessage}
                    validationWords={validationWords}
                  />
                </>
              )}
            </div>
          )}

          {view === "completed" && (
            <CompletedGames
              todayDate={todayDate}
              gameOver={gameOver}
              currentPlayerName={playerName}
              refreshTrigger={scoresRefreshTrigger}
              allPlayers={allPlayers}
            />
          )}

          {view === "leaderboard" && (
            <div className="space-y-6">
              <Leaderboard scores={scores} />
              <GolfMatchScores refreshTrigger={scoresRefreshTrigger} />
              <GolfLeaderboard refreshTrigger={scoresRefreshTrigger} />
            </div>
          )}

          {view === "admin" && (
            <AdminPanel
              setMessage={setMessage}
              onDataChange={() => setScoresRefreshTrigger((prev) => prev + 1)}
              playerName={playerName}
            />
          )}

          {view === "calendar" && (
            <MessageCalendar
              playerName={playerName}
              onClose={() => {
                setView("game");
                // Refresh today's message in case it was updated
                const fetchTodayMessage = async () => {
                  try {
                    const today = getAustralianDate();
                    const result = await fetchJson(`${API_BASE}/motd?date=${today}`);
                    setTodayMessage(result.ok && result.message ? result.message : "");
                  } catch (err) {
                    console.error("Error fetching today's message:", err);
                  }
                };
                fetchTodayMessage();
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
