// Cloudflare Pages Function: edit-golf-score handler

export async function editGolfScoreHandler(c) {
  const sql = c.get("sql");

  if (c.req.method !== "POST") {
    return c.json({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await c.req.json();
    const { playerName, date, holeNumber, attempts, adminPassword } = body;

    if (adminPassword !== "admin123") {
      return c.json({ error: "Invalid admin password" }, 403);
    }

    if (!playerName || !date || !holeNumber || !attempts) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    const playerResult = await sql(
      `SELECT id FROM players WHERE player_name = $1`,
      [playerName]
    );

    if (playerResult.length === 0) {
      return c.json({ error: "Player not found" }, 404);
    }

    const playerId = playerResult[0].id;

    // Find the golf round for this player and date
    const roundResult = await sql(
      `SELECT id FROM golf_rounds
       WHERE player_id = $1
       AND DATE(completed_at) = $2::date
       ORDER BY completed_at DESC
       LIMIT 1`,
      [playerId, date]
    );

    if (roundResult.length === 0) {
      return c.json({ error: "No golf round found for this player and date" }, 404);
    }

    const roundId = roundResult[0].id;

    // Get the hole info (need par to calculate score)
    const holeResult = await sql(
      `SELECT par FROM golf_holes
       WHERE round_id = $1 AND hole_number = $2`,
      [roundId, holeNumber]
    );

    if (holeResult.length === 0) {
      return c.json({ error: "Hole not found" }, 404);
    }

    const par = holeResult[0].par;
    const score = attempts - par;

    // Update the hole
    const updateResult = await sql(
      `UPDATE golf_holes
       SET attempts = $1, score = $2
       WHERE round_id = $3 AND hole_number = $4
       RETURNING *`,
      [attempts, score, roundId, holeNumber]
    );

    // Recalculate total score for the round
    const totalResult = await sql(
      `SELECT SUM(score) as total_score
       FROM golf_holes
       WHERE round_id = $1 AND score IS NOT NULL`,
      [roundId]
    );

    const totalScore = totalResult[0].total_score;

    // Update the round total
    await sql(
      `UPDATE golf_rounds
       SET total_score = $1
       WHERE id = $2`,
      [totalScore, roundId]
    );

    return c.json({
      ok: true,
      message: `Updated ${playerName}'s hole ${holeNumber} score to ${attempts} attempts (${score > 0 ? '+' : ''}${score})`,
      hole: updateResult[0],
      newTotalScore: totalScore
    });
  } catch (err) {
    console.error("edit-golf-score error", err);
    return c.json({
      error: "Server error",
      details: err.message
    }, 500);
  }
}
