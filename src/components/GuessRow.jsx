import { FLIP_DURATION, FLIP_STAGGER } from "../constants/gameConstants";
import { getGuessStatuses, getLetterColor } from "../utils/wordUtils";

export default function GuessRow({ 
  guess, 
  isCurrentRow, 
  currentGuess, 
  targetWord, 
  rowIndex,
  shakeRowIndex,
  revealRowIndex,
  winningRowIndex,
  gameOver 
}) {
  const displayGuess = isCurrentRow ? currentGuess : (guess || "");

  let statuses = Array(5).fill(null);
  if (guess) {
    statuses = getGuessStatuses(guess, targetWord);
  }

  const rowIsShaking = shakeRowIndex === rowIndex;
  const rowIsRevealing = revealRowIndex === rowIndex && !!guess;
  const rowIsWinning = winningRowIndex === rowIndex;

  return (
    <div
      className={
        "flex gap-2 justify-center " +
        (rowIsShaking ? "row-shake " : "") +
        (rowIsWinning ? " row-win " : "") +
        (isCurrentRow && !gameOver ? "cursor-text" : "")
      }
    >
      {[...Array(5)].map((_, j) => {
        const letter = displayGuess[j] || "";
        const status = statuses[j];

        let colorClass;
        let flipClass = "";
        const delayStyle = rowIsRevealing && letter
          ? { animationDelay: `${j * FLIP_STAGGER}ms` }
          : {};

        if (rowIsRevealing && letter) {
          // During reveal: neutral base colour, colour comes from animation mid-flip
          colorClass = "bg-white/10 border-white/30";
          if (status === "correct") flipClass = " tile-flip-correct";
          else if (status === "present") flipClass = " tile-flip-present";
          else flipClass = " tile-flip-absent";
        } else {
          // Not currently revealing: show static colours
          if (status) {
            colorClass = getLetterColor(status);
          } else {
            colorClass = letter
              ? "bg-white/40 border-white/50"
              : "bg-white/10 border-white/30";
          }
        }

        return (
          <div
            key={j}
            style={delayStyle}
            className={
              `w-14 h-14 ${colorClass} rounded-lg flex items-center justify-center ` +
              `text-2xl font-bold text-white border-2 transition-all` +
              flipClass
            }
          >
            {letter}
          </div>
        );
      })}
    </div>
  );
}
