// Cloudflare Pages Function: golf-submit handler

export async function golfSubmitHandler(c) {
  const sql = c.get("sql");

  try {
    const body = await c.req.json();
    const { roundId, holeNumber, attempts, success } = body;

    if (!roundId || !holeNumber || attempts === undefined || success === undefined) {
      return c.json({ error: "roundId, holeNumber, attempts, and success are required" }, 400);
    }

    console.log("[golf-submit] Submitting hole", holeNumber, "- Attempts:", attempts, "Success:", success);

    // Get hole data
    const holeResult = await sql(
      `SELECT par, target_word FROM golf_holes
       WHERE round_id = $1 AND hole_number = $2;`,
      [roundId, holeNumber]
    );

    if (holeResult.length === 0) {
      return c.json({ error: "Hole not found" }, 404);
    }

    const { par } = holeResult[0];

    // Calculate golf score
    let score;
    if (!success) {
      score = (attempts + 1) - par; // Failed = attempts + 1 penalty
    } else {
      score = attempts - par;
    }

    console.log("[golf-submit] Par:", par, "Attempts:", attempts, "Score:", score);

    // Update hole with score
    await sql(
      `UPDATE golf_holes
       SET attempts = $1, score = $2, completed_at = NOW()
       WHERE round_id = $3 AND hole_number = $4;`,
      [attempts, score, roundId, holeNumber]
    );

    // Check if this was the last hole (hole 9)
    if (holeNumber === 9) {
      // Calculate total score
      const totalResult = await sql(
        `SELECT SUM(score) as total_score
         FROM golf_holes
         WHERE round_id = $1;`,
        [roundId]
      );

      const totalScore = totalResult[0].total_score || 0;

      // Mark round as completed
      await sql(
        `UPDATE golf_rounds
         SET is_completed = TRUE, completed_at = NOW(), total_score = $1
         WHERE id = $2;`,
        [totalScore, roundId]
      );

      console.log("[golf-submit] Round completed! Total score:", totalScore);

      return c.json({
        ok: true,
        score,
        roundCompleted: true,
        totalScore
      });
    } else {
      // Move to next hole
      await sql(
        `UPDATE golf_rounds
         SET current_hole = $1
         WHERE id = $2;`,
        [holeNumber + 1, roundId]
      );

      return c.json({
        ok: true,
        score,
        roundCompleted: false,
        nextHole: holeNumber + 1
      });
    }
  } catch (err) {
    console.error("golf-submit function error", err);
    return c.json({
      error: "Server error in golf-submit",
      details: err.message
    }, 500);
  }
}
