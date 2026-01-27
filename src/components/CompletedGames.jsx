// Emoji grid generator for Wordle-style sharing
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
function handleShare({ playerName, guesses, targetWord, attempts, todayDate }) {
  const grid = generateEmojiGrid(guesses, targetWord);
  const summary = `Grordle ${todayDate || ''} - ${playerName} ${guesses && guesses.includes(targetWord) ? attempts : 'X'}/6`;
  const shareText = `${summary}\n${grid}`;
  if (navigator && navigator.clipboard) {
    navigator.clipboard.writeText(shareText);
  }
  const waUrl =
    'https://wa.me/?text=' + encodeURIComponent(shareText);
  window.open(waUrl, '_blank');
}
import { useState, useEffect } from "react";
import { fetchJson } from "../utils/apiClient";
import { API_BASE } from "../constants/gameConstants";
import { getAustralianDate } from "../utils/dateUtils";
import { getGuessStatuses } from "../utils/wordUtils";

export default function CompletedGames({
  todayDate,
  gameOver,
  currentPlayerName,
  refreshTrigger = 0,
  allPlayers = [],
}) {
  const [completedGames, setCompletedGames] = useState([]);
  const [currentUserCompleted, setCurrentUserCompleted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showActual, setShowActual] = useState({}); // Track which games show actual text

  useEffect(() => {
    const loadCompletedGames = async () => {
      setIsLoading(true);
      try {
        const date = todayDate || getAustralianDate();
        const result = await fetchJson(
          `${API_BASE}/completed-games?date=${date}`
        );
        if (result.ok && result.games) {
          // Sort by attempts (best to worst)
          const sorted = result.games.sort((a, b) => {
            if (a.completed && !b.completed) return -1;
            if (!a.completed && b.completed) return 1;
            return a.attempts - b.attempts;
          });
          setCompletedGames(sorted);
          // Check if current user is in completed list
          if (currentPlayerName) {
            const userCompleted = sorted.some(
              (g) =>
                g.playerName &&
                g.playerName.toLowerCase() === currentPlayerName.toLowerCase()
            );
            setCurrentUserCompleted(userCompleted);
          } else {
            setCurrentUserCompleted(false);
          }
        }
      } catch (err) {
        console.error("Error loading completed games", err);
      } finally {
        setIsLoading(false);
      }
    };
    if (todayDate) {
      loadCompletedGames();
    }
  }, [todayDate, refreshTrigger, currentPlayerName]);

  const toggleView = (playerName) => {
    setShowActual((prev) => ({
      ...prev,
      [playerName]: !prev[playerName],
    }));
  };

  const renderGuessBox = (guess, targetWord, showLetters = false) => {
    if (!guess || !targetWord) return null;
    const statuses = getGuessStatuses(guess, targetWord);
    return (
      <div className="flex gap-1">
        {guess.split("").map((letter, idx) => {
          const status = statuses[idx];
          const bgColor =
            status === "correct"
              ? "bg-green-600"
              : status === "present"
              ? "bg-yellow-600"
              : "bg-gray-600";
          return (
            <div
              key={idx}
              className={`w-10 h-10 flex items-center justify-center ${bgColor} text-white font-bold text-lg rounded`}
            >
              {showLetters ? letter : ""}
            </div>
          );
        })}
      </div>
    );
  };

  // Debug: Log what is being rendered
  console.log("[CompletedGames] completedGames:", completedGames);

  // Find players who haven't played today
  const completedNames = completedGames.map((g) => g.playerName?.toLowerCase());
  const notPlayed = Array.isArray(allPlayers)
    ? allPlayers.filter((p) => !completedNames.includes(p.name?.toLowerCase()))
    : [];

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 md:p-8 shadow-2xl">
      <h2 className="text-3xl font-bold text-white mb-6 p-2 md:p-0">
        Today's Completed Games
      </h2>
      {isLoading ? (
        <div className="flex justify-center items-center py-8">
          <div className="w-10 h-10 border-4 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <>
          {completedGames.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-purple-200 text-lg">
                No completed games yet today
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {completedGames.map((game, idx) => {
                console.log("[CompletedGames] Rendering game:", game);
                const won =
                  game.completed &&
                  game.guesses &&
                  game.guesses.some((g) => g === game.targetWord);
                const medal =
                  idx === 0 && won
                    ? "🥇"
                    : idx === 1 && won
                    ? "🥈"
                    : idx === 2 && won
                    ? "🥉"
                    : null;

                return (
                  <div
                    key={`${game.playerName}-${idx}`}
                    className={`bg-white/10 rounded-lg p-6 ${
                      won
                        ? "border-2 border-green-500/50"
                        : "border-2 border-red-500/30"
                    }`}
                  >
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center gap-3">
                        {medal && <span className="text-3xl">{medal}</span>}
                        <h3 className="text-xl font-bold text-white">
                          {game.playerName}
                        </h3>
                        {/* Only show the eye icon if the CURRENT USER has completed the daily game, and this player has completed. Make it clickable to toggle text display. */}
                        {currentUserCompleted &&
                          game.completed &&
                          game.attempts != null && (
                            <button
                              title={
                                showActual[game.playerName]
                                  ? "Hide text"
                                  : "Show text"
                              }
                              className="ml-2 text-purple-200 focus:outline-none"
                              onClick={() => toggleView(game.playerName)}
                              style={{
                                background: "none",
                                border: "none",
                                padding: 0,
                                cursor: "pointer",
                              }}
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="inline w-5 h-5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                />
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                />
                              </svg>
                            </button>
                          )}
                      </div>
                      <div className="text-right">
                        <div
                          className={`text-2xl font-bold ${
                            won ? "text-green-400" : "text-red-400"
                          }`}
                        >
                          {won
                            ? `${game.attempts} ${
                                game.attempts === 1 ? "try" : "tries"
                              }`
                            : "Failed"}
                        </div>
                        {gameOver && game.targetWord && !won && (
                          <div className="text-purple-300 text-sm mt-1">
                            Word was:{" "}
                            <span className="font-bold">{game.targetWord}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Always show guesses for completed players */}
                    {game.completed &&
                      Array.isArray(game.guesses) &&
                      game.guesses.length > 0 && (
                        <div className="space-y-2 flex flex-col items-center justify-center">
                          <div className="flex items-center mb-2">
                            <p className="text-purple-200 text-sm font-semibold">
                              Guesses:
                            </p>
                            {/* Share button for WhatsApp */}
                            <button
                              className="ml-4 px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm font-bold"
                              title="Share to WhatsApp"
                              onClick={() => handleShare({
                                playerName: game.playerName,
                                guesses: game.guesses,
                                targetWord: game.targetWord,
                                attempts: game.attempts,
                                todayDate
                              })}
                            >
                              Share
                            </button>
                          </div>
                          {/* If toggle is available and active, show actual letters, else show Wordle format */}
                          {currentUserCompleted &&
                          showActual[game.playerName] ? (
                            <div className="space-y-2 w-fit">
                              {game.guesses.map((guess, guessIdx) => (
                                <div key={guessIdx}>
                                  {renderGuessBox(guess, game.targetWord, true)}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="space-y-2 w-fit">
                              {game.guesses.map((guess, guessIdx) => (
                                <div key={guessIdx}>
                                  {renderGuessBox(
                                    guess,
                                    game.targetWord,
                                    false
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                  </div>
                );
              })}
              {/* Add not-played players at the bottom */}
              {notPlayed.length > 0 &&
                notPlayed.map((player, idx) => (
                  <div
                    key={player.name || idx}
                    className="bg-white/10 rounded-lg p-6 border-2 border-gray-500/30 flex justify-between items-center mt-2"
                  >
                    <h3 className="text-xl font-bold text-purple-300">
                      {player.name}
                    </h3>
                    <div className="text-2xl font-bold text-purple-400 italic">
                      8 Points
                    </div>
                  </div>
                ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
