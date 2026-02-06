// Cloudflare Pages Function: start handler

// Generate start word from date using database wordlist
async function generateStartWord(sql, date) {
  // Get wordlist from database
  const words = await sql(`SELECT word FROM wordlist ORDER BY word`);
  if (words.length === 0) {
    throw new Error("Wordlist is empty");
  }

  const wordArray = words.map(w => w.word.toUpperCase());
  const dateStr = "START:" + date;
  let seed = 0;
  for (let i = 0; i < dateStr.length; i++) {
    seed = (seed * 31 + dateStr.charCodeAt(i)) >>> 0;
  }
  const wordIndex = seed % wordArray.length;
  return wordArray[wordIndex];
}

export async function startHandler(c) {
  const sql = c.get("sql");
  const org_id = c.get("org_id"); // Get tenant ID from middleware

  try {
    const body = await c.req.json();
    const { date, playerName } = body;

    console.log("start.js called with:", { date, playerName });

    if (!date || !playerName) {
      console.error("Missing required fields", { date, playerName });
      return c.json({ error: "Missing date or playerName" }, 400);
    }

    // Get or generate start word - check database first for consistency
    let startWord;
    const existingStartWord = await sql(
      `SELECT word FROM daily_start_words WHERE play_date = $1;`,
      [date]
    );

    if (existingStartWord.length > 0) {
      startWord = existingStartWord[0].word;
      console.log("Using stored start word from database:", startWord);
    } else {
      // Generate and store the start word for this date
      startWord = await generateStartWord(sql, date);
      console.log("Generated new start word:", startWord);

      // Store it in the database
      try {
        await sql(
          `INSERT INTO daily_start_words (play_date, word, member_name)
           VALUES ($1, $2, $3)
           ON CONFLICT (play_date) DO NOTHING;`,
          [date, startWord, "System"]
        );
      } catch (err) {
        console.log("Start word already stored by another request:", err.message);
      }
    }

    // Get or create game for this date and tenant
    let gameResult = await sql(
      `SELECT id FROM games WHERE play_date = $1 AND COALESCE(org_id, 0) = COALESCE($2, 0);`,
      [date, org_id]
    );

    let gameId;
    if (gameResult.length === 0) {
      gameResult = await sql(
        `INSERT INTO games (play_date, org_id) VALUES ($1, $2) RETURNING id;`,
        [date, org_id]
      );
      gameId = gameResult[0].id;
    } else {
      gameId = gameResult[0].id;
    }

    // Get or create player (case-insensitive lookup) in this tenant
    let existingPlayer = await sql(
      `SELECT id, player_name FROM players WHERE LOWER(player_name) = LOWER($1) AND COALESCE(org_id, 0) = COALESCE($2, 0);`,
      [playerName, org_id]
    );

    let playerId;
    if (existingPlayer.length > 0) {
      playerId = existingPlayer[0].id;
    } else {
      const playerResult = await sql(
        `INSERT INTO players (player_name, org_id) VALUES ($1, $2) RETURNING id;`,
        [playerName, org_id]
      );
      playerId = playerResult[0].id;
    }

    // Check if this player already started this game
    const existing = await sql(
      `SELECT id FROM daily_players
       WHERE game_id = $1 AND player_id = $2
       LIMIT 1;`,
      [gameId, playerId]
    );

    if (existing.length > 0) {
      // Player already started - check if they have a completed score
      const completedScore = await sql(
        `SELECT id FROM scores
         WHERE game_id = $1 AND player_id = $2 AND success = TRUE
         LIMIT 1;`,
        [gameId, playerId]
      );

      if (completedScore.length > 0) {
        // Player already completed - return all players for this game
        const playersRows = await sql(
          `SELECT p.player_name
           FROM daily_players dp
           JOIN players p ON dp.player_id = p.id
           WHERE dp.game_id = $1
           ORDER BY LOWER(p.player_name);`,
          [gameId]
        );

        // Check if player has existing game state
        const gameState = await sql(
          `SELECT pg.guesses, pg.completed, pg.target_word
           FROM player_games pg
           JOIN games g ON pg.game_id = g.id
           WHERE pg.game_id = $1 AND pg.player_id = $2 AND g.play_date = $3;`,
          [gameId, playerId, date]
        );

        const response = {
          allowed: false,
          dailyPlayers: playersRows.map((r) => r.player_name),
          startWord: startWord,
          startWordOwner: "System"
        };

        if (gameState.length > 0) {
          response.gameState = {
            guesses: gameState[0].guesses,
            completed: gameState[0].completed,
            targetWord: gameState[0].target_word
          };
        }

        return c.json(response);
      }
    }

    // Insert this player as having started today (if not already)
    if (existing.length === 0) {
      await sql(
        `INSERT INTO daily_players (game_id, player_id)
         VALUES ($1, $2);`,
        [gameId, playerId]
      );
    }

    // Return all players for this game
    const playersRows = await sql(
      `SELECT p.player_name
       FROM daily_players dp
       JOIN players p ON dp.player_id = p.id
       WHERE dp.game_id = $1
       ORDER BY LOWER(p.player_name);`,
      [gameId]
    );

    // Check if player has existing game state
    const gameState = await sql(
      `SELECT pg.guesses, pg.completed, pg.target_word
       FROM player_games pg
       JOIN games g ON pg.game_id = g.id
       WHERE pg.game_id = $1 AND pg.player_id = $2 AND g.play_date = $3;`,
      [gameId, playerId, date]
    );

    const response = {
      allowed: true,
      dailyPlayers: playersRows.map((r) => r.player_name),
      startWord: startWord,
      startWordOwner: "System"
    };

    if (gameState.length > 0) {
      response.gameState = {
        guesses: gameState[0].guesses,
        completed: gameState[0].completed,
        targetWord: gameState[0].target_word
      };
    }

    return c.json(response);
  } catch (err) {
    console.error("start function error", err);
    return c.json({
      error: "Server error in start",
      details: err.message,
      code: err.code
    }, 500);
  }
}
