import { useState, useEffect } from "react";
import { fetchJson } from "../utils/apiClient";
import { API_BASE } from "../constants/gameConstants";
import { formatDateDDMMMYY } from "../utils/dateUtils";

export default function GolfLeaderboard({ refreshTrigger = 0 }) {
  const [leaderboard, setLeaderboard] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState("all");
  const [weekInfo, setWeekInfo] = useState(null);

  useEffect(() => {
    loadLeaderboard();
  }, [period, refreshTrigger]);

  const loadLeaderboard = async () => {
    setIsLoading(true);
    setError("");
    try {
      const result = await fetchJson(`${API_BASE}/golf-leaderboard?period=${period}`);
      
      if (result.ok) {
        setLeaderboard(result.leaderboard || []);
        setWeekInfo(result.weekInfo || null);
      } else {
        setError("Failed to load leaderboard");
      }
    } catch (err) {
      console.error("Error loading golf leaderboard:", err);
      setError("Error loading leaderboard");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 md:p-6 shadow-2xl">
      <h2 className="text-3xl font-bold text-white mb-6 text-center">
        🏌️ Golf Leaderboard
        {period === "weekly" && weekInfo && (
          <span className="block text-lg text-purple-300 mt-1">Week {weekInfo.weekNumber}, {weekInfo.year}</span>
        )}
      </h2>
      
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin mb-4"></div>
          <div className="text-center text-white text-xl">Loading leaderboard...</div>
        </div>
      ) : error ? (
        <div className="text-center text-red-400 text-xl">{error}</div>
      ) : leaderboard.length === 0 ? (
        <div className="text-center text-white text-xl">No completed rounds yet. Be the first!</div>
      ) : (
        <>
          {/* Time period selector */}
          <div className="flex gap-2 mb-6 overflow-x-auto flex-wrap justify-center">
        {[
          { value: "daily", label: "Today" },
          { value: "weekly", label: "This Week" },
          { value: "monthly", label: "This Month" },
          { value: "yearly", label: "This Year" },
          { value: "all", label: "All Time" }
        ].map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setPeriod(value)}
            className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition ${
              period === value
                ? "bg-indigo-600 text-white"
                : "bg-white/20 text-white/70 hover:bg-white/30"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      
      <div className="space-y-4">
        {leaderboard.map((entry, index) => {
          const totalScore = entry.total_score;
          const scoreColor = totalScore < 0 ? "text-green-400" : totalScore === 0 ? "text-blue-400" : "text-red-400";
          const rankEmoji = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${index + 1}.`;
          
          return (
            <div key={entry.round_id} className="bg-white/10 rounded-xl p-4">
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{rankEmoji}</span>
                  <div>
                    <div className="text-white font-bold text-lg">{entry.player_name}</div>
                    <div className="text-purple-200 text-sm">
                      {formatDateDDMMMYY(entry.completed_at)}
                    </div>
                  </div>
                </div>
                <div className={`text-2xl font-bold ${scoreColor}`}>
                  {totalScore > 0 ? '+' : ''}{totalScore}
                </div>
              </div>

              {/* Show all 9 holes in table format */}
              <div className="overflow-x-auto">
                <table className="w-full text-white">
                  <thead>
                    <tr className="border-b border-white/20">
                      <th className="text-left py-2 px-3 text-sm font-semibold">Hole</th>
                      <th className="text-center py-2 px-3 text-sm font-semibold">Par</th>
                      <th className="text-center py-2 px-3 text-sm font-semibold">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entry.holes.map((hole) => {
                      const scoreText = hole.score === 0 ? "Ev" : 
                                       hole.score > 0 ? `+${hole.score}` : 
                                       `${hole.score}`;
                      const scoreColor = hole.score < 0 ? "text-green-400" : 
                                        hole.score === 0 ? "text-blue-400" : 
                                        "text-red-400";
                      
                      return (
                        <tr 
                          key={hole.hole} 
                          className="border-b border-white/10 hover:bg-white/5"
                          title={`${hole.word}: ${hole.attempts} shots`}
                        >
                          <td className="py-2 px-3 text-sm">{hole.hole}</td>
                          <td className="py-2 px-3 text-center text-sm">{hole.par}</td>
                          <td className={`py-2 px-3 text-center text-sm font-bold ${scoreColor}`}>
                            {scoreText}
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="border-t-2 border-white/30">
                      <td className="py-3 px-3 text-sm font-bold" colSpan="3">
                        Total: {entry.holes.reduce((sum, hole) => sum + hole.attempts, 0)} shots ({totalScore > 0 ? '+' : ''}{totalScore})
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={loadLeaderboard}
        className="w-full mt-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold transition"
      >
        🔄 Refresh
      </button>
        </>
      )}
    </div>
  );
}
