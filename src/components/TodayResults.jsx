export default function TodayResults({ allPlayers }) {
  console.log('[TodayResults] Received allPlayers:', allPlayers);
  console.log('[TodayResults] allPlayers type:', typeof allPlayers);
  console.log('[TodayResults] allPlayers is array:', Array.isArray(allPlayers));
  console.log('[TodayResults] allPlayers length:', allPlayers?.length);
  
  // Ensure we have a valid array
  const playersArray = Array.isArray(allPlayers) ? allPlayers : [];
  
  // Sort: players with scores first (sorted by score), then not yet played (alphabetically)
  const sortedPlayers = [...playersArray].sort((a, b) => {
    if (a.score === null && b.score === null) return a.name.localeCompare(b.name);
    if (a.score === null) return 1;
    if (b.score === null) return -1;
    return a.score - b.score;
  });

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 md:p-8 shadow-2xl">
      <h2 className="text-3xl font-bold text-white mb-6 p-2 md:p-0">Today&apos;s Results</h2>
      {sortedPlayers.length > 0 ? (
        <div className="space-y-2 max-h-96 overflow-y-auto px-2">
          {sortedPlayers.map((player, i) => {
            const hasPlayed = player.score !== null;
            const rank = hasPlayed ? sortedPlayers.filter(p => p.score !== null).indexOf(player) + 1 : null;
            return (
              <div
                key={player.name}
                className={`backdrop-blur-sm rounded-lg p-3 md:p-4 flex justify-between items-center ${
                  hasPlayed ? 'bg-white/20' : 'bg-white/10'
                }`}
              >
                <div className="flex items-center gap-4">
                  {hasPlayed && (
                    <span className="text-xl md:text-2xl font-bold text-white w-8">
                      #{rank}
                    </span>
                  )}
                  <span className={`text-lg font-semibold ${
                    hasPlayed ? 'text-white' : 'text-purple-300'
                  }`}>
                    {player.name}
                  </span>
                  {/* Only show the eye icon if the user has completed the daily game */}
                  {hasPlayed && (
                    <span title="View results" className="ml-2 text-purple-200">
                      <svg xmlns="http://www.w3.org/2000/svg" className="inline w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </span>
                  )}
                </div>
                <span className={`text-lg md:text-xl font-bold ${
                  hasPlayed ? 'text-yellow-400' : 'text-purple-400 italic'
                }`}>
                  {hasPlayed 
                    ? `${player.score} ${player.score === 1 ? 'try' : 'tries'}`
                    : 'Not yet played - 8pts'
                  }
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-purple-200 text-center py-4">
          No players registered yet
        </p>
      )}
    </div>
  );
}
