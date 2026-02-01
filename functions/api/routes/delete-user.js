// Cloudflare Pages Function: delete-user handler

export async function deleteUserHandler(c) {
  const sql = c.get("sql");

  if (c.req.method !== "POST") {
    return c.text("Method Not Allowed", 405);
  }

  try {
    const body = await c.req.json();
    const { playerName } = body;

    if (!playerName) {
      return c.json({ error: "Missing playerName" }, 400);
    }

    const playerResult = await sql(
      `SELECT id, player_name FROM players WHERE LOWER(player_name) = LOWER($1);`,
      [playerName]
    );

    if (playerResult.length === 0) {
      return c.json({ error: "User not found" }, 404);
    }

    const playerId = playerResult[0].id;
    const actualPlayerName = playerResult[0].player_name;

    await sql(`DELETE FROM scores WHERE player_id = $1;`, [playerId]);
    await sql(`DELETE FROM daily_players WHERE player_id = $1;`, [playerId]);
    await sql(`DELETE FROM player_games WHERE player_id = $1;`, [playerId]);
    await sql(`DELETE FROM players WHERE id = $1;`, [playerId]);

    return c.json({
      ok: true,
      message: `User ${actualPlayerName} deleted successfully`
    });
  } catch (err) {
    console.error("delete-user function error", err);
    return c.json({
      error: "Server error in delete-user",
      details: err.message
    }, 500);
  }
}
