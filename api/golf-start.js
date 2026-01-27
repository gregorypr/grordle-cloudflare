// api/golf-start.js
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
  
  const dateStr = `${year}-${month}-${day}`;
  console.log('[golf-start] getAustralianDate():', dateStr);
  return dateStr;
}

async function ensureTables() {
  // Create golf_rounds table (one per player per session)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS golf_rounds (
      id SERIAL PRIMARY KEY,
      player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      started_at TIMESTAMP DEFAULT NOW(),
      completed_at TIMESTAMP,
      total_score INTEGER,
      current_hole INTEGER DEFAULT 1,
      is_completed BOOLEAN DEFAULT FALSE
    );
  `);

  // Create golf_holes table (9 holes per round)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS golf_holes (
      id SERIAL PRIMARY KEY,
      round_id INTEGER NOT NULL REFERENCES golf_rounds(id) ON DELETE CASCADE,
      hole_number INTEGER NOT NULL CHECK (hole_number >= 1 AND hole_number <= 9),
      target_word TEXT NOT NULL,
      start_word TEXT NOT NULL,
      par INTEGER NOT NULL,
      guesses JSONB DEFAULT '[]',
      attempts INTEGER,
      score INTEGER,
      completed_at TIMESTAMP,
      UNIQUE(round_id, hole_number)
    );
  `);

  // Create indexes
  try {
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_golf_rounds_player ON golf_rounds(player_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_golf_holes_round ON golf_holes(round_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_golf_rounds_completed_at ON golf_rounds(completed_at) WHERE is_completed = TRUE;`);
  } catch (e) {
    // Indexes already exist
  }

  // Add guesses column if it doesn't exist
  try {
    await pool.query(`ALTER TABLE golf_holes ADD COLUMN IF NOT EXISTS guesses JSONB DEFAULT '[]';`);
  } catch (e) {
    // Column already exists or error
  }
}

export default async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!connectionString) {
      throw new Error("DATABASE_URL not set");
    }

    await ensureTables();

    const { playerName } = req.body;

    if (!playerName) {
      return res.status(400).json({ error: "playerName is required" });
    }

    console.log("[golf-start] Starting golf round for player:", playerName);

    // Get or create player
    let playerResult = await pool.query(
      `SELECT id FROM players WHERE LOWER(player_name) = LOWER($1);`,
      [playerName]
    );

    let playerId;
    if (playerResult.rowCount === 0) {
      const insertResult = await pool.query(
        `INSERT INTO players (player_name) VALUES ($1) RETURNING id;`,
        [playerName]
      );
      playerId = insertResult.rows[0].id;
    } else {
      playerId = playerResult.rows[0].id;
    }

    // Check if player has ANY round from today (completed or incomplete)
    // Check if player has ANY round from today (completed or incomplete)
    const today = getAustralianDate(); // YYYY-MM-DD format in Australian timezone
    console.log('[golf-start] Checking for rounds for player:', playerId, 'date:', today);
    
    // DEBUG: Check all rounds for this player
    const allRounds = await pool.query(
      `SELECT id, 
              started_at,
              (started_at AT TIME ZONE 'UTC' AT TIME ZONE 'Australia/Sydney')::date as started_date,
              current_hole, 
              is_completed 
       FROM golf_rounds 
       WHERE player_id = $1 
       ORDER BY started_at DESC LIMIT 5;`,
      [playerId]
    );
    console.log('[golf-start] All recent rounds for player:', JSON.stringify(allRounds.rows, null, 2));
    
    // Convert started_at to Australian timezone before comparing dates
    const todayRound = await pool.query(
      `SELECT id, current_hole, is_completed, 
              (started_at AT TIME ZONE 'UTC' AT TIME ZONE 'Australia/Sydney')::date as started_date
       FROM golf_rounds 
       WHERE player_id = $1 
       AND (started_at AT TIME ZONE 'UTC' AT TIME ZONE 'Australia/Sydney')::date = $2::date
       ORDER BY started_at DESC LIMIT 1;`,
      [playerId, today]
    );

    console.log('[golf-start] Rounds found for today:', todayRound.rowCount);
    if (todayRound.rowCount > 0) {
      console.log('[golf-start] Round details:', JSON.stringify(todayRound.rows[0], null, 2));
    }

    if (todayRound.rowCount > 0) {
      // Return existing round (completed or in progress)
      const roundId = todayRound.rows[0].id;
      let currentHole = todayRound.rows[0].current_hole;
      let isCompleted = todayRound.rows[0].is_completed;

      console.log('[golf-start] Found round:', roundId, 'hole:', currentHole, 'completed:', isCompleted);
      console.log('[golf-start] Found round:', roundId, 'hole:', currentHole, 'completed:', isCompleted);

      // Get all holes
      // Get all holes
      const completedHoles = await pool.query(
        `SELECT hole_number, target_word, start_word, par, attempts, score 
         FROM golf_holes 
         WHERE round_id = $1 
         ORDER BY hole_number;`,
        [roundId]
      );

      // BACKEND FIX: If all 9 holes have a non-null score, but round is not marked complete, auto-complete it
      const allHolesHaveScores = completedHoles.rows.length === 9 && completedHoles.rows.every(h => h.score !== null);
      if (!isCompleted && allHolesHaveScores) {
        // Calculate total score
        const totalScore = completedHoles.rows.reduce((sum, h) => sum + (h.score || 0), 0);
        await pool.query(
          `UPDATE golf_rounds SET is_completed = TRUE, completed_at = NOW(), total_score = $1 WHERE id = $2;`,
          [totalScore, roundId]
        );
        isCompleted = true;
        console.log('[golf-start] AUTO-FIXED round as completed!');
      }

      // If round is completed, return with roundCompleted flag
      if (isCompleted) {
        console.log('[golf-start] Round is completed, returning view-only data');
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

      // Get current hole if it exists (for in-progress rounds)
      const currentHoleData = await pool.query(
        `SELECT target_word, start_word, par, guesses, attempts 
         FROM golf_holes 
         WHERE round_id = $1 AND hole_number = $2;`,
        [roundId, currentHole]
      );

      console.log('[golf-start] Current hole query returned:', currentHoleData.rowCount, 'rows');
      if (currentHoleData.rowCount > 0) {
        console.log('[golf-start] Current hole data:', JSON.stringify(currentHoleData.rows[0], null, 2));
      }

      const response = {
        ok: true,
        roundId,
        currentHole,
        isNewRound: false,
        roundCompleted: false,
        roundCompleted: false,
        completedHoles: completedHoles.rows,
        currentHoleData: currentHoleData.rows[0] || null
      };
      
      console.log('[golf-start] Returning IN-PROGRESS response:', JSON.stringify(response, null, 2));
      return res.status(200).json(response);
    }

    // Create new round
    const newRound = await pool.query(
      `INSERT INTO golf_rounds (player_id, current_hole) 
       VALUES ($1, 1) 
       RETURNING id;`,
      [playerId]
    );

    const roundId = newRound.rows[0].id;
    console.log("[golf-start] Created new round:", roundId);

    // Check if today's daily course exists (use the today variable already defined)
    const existingCourse = await pool.query(`
      SELECT COUNT(*) as count FROM daily_golf_course WHERE course_date = $1
    `, [today]);

    if (parseInt(existingCourse.rows[0].count) === 0) {
      // Generate today's daily course
      console.log("[golf-start] Generating today's daily golf course:", today);
      // Par distribution: 2 par 5s, 2 par 3s, 5 par 4s
      const parDistribution = [5, 5, 3, 3, 4, 4, 4, 4, 4];
      // Shuffle the par distribution using Fisher-Yates algorithm
      for (let i = parDistribution.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [parDistribution[i], parDistribution[j]] = [parDistribution[j], parDistribution[i]];
      }
      console.log("[golf-start] Randomized par distribution:", parDistribution);
      // Track selected words to ensure uniqueness
      const selectedWords = new Set();
      for (let holeNum = 1; holeNum <= 9; holeNum++) {
        const parValue = parDistribution[holeNum - 1];
        let query = `SELECT word, par FROM wordlist WHERE par = $1`;
        const params = [parValue];
        if (selectedWords.size > 0) {
          // Exclude already selected words
          query += ` AND word NOT IN (${Array.from(selectedWords).map((_, i) => `$${i + 2}`).join(", ")})`;
          params.push(...Array.from(selectedWords));
        }
        query += ` ORDER BY RANDOM() LIMIT 1;`;
        const wordResult = await pool.query(query, params);
        if (wordResult.rowCount === 0) {
          throw new Error(`No unique words available with par ${parValue}`);
        }
        const targetWord = wordResult.rows[0].word;
        const par = wordResult.rows[0].par;
        selectedWords.add(targetWord);
        // Store in daily course (no start word - players start with empty guess)
        await pool.query(`
          INSERT INTO daily_golf_course (course_date, hole_number, target_word, start_word, par)
          VALUES ($1, $2, $3, $4, $5);
        `, [today, holeNum, targetWord, '', par]);
        console.log(`[golf-start] Daily course hole ${holeNum} - Par ${par}, Word: ${targetWord}`);
      }
    } else {
      console.log("[golf-start] Using existing daily course for:", today);
    }

    // Copy today's daily course to this player's round
    console.log("[golf-start] Copying daily course to player round...");
    
    const dailyCourse = await pool.query(`
      SELECT hole_number, target_word, start_word, par 
      FROM daily_golf_course 
      WHERE course_date = $1 
      ORDER BY hole_number
    `, [today]);

    for (const hole of dailyCourse.rows) {
      await pool.query(`
        INSERT INTO golf_holes (round_id, hole_number, target_word, start_word, par)
        VALUES ($1, $2, $3, $4, $5);
      `, [roundId, hole.hole_number, hole.target_word, hole.start_word, hole.par]);
      
      console.log(`[golf-start] Copied hole ${hole.hole_number} to round ${roundId}`);
    }

    console.log("[golf-start] All holes copied successfully");

    // Get first hole data
    const firstHole = await pool.query(
      `SELECT target_word, start_word, par 
       FROM golf_holes 
       WHERE round_id = $1 AND hole_number = 1;`,
      [roundId]
    );

    return res.status(200).json({
      ok: true,
      roundId,
      currentHole: 1,
      isNewRound: true,
      completedHoles: [],
      currentHoleData: firstHole.rows[0]
    });
  } catch (err) {
    console.error("golf-start function error", err);
    return res.status(500).json({
      error: "Server error in golf-start",
      details: err.message
    });
  }
};
