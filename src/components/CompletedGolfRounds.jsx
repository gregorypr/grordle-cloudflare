import { useState, useEffect } from "react";
import { fetchJson } from "../utils/apiClient";
import { API_BASE } from "../constants/gameConstants";
import { getAustralianDate } from "../utils/dateUtils";
import { getGuessStatuses } from "../utils/wordUtils";

function formatScore(score) {
  if (score === null || score === undefined) return "-";
  if (score === 0) return "E";
  return score > 0 ? `+${score}` : `${score}`;
}

function holeScoreColor(score) {
  if (score === null || score === undefined) return "bg-gray-600";
  if (score < 0) return "bg-green-600";
  if (score === 0) return "bg-blue-600";
  return "bg-red-600";
}

function renderGuessRow(guess, targetWord, showLetters) {
  if (!guess || !targetWord) return null;
  const statuses = getGuessStatuses(guess, targetWord);
  return (
    <div className="flex gap-1">
      {guess.split("").map((letter, idx) => {
        const status = statuses[idx];
        const bg =
          status === "correct" ? "bg-green-600" :
          status === "present" ? "bg-yellow-600" :
          "bg-gray-600";
        return (
          <div key={idx} className={`w-9 h-9 flex items-center justify-center ${bg} text-white font-bold text-base rounded`}>
            {showLetters ? letter : ""}
          </div>
        );
      })}
    </div>
  );
}

const EyeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="inline w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

export default function CompletedGolfRounds({
  todayDate,
  currentPlayerName,
  refreshTrigger = 0,
}) {
  const [rounds, setRounds] = useState([]);
  const [allPlayers, setAllPlayers] = useState([]);
  const [currentUserCompleted, setCurrentUserCompleted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [expanded, setExpanded] = useState({});   // player → bool (show full hole detail)
  const [showWords, setShowWords] = useState({});  // player → bool (show letters)

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const date = todayDate || getAustralianDate();
        const result = await fetchJson(`${API_BASE}/completed-golf-rounds?date=${date}`);
        if (result.ok) {
          setRounds(result.rounds || []);
          setAllPlayers(result.allPlayers || []);
          if (currentPlayerName) {
            const done = (result.rounds || []).some(
              r => r.player_name?.toLowerCase() === currentPlayerName.toLowerCase()
            );
            setCurrentUserCompleted(done);
          }
        }
      } catch (err) {
        console.error("Error loading completed golf rounds", err);
      } finally {
        setIsLoading(false);
      }
    };
    if (todayDate) load();
  }, [todayDate, refreshTrigger, currentPlayerName]);

  const toggleExpand = (name) => {
    setExpanded(prev => {
      const next = { ...prev, [name]: !prev[name] };
      if (!next[name]) setShowWords(w => ({ ...w, [name]: false }));
      return next;
    });
  };

  const toggleWords = (name) => setShowWords(prev => ({ ...prev, [name]: !prev[name] }));

  const completedNames = rounds.map(r => r.player_name?.toLowerCase());
  const notPlayed = allPlayers.filter(p => !completedNames.includes(p.name?.toLowerCase()));

  return (
    <div id="golf-results" className="bg-white/10 backdrop-blur-md rounded-2xl p-3 md:p-8 shadow-2xl">
      <h2 className="text-3xl font-bold text-white mb-6 p-2 md:p-0">
        Today&apos;s Golf Results
      </h2>
      {isLoading ? (
        <div className="flex justify-center items-center py-8">
          <div className="w-10 h-10 border-4 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <>
          {rounds.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-purple-200 text-lg">No completed rounds yet today</p>
            </div>
          ) : (
            <div className="space-y-4">
              {rounds.map((round, idx) => {
                const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : null;
                const holes = Array.isArray(round.holes) ? round.holes : [];
                const isExpanded = !!expanded[round.player_name];
                const wordsShown = !!showWords[round.player_name];

                return (
                  <div key={round.round_id} className="bg-white/10 rounded-lg p-4 border-2 border-green-500/40">

                    {/* Header row */}
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center gap-2">
                        {medal && <span className="text-3xl">{medal}</span>}
                        <h3 className="text-xl font-bold text-white">{round.player_name}</h3>
                        {/* + expand button */}
                        <button
                          title={isExpanded ? "Hide detail" : "Show hole detail"}
                          onClick={() => toggleExpand(round.player_name)}
                          className="w-6 h-6 flex items-center justify-center rounded-full bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm focus:outline-none"
                        >
                          {isExpanded ? "−" : "+"}
                        </button>
                        {/* Eye icon — only when expanded and current user finished */}
                        {isExpanded && currentUserCompleted && (
                          <button
                            title={wordsShown ? "Hide words" : "Show words"}
                            className="text-purple-200 focus:outline-none"
                            onClick={() => toggleWords(round.player_name)}
                            style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
                          >
                            <EyeIcon />
                          </button>
                        )}
                      </div>
                      <div className={`text-2xl font-bold ${round.total_score < 0 ? "text-green-400" : round.total_score === 0 ? "text-blue-400" : "text-red-400"}`}>
                        {formatScore(round.total_score)}
                      </div>
                    </div>

                    {/* Always-visible hole score grid */}
                    <div className="flex flex-wrap gap-1.5">
                      {holes.map((hole) => (
                        <div key={hole.hole_number} className="flex flex-col items-center gap-0.5">
                          <span className="text-purple-300 text-xs">{hole.hole_number}</span>
                          <div
                            className={`w-8 h-8 flex items-center justify-center ${holeScoreColor(hole.score)} text-white font-bold text-sm rounded`}
                            title={`Hole ${hole.hole_number}: Par ${hole.par}, ${hole.attempts} shot${hole.attempts !== 1 ? "s" : ""}`}
                          >
                            {formatScore(hole.score)}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Expanded: full guess-by-guess detail per hole */}
                    {isExpanded && (
                      <div className="mt-4 space-y-4">
                        {holes.map((hole) => {
                          const guesses = Array.isArray(hole.guesses) ? hole.guesses : [];
                          return (
                            <div key={hole.hole_number} className="bg-white/10 rounded-lg p-3">
                              <div className="flex items-center gap-3 mb-2">
                                <span className="text-white font-bold text-sm">Hole {hole.hole_number}</span>
                                <span className="text-purple-300 text-xs">Par {hole.par}</span>
                                <span className={`text-sm font-bold ${holeScoreColor(hole.score).replace("bg-", "text-").replace("-600", "-400")}`}>
                                  {formatScore(hole.score)} ({hole.attempts} {hole.attempts === 1 ? "shot" : "shots"})
                                </span>
                              </div>
                              <div className="space-y-1 flex flex-col items-center">
                                {guesses.map((guess, gi) => (
                                  <div key={gi}>
                                    {renderGuessRow(guess, hole.target_word, wordsShown)}
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Not yet played */}
              {notPlayed.map((player, idx) => (
                <div
                  key={player.name || idx}
                  className="bg-white/10 rounded-lg p-4 border-2 border-gray-500/30 flex justify-between items-center"
                >
                  <h3 className="text-xl font-bold text-purple-300">{player.name}</h3>
                  <div className="text-lg font-bold text-purple-400 italic">Not yet played</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
