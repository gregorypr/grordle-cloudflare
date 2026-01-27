import { memo } from "react";
import { KEYBOARD_ROWS } from "../constants/gameConstants";

const Keyboard = memo(function Keyboard({ keyboardStatus = {}, onKeyPress, gameOver, isRevealing, currentGuessLength }) {
  return (
    <div className="space-y-2 mt-2 sticky bottom-0 bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 pb-3 pt-2 -mx-3 px-3">
      {KEYBOARD_ROWS.map((row, ri) => (
        <div key={ri} className="flex gap-1 justify-center">
          {ri === 2 && (
            <button
              onClick={() => onKeyPress("ENTER")}
              disabled={gameOver || currentGuessLength !== 5 || isRevealing}
              className="px-3 h-12 bg-[#d3d6da] hover:bg-[#bbbec1] disabled:bg-[#787c7e] disabled:opacity-50 text-black disabled:text-white text-xs font-bold rounded transition"
            >
              ENTER
            </button>
          )}
          {row.map(key => {
            const status = keyboardStatus[key];
            let bgColor = "bg-[#d3d6da] hover:bg-[#bbbec1]"; // Unused: light gray
            let textColor = "text-black";
            
            if (status === "correct") {
              bgColor = "bg-[#6aaa64] hover:bg-[#5a9a54]"; // Correct: green
              textColor = "text-white";
            } else if (status === "present") {
              bgColor = "bg-[#c9b458] hover:bg-[#b9a448]"; // Present: yellow
              textColor = "text-white";
            } else if (status === "absent") {
              bgColor = "bg-[#787c7e] hover:bg-[#686c6e]"; // Absent: dark gray
              textColor = "text-white";
            }

            return (
              <button
                key={key}
                onClick={() => onKeyPress(key)}
                disabled={gameOver || isRevealing}
                className={
                  `w-10 h-12 ${bgColor} ${textColor} disabled:opacity-50 font-bold rounded transition`
                }
              >
                {key}
              </button>
            );
          })}
          {ri === 2 && (
            <button
              onClick={() => onKeyPress("BACK")}
              disabled={gameOver || currentGuessLength === 0 || isRevealing}
              className="px-3 h-12 bg-[#d3d6da] hover:bg-[#bbbec1] disabled:bg-[#787c7e] disabled:opacity-50 text-black disabled:text-white text-xs font-bold rounded transition"
            >
              ←
            </button>
          )}
        </div>
      ))}
    </div>
  );
});

export default Keyboard;
