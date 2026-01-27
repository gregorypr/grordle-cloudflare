import { useState, useEffect } from "react";
import { fetchJson } from "../utils/apiClient";
import { API_BASE } from "../constants/gameConstants";

export const useMemberStartWords = () => {
  const [memberStartWords, setMemberStartWords] = useState({});
  const [isLoaded, setIsLoaded] = useState(false);

  // Load per-member start words (shared via API, fallback to localStorage/default)
  useEffect(() => {
    const loadMemberStartWords = async () => {
      // Try server first
      try {
        const data = await fetchJson(`${API_BASE}/config`);
        if (data && data.memberStartWords && typeof data.memberStartWords === "object") {
          setMemberStartWords(data.memberStartWords);
          localStorage.setItem(
            "gw_member_start_words_v1",
            JSON.stringify(data.memberStartWords)
          );
          setIsLoaded(true);
          return;
        }
      } catch (err) {
        console.error("Error loading member start words from API", err);
      }

      // Fallback: localStorage
      const stored = localStorage.getItem("gw_member_start_words_v1");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed && typeof parsed === "object") {
            setIsLoaded(true);
            setMemberStartWords(parsed);
            return;
          }
        } catch (_) {}
      }

      // Default: empty object if nothing set
      setMemberStartWords({});

      setIsLoaded(true);
    };

    loadMemberStartWords();
  }, []);

  // Persist member start words to both localStorage and server (debounced)
  useEffect(() => {
    if (!memberStartWords || typeof memberStartWords !== "object") return;

    localStorage.setItem("gw_member_start_words_v1", JSON.stringify(memberStartWords));

    // Debounce API call to avoid excessive requests
    const timer = setTimeout(() => {
      (async () => {
        try {
          await fetchJson(`${API_BASE}/config`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ memberStartWords })
          });
        } catch (err) {
          console.error("Error saving member start words to API", err);
        }
      })();
    }, 1000);

    return () => clearTimeout(timer);
  }, [memberStartWords]);

  return { memberStartWords, setMemberStartWords, isLoaded };
};
