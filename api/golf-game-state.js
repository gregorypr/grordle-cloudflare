// api/golf-game-state.js
// Combined endpoint for golf game initialization - returns round + current hole in one call
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

// Helper to get Australian date (AEST/AEDT)
function getAustralianDate() {
  const formatter = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Sydney',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  const parts = formatter.formatToParts(new Date());
  const year = parts.find(p => p.type === 'year').value;
  const month = parts.find(p => p.type === 'month').value;
  const day = parts.find(p => p.type === 'day').value;
  
  return `${year}-${month}-${day}`;
}

// Seeded random number generator
function seededRandom(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function getWordsForDateAndHole(dateStr, holeNumber, wordList) {
  const dateParts = dateStr.split("-");
  const year = parseInt(dateParts[0]);
  const month = parseInt(dateParts[1]);
  const day = parseInt(dateParts[2]);
  
  const baseSeed = year * 10000 + month * 100 + day;
  const holeSeed = baseSeed * 10 + holeNumber;
  
  const targetIndex = Math.floor(seededRandom(holeSeed) * wordList.length);
  const startSeed = holeSeed * 13;
  const startIndex = Math.floor(seededRandom(startSeed) * wordList.length);
  
  return {
    targetWord: wordList[targetIndex].word.toUpperCase(),
    startWord: wordList[startIndex].word.toUpperCase(),
    par: wordList[targetIndex].par
  };
}

export default async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!connectionString) {
      throw new Error("DATABASE_URL not set");
    }

    const { playerName } = req.body;

    if (!playerName) {
      return res.status(400).json({ error: "playerName is required" });
    }

    console.log('[golf-game-state] Initializing for player:', playerName);

    // Get or create player
    let player = await pool.query(
      `SELECT id FROM players WHERE player_name = $1;`,
      [playerName]
    );

    if (player.rowCount === 0) {
      player = await pool.query(
        `INSERT INTO players (player_name) VALUES ($1) RETURNING id;`,
        [playerName]
      );
    }

    const playerId = player.rows[0].id;
    const today = getAustralianDate();

    // Check for existing round today
    const todayRound = await pool.query(
      `SELECT id, current_hole, is_completed, total_score 
       FROM golf_rounds 
       WHERE player_id = $1 AND (started_at AT TIME ZONE 'UTC' AT TIME ZONE 'Australia/Sydney')::date = $2::date;`,
      [playerId, today]
    );

    let roundId, currentHole, isCompleted, isNewRound;

    if (todayRound.rowCount > 0) {
      // Existing round
      roundId = todayRound.rows[0].id;
      currentHole = todayRound.rows[0].current_hole;
      isCompleted = todayRound.rows[0].is_completed;
      isNewRound = false;

      console.log('[golf-game-state] Found round:', roundId, 'hole:', currentHole, 'completed:', isCompleted);

      // Get all holes
      const completedHoles = await pool.query(
        `SELECT hole_number, target_word, start_word, par, attempts, score 
         FROM golf_holes 
         WHERE round_id = $1 
         ORDER BY hole_number;`,
        [roundId]
      );

      // Auto-complete if all 9 holes have scores
      const allHolesHaveScores = completedHoles.rows.length === 9 && completedHoles.rows.every(h => h.score !== null);
      if (!isCompleted && allHolesHaveScores) {
        const totalScore = completedHoles.rows.reduce((sum, h) => sum + (h.score || 0), 0);
        await pool.query(
          `UPDATE golf_rounds SET is_completed = TRUE, completed_at = NOW(), total_score = $1 WHERE id = $2;`,
          [totalScore, roundId]
        );
        isCompleted = true;
        console.log('[golf-game-state] AUTO-FIXED round as completed!');
      }

      // If round is completed, return with roundCompleted flag
      if (isCompleted) {
        console.log('[golf-game-state] Round completed, returning summary');
        return res.status(200).json({
          ok: true,
          roundId,
          currentHole,
          isNewRound: false,
          roundCompleted: true,
          completedHoles: completedHoles.rows,
          currentHoleData: null
        });
      }

      // Get current hole data (including guesses for resume)
      const currentHoleData = await pool.query(
        `SELECT target_word, start_word, par, guesses, attempts 
         FROM golf_holes 
         WHERE round_id = $1 AND hole_number = $2;`,
        [roundId, currentHole]
      );

      if (currentHoleData.rowCount === 0) {
        console.error('[golf-game-state] Current hole data not found');
        return res.status(500).json({ error: "Current hole data not found" });
      }

      const holeData = currentHoleData.rows[0];
      
      return res.status(200).json({
        ok: true,
        roundId,
        currentHole,
        isNewRound: false,
        roundCompleted: false,
        completedHoles: completedHoles.rows,
        currentHoleData: {
          targetWord: holeData.target_word,
          startWord: holeData.start_word,
          par: holeData.par,
          guesses: holeData.guesses || []
        }
      });
    }

    // New round - create it and pre-generate all 9 holes
    console.log('[golf-game-state] Creating new round for player:', playerId);
    
    const newRound = await pool.query(
      `INSERT INTO golf_rounds (player_id, current_hole, is_completed) 
       VALUES ($1, 1, FALSE) RETURNING id;`,
      [playerId]
    );

    roundId = newRound.rows[0].id;
    currentHole = 1;
    isNewRound = true;

    // Get all words with PAR values for word selection
    const allWords = await pool.query(
      `SELECT word, par FROM wordlist ORDER BY word;`
    );

    if (allWords.rowCount === 0) {
      throw new Error("No words found in wordlist table");
    }

    const wordList = allWords.rows;

    // Pre-generate all 9 holes
    for (let holeNum = 1; holeNum <= 9; holeNum++) {
      const { targetWord, startWord, par } = getWordsForDateAndHole(today, holeNum, wordList);
      
      await pool.query(
        `INSERT INTO golf_holes (round_id, hole_number, target_word, start_word, par, guesses, attempts, score)
         VALUES ($1, $2, $3, $4, $5, $6, 0, NULL);`,
        [roundId, holeNum, targetWord, startWord, par, JSON.stringify([])]
      );
    }

    console.log('[golf-game-state] Pre-generated all 9 holes');

    // Get hole 1 data
    const hole1 = await pool.query(
      `SELECT target_word, start_word, par, guesses 
       FROM golf_holes 
       WHERE round_id = $1 AND hole_number = 1;`,
      [roundId]
    );

    return res.status(200).json({
      ok: true,
      roundId,
      currentHole: 1,
      isNewRound: true,
      roundCompleted: false,
      completedHoles: [],
      currentHoleData: {
        targetWord: hole1.rows[0].target_word,
        startWord: hole1.rows[0].start_word,
        par: hole1.rows[0].par,
        guesses: []
      }
    });

  } catch (err) {
    console.error("golf-game-state function error", err);
    return res.status(500).json({
      error: "Server error in golf-game-state",
      details: err.message
    });
  }
};
