import { useEffect, useState } from "react";
import WordVote from "./WordVote";
import { API_BASE } from "../constants/gameConstants";

export default function WordVoteWithInitialVote(props) {
  const { word, user, date, gameType } = props;
  const [initialVote, setInitialVote] = useState(undefined);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let isMounted = true;
    async function fetchVote() {
      try {
        const res = await fetch(`${API_BASE}/word-votes?word=${encodeURIComponent(word)}&user=${encodeURIComponent(user)}&date=${encodeURIComponent(date)}&gameType=${encodeURIComponent(gameType)}`);
        const data = await res.json();
        if (isMounted) setInitialVote(data && data.vote ? data.vote : undefined);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    fetchVote();
    return () => { isMounted = false; };
  }, [word, user, date, gameType]);
  if (loading) return null;
  return <WordVote {...props} initialVote={initialVote} />;
}