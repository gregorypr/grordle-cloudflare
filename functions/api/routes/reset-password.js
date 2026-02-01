// Cloudflare Pages Function: reset-password handler

export async function resetPasswordHandler(c) {
  const sql = c.get("sql");

  if (c.req.method !== "POST") {
    return c.json({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await c.req.json();
    const { playerName } = body;

    if (!playerName) {
      return c.json({ error: "playerName is required" }, 400);
    }

    await sql(
      'UPDATE players SET password_hash = NULL, password_reset_required = TRUE WHERE player_name = $1',
      [playerName]
    );

    return c.json({ ok: true });
  } catch (err) {
    console.error('Error resetting password:', err);
    return c.json({ error: 'Server error resetting password' }, 500);
  }
}
