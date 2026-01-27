import { useState, useEffect } from "react";
import { fetchJson } from "../utils/apiClient";
import { API_BASE } from "../constants/gameConstants";

export default function Leaderboard({ scores }) {
  const [period, setPeriod] = useState('week');
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [weekInfo, setWeekInfo] = useState(null);

  useEffect(() => {
    loadLeaderboard();
  }, [period]);

  const loadLeaderboard = async () => {
    setIsLoading(true);
    try {
      const data = await fetchJson(`${API_BASE}/leaderboard?period=${period}`);
      if (data.ok) {
        setLeaderboardData(data.leaderboard);
        setWeekInfo(data.weekInfo || null);
      }
    } catch (err) {
      console.error("Error loading leaderboard", err);
      // Fallback to weekly scores from props
      const fallback = Object.entries(scores)
        .map(([name, score]) => ({ name, score, gamesPlayed: null }))
        .sort((a, b) => a.score - b.score);
      setLeaderboardData(fallback);
    } finally {
      setIsLoading(false);
    }
  };

  const periodLabels = {
    today: 'Today',
    week: 'This Week',
    month: 'This Month',
    year: 'This Year'
  };

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 md:p-8 shadow-2xl">
      <h2 className="text-3xl font-bold text-white mb-6 p-2 md:p-0">
        Leaderboard
        {period === 'week' && weekInfo && (
          <span className="block text-lg text-purple-300 mt-1">Week {weekInfo.weekNumber}, {weekInfo.year}</span>
        )}
      </h2>
      
      {/* Period selector */}
      <div className="flex gap-2 mb-6 flex-wrap justify-center">
        {Object.entries(periodLabels).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setPeriod(key)}
            className={`px-4 py-2 rounded-lg font-semibold transition ${
              period === key
                ? 'bg-purple-600 text-white'
                : 'bg-white/10 text-purple-200 hover:bg-white/20'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-8">
          <div className="w-10 h-10 border-4 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : leaderboardData.length > 0 ? (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {leaderboardData.map((player, i) => (
            <div
              key={player.name}
              className={
                `rounded-lg p-4 flex justify-between items-center ` +
                (i === 0
                  ? 'bg-gradient-to-r from-yellow-500/30 to-yellow-600/30 border-2 border-yellow-400'
                  : 'bg-white/10')
              }
            >
              <div className="flex items-center gap-4">
                <span
                  className={
                    `text-2xl font-bold w-8 ` +
                    (i === 0 ? 'text-yellow-400' : 'text-white')
                  }
                >
                  #{i + 1}
                </span>
                <div>
                  <span className="text-lg font-semibold text-white block">
                    {player.name}
                  </span>
                  {player.gamesPlayed && (
                    <span className="text-xs text-purple-300">
                      {player.gamesPlayed} {player.gamesPlayed === 1 ? 'game' : 'games'}
                    </span>
                  )}
                </div>
              </div>
              <span
                className={
                  `text-xl font-bold ` +
                  (i === 0 ? 'text-yellow-400' : 'text-purple-200')
                }
              >
                {player.score} pts
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-purple-200 text-center py-4">
          No scores recorded yet
        </p>
      )}
    </div>
  );
}
