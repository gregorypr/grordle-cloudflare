import { useState, useEffect } from "react";
import { fetchJson } from "../utils/apiClient";
import { API_BASE } from "../constants/gameConstants";

export default function GolfMatchScores({ refreshTrigger = 0 }) {
  const [weeklyScores, setWeeklyScores] = useState([]);
  const [monthlyScores, setMonthlyScores] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [weeklyRoundCount, setWeeklyRoundCount] = useState(5);
  const [monthlyRoundCount, setMonthlyRoundCount] = useState(10);
  const [weekInfo, setWeekInfo] = useState(null);

  useEffect(() => {
    // Load settings from localStorage
    const savedWeekly = localStorage.getItem('gw_weekly_rounds');
    const savedMonthly = localStorage.getItem('gw_monthly_rounds');
    if (savedWeekly) setWeeklyRoundCount(parseInt(savedWeekly));
    if (savedMonthly) setMonthlyRoundCount(parseInt(savedMonthly));
    
    loadMatchScores();
  }, [refreshTrigger]);

  const loadMatchScores = async () => {
    setIsLoading(true);
    try {
      // Fetch weekly and monthly data
      const [weeklyResult, monthlyResult] = await Promise.all([
        fetchJson(`${API_BASE}/golf-leaderboard?period=weekly`),
        fetchJson(`${API_BASE}/golf-leaderboard?period=monthly`)
      ]);

      if (weeklyResult.ok && monthlyResult.ok) {
        // Store week info
        if (weeklyResult.weekInfo) {
          setWeekInfo(weeklyResult.weekInfo);
        }
        
        // Process weekly scores
        const weeklyRounds = parseInt(localStorage.getItem('gw_weekly_rounds') || '5');
        const weeklyProcessed = processMatchScores(weeklyResult.leaderboard, weeklyRounds);
        setWeeklyScores(weeklyProcessed);

        // Process monthly scores
        const monthlyRounds = parseInt(localStorage.getItem('gw_monthly_rounds') || '10');
        const monthlyProcessed = processMatchScores(monthlyResult.leaderboard, monthlyRounds);
        setMonthlyScores(monthlyProcessed);
      }
    } catch (err) {
      console.error("Error loading match scores:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const processMatchScores = (leaderboard, numRounds) => {
    // Group rounds by player
    const playerRounds = {};
    
    leaderboard.forEach(entry => {
      const playerName = entry.player_name;
      if (!playerRounds[playerName]) {
        playerRounds[playerName] = [];
      }
      playerRounds[playerName].push({
        roundId: entry.round_id,
        totalScore: entry.total_score,
        completedAt: entry.completed_at
      });
    });

    // Calculate match scores for each player
    const matchScores = Object.entries(playerRounds).map(([playerName, rounds]) => {
      // Sort rounds by total_score (lowest first)
      const sortedRounds = rounds.sort((a, b) => a.totalScore - b.totalScore);
      
      // Take best X rounds
      const bestRounds = sortedRounds.slice(0, numRounds);
      
      // Calculate average of best rounds
      const totalScore = bestRounds.reduce((sum, round) => sum + round.totalScore, 0);
      const averageScore = bestRounds.length > 0 ? totalScore / bestRounds.length : 0;
      
      return {
        playerName,
        bestRounds,
        roundsPlayed: bestRounds.length,
        totalScore,
        averageScore: Math.round(averageScore * 10) / 10, // Round to 1 decimal
        isQualified: bestRounds.length >= numRounds
      };
    });

    // Sort: qualified players first (by total score), then unqualified players (by total score)
    return matchScores.sort((a, b) => {
      // First, sort by qualification status (qualified first)
      if (a.isQualified && !b.isQualified) return -1;
      if (!a.isQualified && b.isQualified) return 1;
      
      // Within same qualification status, sort by total score (lowest first)
      return a.totalScore - b.totalScore;
    });
  };

  const renderMatchTable = (scores, requiredRounds, title) => {
    if (scores.length === 0) {
      return (
        <div className="bg-white/10 rounded-lg p-4">
          <p className="text-purple-200 text-center">No completed rounds yet</p>
        </div>
      );
    }

    return (
      <div className="bg-white/10 rounded-lg overflow-hidden">
        <table className="w-full text-white">
          <thead className="bg-white/10">
            <tr>
              <th className="text-left py-3 px-3 font-semibold w-16">Rank</th>
              <th className="text-left py-3 px-3 font-semibold">Player</th>
              <th className="text-center py-3 px-3 font-semibold w-20">Total</th>
            </tr>
          </thead>
          <tbody>
            {scores.map((player, index) => {
              const totalColor = player.totalScore < 0 ? "text-green-400" : 
                                player.totalScore === 0 ? "text-blue-400" : 
                                "text-red-400";
              const rankEmoji = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${index + 1}.`;
              const isQualified = player.roundsPlayed >= requiredRounds;
              
              // Format rounds display (e.g., "-2/-1/+3")
              const roundsDisplay = player.bestRounds
                .map(round => {
                  const score = round.totalScore;
                  return score > 0 ? `+${score}` : score === 0 ? 'E' : `${score}`;
                })
                .join(' / ');
              
              return (
                <tr 
                  key={player.playerName} 
                  className={`border-t border-white/10 hover:bg-white/5 ${!isQualified ? 'opacity-60' : ''}`}
                >
                  <td className="py-3 px-3 text-xl align-top">{rankEmoji}</td>
                  <td className="py-3 px-3">
                    <div className="font-semibold">{player.playerName}</div>
                    {roundsDisplay && (
                      <div className="text-xs text-purple-300 mt-1">{roundsDisplay}</div>
                    )}
                    {!isQualified && (
                      <div className="text-xs text-yellow-400 mt-1">
                        (needs {requiredRounds - player.roundsPlayed} more)
                      </div>
                    )}
                  </td>
                  <td className={`py-3 px-3 text-center font-bold align-top ${totalColor}`}>
                    {player.totalScore === 0 ? 'E' : player.totalScore > 0 ? `+${player.totalScore}` : player.totalScore}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 shadow-2xl">
        <h2 className="text-3xl font-bold text-white mb-6 text-center">🏆 Golf Match Scores</h2>
        <div className="flex justify-center py-8">
          <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 shadow-2xl">
      <h2 className="text-3xl font-bold text-white mb-6 text-center">🏆 Golf Match Scores</h2>
      <div className="text-center text-purple-200 mb-6">
        <p className="text-sm">Rankings based on average of best rounds</p>
      </div>
      
      {/* Weekly Match */}
      <div className="mb-6">
        <h3 className="text-xl font-bold text-white mb-3">
          📅 Weekly Match {weekInfo && <span className="text-purple-300">(Week {weekInfo.weekNumber}, {weekInfo.year})</span>}
          <span className="text-sm text-purple-200 font-normal ml-2">(Best {weeklyRoundCount} rounds)</span>
        </h3>
        {renderMatchTable(weeklyScores, weeklyRoundCount, "Weekly")}
      </div>
      
      {/* Monthly Match */}
      <div>
        <h3 className="text-xl font-bold text-white mb-3">
          📆 Monthly Match <span className="text-sm text-purple-200 font-normal">(Best {monthlyRoundCount} rounds)</span>
        </h3>
        {renderMatchTable(monthlyScores, monthlyRoundCount, "Monthly")}
      </div>

      <button
        onClick={loadMatchScores}
        className="w-full mt-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold transition"
      >
        🔄 Refresh
      </button>
    </div>
  );
}
