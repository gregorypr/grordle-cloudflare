// Cloudflare Pages Function: golf-next-hole handler

export async function golfNextHoleHandler(c) {
  const sql = c.get("sql");

  try {
    const body = await c.req.json();
    const { roundId } = body;

    if (!roundId) {
      return c.json({ error: "roundId is required" }, 400);
    }

    console.log("[golf-next-hole] Getting next hole for round:", roundId);

    // Get current hole number
    const roundResult = await sql(
      `SELECT current_hole, is_completed FROM golf_rounds WHERE id = $1;`,
      [roundId]
    );

    if (roundResult.length === 0) {
      return c.json({ error: "Round not found" }, 404);
    }

    const { current_hole, is_completed } = roundResult[0];

    if (is_completed) {
      return c.json({ error: "Round already completed" }, 400);
    }

    // Retrieve the existing hole data
    const existingHole = await sql(
      `SELECT target_word, start_word, par, guesses FROM golf_holes
       WHERE round_id = $1 AND hole_number = $2;`,
      [roundId, current_hole]
    );

    if (existingHole.length > 0) {
      return c.json({
        ok: true,
        holeNumber: current_hole,
        targetWord: existingHole[0].target_word,
        startWord: existingHole[0].start_word,
        par: existingHole[0].par,
        guesses: existingHole[0].guesses || []
      });
    }

    // Shouldn't happen since holes are pre-generated
    return c.json({
      error: "Hole not found. Round may not have been initialised properly.",
      roundId,
      currentHole: current_hole
    }, 500);
  } catch (err) {
    console.error("golf-next-hole function error", err);
    return c.json({
      error: "Server error in golf-next-hole",
      details: err.message
    }, 500);
  }
}
