// Cloudflare Pages Function: golf-save-guesses handler

export async function golfSaveGuessesHandler(c) {
  const sql = c.get("sql");

  try {
    const body = await c.req.json();
    const { roundId, holeNumber, guesses } = body;

    if (!roundId || !holeNumber || !Array.isArray(guesses)) {
      return c.json({ error: "roundId, holeNumber, and guesses are required" }, 400);
    }

    console.log('[golf-save-guesses] Saving guesses for round:', roundId, 'hole:', holeNumber);

    // Update guesses for this hole
    await sql(
      `UPDATE golf_holes
       SET guesses = $1
       WHERE round_id = $2 AND hole_number = $3;`,
      [JSON.stringify(guesses), roundId, holeNumber]
    );

    return c.json({ ok: true });
  } catch (err) {
    console.error("golf-save-guesses error", err);
    return c.json({
      error: "Server error in golf-save-guesses",
      details: err.message
    }, 500);
  }
}
