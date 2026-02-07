// Cloudflare Pages Function: golf-game-state handler

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

export async function golfGameStateHandler(c) {
  const sql = c.get("sql");
  const org_id = c.get("org_id");

  try {
    const body = await c.req.json();
    const { playerName } = body;

    if (!playerName) {
      return c.json({ error: "playerName is required" }, 400);
    }

    console.log('[golf-game-state] Initializing for player:', playerName);

    // Get or create player (tenant-scoped)
    let player = await sql(
      `SELECT id FROM players WHERE LOWER(player_name) = LOWER($1) AND COALESCE(org_id, 0) = COALESCE($2, 0);`,
      [playerName, org_id]
    );

    let playerId;
    if (player.length === 0) {
      const newPlayer = await sql(
        `INSERT INTO players (player_name, org_id) VALUES ($1, $2) RETURNING id;`,
        [playerName, org_id]
      );
      playerId = newPlayer[0].id;
    } else {
      playerId = player[0].id;
    }

    const today = getAustralianDate();

    // Check for existing round today (tenant-scoped)
    const todayRound = await sql(
      `SELECT id, current_hole, is_completed, total_score
       FROM golf_rounds
       WHERE player_id = $1
       AND (started_at AT TIME ZONE 'UTC' AT TIME ZONE 'Australia/Sydney')::date = $2::date
       AND COALESCE(org_id, 0) = COALESCE($3, 0);`,
      [playerId, today, org_id]
    );

    let roundId, currentHole, isCompleted;

    if (todayRound.length > 0) {
      roundId = todayRound[0].id;
      currentHole = todayRound[0].current_hole;
      isCompleted = todayRound[0].is_completed;

      // Get all holes
      const completedHoles = await sql(
        `SELECT hole_number, target_word, start_word, par, attempts, score
         FROM golf_holes
         WHERE round_id = $1
         ORDER BY hole_number;`,
        [roundId]
      );

      // Auto-complete if all 9 holes have scores
      const allHolesHaveScores = completedHoles.length === 9 && completedHoles.every(h => h.score !== null);
      if (!isCompleted && allHolesHaveScores) {
        const totalScore = completedHoles.reduce((sum, h) => sum + (h.score || 0), 0);
        await sql(
          `UPDATE golf_rounds SET is_completed = TRUE, completed_at = NOW(), total_score = $1 WHERE id = $2;`,
          [totalScore, roundId]
        );
        isCompleted = true;
      }

      if (isCompleted) {
        return c.json({
          ok: true,
          roundId,
          currentHole,
          isNewRound: false,
          roundCompleted: true,
          completedHoles: completedHoles,
          currentHoleData: null
        });
      }

      // Get current hole data
      const currentHoleData = await sql(
        `SELECT target_word, start_word, par, guesses, attempts
         FROM golf_holes
         WHERE round_id = $1 AND hole_number = $2;`,
        [roundId, currentHole]
      );

      if (currentHoleData.length === 0) {
        return c.json({ error: "Current hole data not found" }, 500);
      }

      const holeData = currentHoleData[0];

      return c.json({
        ok: true,
        roundId,
        currentHole,
        isNewRound: false,
        roundCompleted: false,
        completedHoles: completedHoles,
        currentHoleData: {
          targetWord: holeData.target_word,
          startWord: holeData.start_word,
          par: holeData.par,
          guesses: holeData.guesses || []
        }
      });
    }

    // New round - create it and pre-generate all 9 holes
    const newRound = await sql(
      `INSERT INTO golf_rounds (player_id, current_hole, is_completed, org_id)
       VALUES ($1, 1, FALSE, $2) RETURNING id;`,
      [playerId, org_id]
    );

    roundId = newRound[0].id;
    currentHole = 1;

    // Get all words with PAR values
    const allWords = await sql(`SELECT word, par FROM wordlist ORDER BY word;`);

    if (allWords.length === 0) {
      throw new Error("No words found in wordlist table");
    }

    // Pre-generate all 9 holes
    for (let holeNum = 1; holeNum <= 9; holeNum++) {
      const { targetWord, startWord, par } = getWordsForDateAndHole(today, holeNum, allWords);

      await sql(
        `INSERT INTO golf_holes (round_id, hole_number, target_word, start_word, par, guesses, attempts, score)
         VALUES ($1, $2, $3, $4, $5, $6, 0, NULL);`,
        [roundId, holeNum, targetWord, startWord, par, JSON.stringify([])]
      );
    }

    // Get hole 1 data
    const hole1 = await sql(
      `SELECT target_word, start_word, par, guesses
       FROM golf_holes
       WHERE round_id = $1 AND hole_number = 1;`,
      [roundId]
    );

    return c.json({
      ok: true,
      roundId,
      currentHole: 1,
      isNewRound: true,
      roundCompleted: false,
      completedHoles: [],
      currentHoleData: {
        targetWord: hole1[0].target_word,
        startWord: hole1[0].start_word,
        par: hole1[0].par,
        guesses: []
      }
    });

  } catch (err) {
    console.error("golf-game-state function error", err);
    return c.json({
      error: "Server error in golf-game-state",
      details: err.message
    }, 500);
  }
}
