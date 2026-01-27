import { useState, useEffect } from "react";
import { fetchJson } from "../utils/apiClient";
import { API_BASE } from "../constants/gameConstants";

export const useScores = (todayDate, wordListLoaded, allowedWords, refreshTrigger = 0) => {
  const [scores, setScores] = useState({});
  const [dailyScores, setDailyScores] = useState({});
  const [dailyPlayers, setDailyPlayers] = useState([]);
  const [allPlayers, setAllPlayers] = useState([]);

  // Note: Initial data now loaded by App.jsx via /api/game-state for better performance
  // This effect only triggers on refreshTrigger changes (after submitting scores)
  useEffect(() => {
    if (!wordListLoaded || !todayDate || refreshTrigger === 0) return;

    (async () => {
      try {
        const data = await fetchJson(
          `${API_BASE}/status?date=${encodeURIComponent(todayDate)}`
        );
        setDailyPlayers(data.dailyPlayers || []);
        setDailyScores(data.dailyScores || {});
        setScores(data.allScores || {});
        setAllPlayers(data.allPlayers || []);
      } catch (err) {
        console.error("Error loading scores from API", err);
        console.error("Error details:", err.message);
        if (err.response) {
          console.error("Response data:", err.response);
        }
        setDailyPlayers([]);
        setDailyScores({});
        setScores({});
        setAllPlayers([]);
      }
    })();
  }, [wordListLoaded, todayDate, refreshTrigger]);

  const recordScore = async (playerName, todayDate, attempts, success) => {
    if (!playerName || !todayDate) return;

    console.log('recordScore called:', { playerName, todayDate, attempts, success });

    // Optimistic local update so UI feels instant
    setDailyScores(prevDaily => {
      const existing = prevDaily[playerName];
      const best = existing ? Math.min(existing, attempts) : attempts;
      return { ...prevDaily, [playerName]: best };
    });

    setScores(prevScores => {
      const total = (prevScores[playerName] || 0) + attempts;
      return { ...prevScores, [playerName]: total };
    });

    // Save to DB then refresh from server
    try {
      console.log('Submitting score to API...');
      const submitResult = await fetchJson(`${API_BASE}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: todayDate,
          playerName,
          attempts,
          success
        })
      });
      console.log('Submit result:', submitResult);

      const data = await fetchJson(
        `${API_BASE}/status?date=${encodeURIComponent(todayDate)}`
      );
      setDailyPlayers(data.dailyPlayers || []);
      setDailyScores(data.dailyScores || {});
      setScores(data.allScores || {});
      setAllPlayers(data.allPlayers || []);
    } catch (err) {
      console.error("Error saving score", err);
    }
  };

  return { 
    scores, 
    dailyScores, 
    dailyPlayers, 
    allPlayers, 
    setDailyPlayers, 
    setDailyScores,
    setScores,
    setAllPlayers,
    recordScore 
  };
};
