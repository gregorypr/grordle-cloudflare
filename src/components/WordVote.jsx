import { useState, useEffect, useRef } from "react";
import { API_BASE } from "../constants/gameConstants";

export default function WordVote({ word, user, date, gameType, initialVote }) {
  const [vote, setVote] = useState(initialVote || null);
  const [submitting, setSubmitting] = useState(false);
  const hasUserVoted = useRef(false);

  // Only sync vote state with initialVote if user hasn't voted in this session
  useEffect(() => {
    if (!hasUserVoted.current && initialVote !== undefined) {
      setVote(initialVote);
    }
  }, [initialVote]);

  const handleVote = async (newVote) => {
    if (vote === newVote || submitting) return; // No change or already submitting
    setVote(newVote); // Optimistically update UI
    setSubmitting(true);
    hasUserVoted.current = true;
    try {
      await fetch(`${API_BASE}/word-votes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word, user, vote: newVote, date, gameType })
      });
      // Optionally check result.ok, but keep UI in sync regardless
    } finally {
      setSubmitting(false);
    }
  };

  const upColor = vote === 'up' ? '#16a34a' : '#9ca3af';
  const downColor = vote === 'down' ? '#ef4444' : '#9ca3af';
  const commonStyle = {
    fontSize: '2rem',
    opacity: submitting ? 0.5 : 1,
    cursor: submitting ? 'not-allowed' : 'pointer',
    transition: 'color 0.2s',
  };

  return (
    <div className="flex items-center gap-2 mt-4">
      <span className="font-bold text-lg text-purple-200">{word}</span>
      <span
        style={{
          ...commonStyle,
          color: `${upColor} !important`,
          display: 'inline-block',
          pointerEvents: submitting ? 'none' : 'auto',
        }}
        onClick={() => !submitting && handleVote('up')}
        title="Good word"
        role="button"
        aria-pressed={vote === 'up'}
        tabIndex={0}
      >
        👍
      </span>
      <span
        style={{
          ...commonStyle,
          color: `${downColor} !important`,
          display: 'inline-block',
          pointerEvents: submitting ? 'none' : 'auto',
        }}
        onClick={() => !submitting && handleVote('down')}
        title="Bad word"
        role="button"
        aria-pressed={vote === 'down'}
        tabIndex={0}
      >
        👎
      </span>
      {/* Debug: show current vote state */}
      <div style={{ fontSize: '0.9rem', color: '#888', marginLeft: 8 }}>
        [vote: {String(vote)}]
      </div>
    </div>
  );
}
