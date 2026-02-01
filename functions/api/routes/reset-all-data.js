// Cloudflare Pages Function: reset-all-data handler

export async function resetAllDataHandler(c) {
  const sql = c.get("sql");

  if (c.req.method !== "POST") {
    return c.json({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await c.req.json();
    const { confirmPassword } = body;

    if (confirmPassword !== "admin123") {
      return c.json({ error: "Invalid password" }, 403);
    }

    console.log("Starting reset all data operation...");

    // Delete in correct order to avoid foreign key issues
    await sql(`DELETE FROM golf_holes WHERE 1=1;`);
    await sql(`DELETE FROM golf_rounds WHERE 1=1;`);
    await sql(`DELETE FROM daily_golf_course WHERE 1=1;`);
    await sql(`DELETE FROM daily_word_overrides WHERE 1=1;`);
    await sql(`DELETE FROM player_games WHERE 1=1;`);
    await sql(`DELETE FROM scores WHERE 1=1;`);
    await sql(`DELETE FROM daily_players WHERE 1=1;`);
    await sql(`DELETE FROM games WHERE 1=1;`);
    await sql(`DELETE FROM players WHERE 1=1;`);
    await sql(`DELETE FROM member_start_words WHERE 1=1;`);
    await sql(`DELETE FROM daily_start_words WHERE 1=1;`);

    // Reset sequences
    await sql(`ALTER SEQUENCE IF EXISTS player_games_id_seq RESTART WITH 1;`);
    await sql(`ALTER SEQUENCE IF EXISTS scores_id_seq RESTART WITH 1;`);
    await sql(`ALTER SEQUENCE IF EXISTS daily_players_id_seq RESTART WITH 1;`);
    await sql(`ALTER SEQUENCE IF EXISTS games_id_seq RESTART WITH 1;`);
    await sql(`ALTER SEQUENCE IF EXISTS players_id_seq RESTART WITH 1;`);

    console.log("Reset all data operation completed successfully");

    return c.json({
      ok: true,
      message: "All user data has been reset"
    });
  } catch (err) {
    console.error("reset-all-data function error", err);
    return c.json({
      error: "Server error in reset-all-data",
      details: err.message
    }, 500);
  }
}
