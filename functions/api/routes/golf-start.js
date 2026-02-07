// Cloudflare Pages Function: golf-start handler

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

export async function golfStartHandler(c) {
  const sql = c.get("sql");
  const org_id = c.get("org_id");

  try {
    const body = await c.req.json();
    const { playerName } = body;

    if (!playerName) {
      return c.json({ error: "playerName is required" }, 400);
    }

    console.log("[golf-start] Starting golf round for player:", playerName);

    // Get or create player (tenant-scoped)
    let playerResult = await sql(
      `SELECT id FROM players WHERE LOWER(player_name) = LOWER($1) AND COALESCE(org_id, 0) = COALESCE($2, 0);`,
      [playerName, org_id]
    );

    let playerId;
    if (playerResult.length === 0) {
      const insertResult = await sql(
        `INSERT INTO players (player_name, org_id) VALUES ($1, $2) RETURNING id;`,
        [playerName, org_id]
      );
      playerId = insertResult[0].id;
    } else {
      playerId = playerResult[0].id;
    }

    // Check if player has ANY round from today (tenant-scoped)
    const today = getAustralianDate();
    console.log('[golf-start] Checking for rounds for player:', playerId, 'date:', today);

    const todayRound = await sql(
      `SELECT id, current_hole, is_completed,
              (started_at AT TIME ZONE 'UTC' AT TIME ZONE 'Australia/Sydney')::date as started_date
       FROM golf_rounds
       WHERE player_id = $1
       AND (started_at AT TIME ZONE 'UTC' AT TIME ZONE 'Australia/Sydney')::date = $2::date
       AND COALESCE(org_id, 0) = COALESCE($3, 0)
       ORDER BY started_at DESC LIMIT 1;`,
      [playerId, today, org_id]
    );

    if (todayRound.length > 0) {
      // Return existing round
      const roundId = todayRound[0].id;
      let currentHole = todayRound[0].current_hole;
      let isCompleted = todayRound[0].is_completed;

      // Get all holes
      const completedHoles = await sql(
        `SELECT hole_number, target_word, start_word, par, attempts, score
         FROM golf_holes
         WHERE round_id = $1
         ORDER BY hole_number;`,
        [roundId]
      );

      // Auto-fix: If all 9 holes have scores but round not marked complete
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

      // Get current hole for in-progress rounds
      const currentHoleData = await sql(
        `SELECT target_word, start_word, par, guesses, attempts
         FROM golf_holes
         WHERE round_id = $1 AND hole_number = $2;`,
        [roundId, currentHole]
      );

      return c.json({
        ok: true,
        roundId,
        currentHole,
        isNewRound: false,
        roundCompleted: false,
        completedHoles: completedHoles,
        currentHoleData: currentHoleData[0] || null
      });
    }

    // Create new round
    const newRound = await sql(
      `INSERT INTO golf_rounds (player_id, current_hole, org_id)
       VALUES ($1, 1, $2)
       RETURNING id;`,
      [playerId, org_id]
    );

    const roundId = newRound[0].id;
    console.log("[golf-start] Created new round:", roundId);

    // Check if today's daily course exists
    const existingCourse = await sql(`
      SELECT COUNT(*) as count FROM daily_golf_course WHERE course_date = $1
    `, [today]);

    if (parseInt(existingCourse[0].count) === 0) {
      // Generate today's daily course
      console.log("[golf-start] Generating today's daily golf course:", today);
      const parDistribution = [5, 5, 3, 3, 4, 4, 4, 4, 4];

      // Shuffle using Fisher-Yates
      for (let i = parDistribution.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [parDistribution[i], parDistribution[j]] = [parDistribution[j], parDistribution[i]];
      }

      const selectedWords = new Set();
      for (let holeNum = 1; holeNum <= 9; holeNum++) {
        const parValue = parDistribution[holeNum - 1];
        let query = `SELECT word, par FROM wordlist WHERE par = $1`;
        const params = [parValue];

        if (selectedWords.size > 0) {
          const excludeParams = Array.from(selectedWords).map((_, i) => `$${i + 2}`).join(", ");
          query += ` AND word NOT IN (${excludeParams})`;
          params.push(...Array.from(selectedWords));
        }
        query += ` ORDER BY RANDOM() LIMIT 1;`;

        const wordResult = await sql(query, params);
        if (wordResult.length === 0) {
          throw new Error(`No unique words available with par ${parValue}`);
        }

        const targetWord = wordResult[0].word;
        const par = wordResult[0].par;
        selectedWords.add(targetWord);

        await sql(`
          INSERT INTO daily_golf_course (course_date, hole_number, target_word, start_word, par)
          VALUES ($1, $2, $3, $4, $5);
        `, [today, holeNum, targetWord, '', par]);
      }
    }

    // Copy today's daily course to this player's round
    const dailyCourse = await sql(`
      SELECT hole_number, target_word, start_word, par
      FROM daily_golf_course
      WHERE course_date = $1
      ORDER BY hole_number
    `, [today]);

    for (const hole of dailyCourse) {
      await sql(`
        INSERT INTO golf_holes (round_id, hole_number, target_word, start_word, par)
        VALUES ($1, $2, $3, $4, $5);
      `, [roundId, hole.hole_number, hole.target_word, hole.start_word, hole.par]);
    }

    // Get first hole data
    const firstHole = await sql(
      `SELECT target_word, start_word, par
       FROM golf_holes
       WHERE round_id = $1 AND hole_number = 1;`,
      [roundId]
    );

    return c.json({
      ok: true,
      roundId,
      currentHole: 1,
      isNewRound: true,
      completedHoles: [],
      currentHoleData: firstHole[0]
    });
  } catch (err) {
    console.error("golf-start function error", err);
    return c.json({
      error: "Server error in golf-start",
      details: err.message
    }, 500);
  }
}
