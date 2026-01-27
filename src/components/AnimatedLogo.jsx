export default function AnimatedLogo({ className = "" }) {
  // Simple Wordle-style logo with colored tiles spelling GRORDLE
  const tiles = [
    { letter: 'G', color: '#6aaa64' },  // Green
    { letter: 'R', color: '#c9b458' },  // Yellow
    { letter: 'O', color: '#6aaa64' },  // Green
    { letter: 'R', color: '#787c7e' },  // Gray
    { letter: 'D', color: '#6aaa64' },  // Green
    { letter: 'L', color: '#c9b458' },  // Yellow
    { letter: 'E', color: '#6aaa64' },  // Green
  ];

  return (
    <div className={`flex justify-center items-center ${className}`}>
      <div className="flex gap-1.5">
        {tiles.map((tile, index) => (
          <div
            key={index}
            className=" w-8 h-8 md:w-12 md:h-12 flex items-center justify-center text-white font-bold text-2xl border-2"
            style={{
              backgroundColor: tile.color,
              borderColor: tile.color,
            }}
          >
            {tile.letter}
          </div>
        ))}
      </div>
    </div>
  );
}
