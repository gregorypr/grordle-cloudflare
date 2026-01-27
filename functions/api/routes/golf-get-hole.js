// Cloudflare Pages Function: golf-get-hole handler

export async function golfGetHoleHandler(c) {
  const sql = c.get("sql");

  try {
    const body = await c.req.json();
    const { roundId, holeNumber } = body;

    if (!roundId || !holeNumber) {
      return c.json({ error: "roundId and holeNumber required" }, 400);
    }

    console.log(`[golf-get-hole] Fetching hole ${holeNumber} for round ${roundId}`);

    const result = await sql(
      `SELECT
        hole_number,
        target_word,
        start_word,
        par,
        guesses,
        attempts,
        score
      FROM golf_holes
      WHERE round_id = $1 AND hole_number = $2`,
      [roundId, holeNumber]
    );

    if (result.length === 0) {
      return c.json({
        ok: false,
        error: "Hole not found"
      }, 404);
    }

    const hole = result[0];

    // Parse guesses if stored as JSON string
    let guesses = [];
    if (hole.guesses) {
      if (Array.isArray(hole.guesses)) {
        guesses = hole.guesses;
      } else if (typeof hole.guesses === 'string') {
        try {
          guesses = JSON.parse(hole.guesses);
        } catch (e) {
          console.error("[golf-get-hole] Error parsing guesses:", e);
          guesses = [];
        }
      }
    }

    const success = guesses.length > 0 && guesses[guesses.length - 1] === hole.target_word;

    return c.json({
      ok: true,
      holeData: {
        holeNumber: hole.hole_number,
        targetWord: hole.target_word,
        startWord: hole.start_word,
        par: hole.par,
        guesses: guesses,
        attempts: hole.attempts,
        score: hole.score,
        success: success,
        isCompleted: hole.attempts !== null && hole.attempts > 0
      }
    });
  } catch (err) {
    console.error("golf-get-hole function error", err);
    return c.json({
      error: "Server error in golf-get-hole",
      details: err.message
    }, 500);
  }
}
