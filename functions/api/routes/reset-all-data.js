// Cloudflare Pages Function: reset-all-data handler
// CRITICAL: This now only resets data for the current tenant

export async function resetAllDataHandler(c) {
  const sql = c.get("sql");
  const org_id = c.get("org_id"); // CRITICAL: Tenant isolation

  if (c.req.method !== "POST") {
    return c.json({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await c.req.json();
    const { confirmPassword } = body;

    if (confirmPassword !== "admin123") {
      return c.json({ error: "Invalid password" }, 403);
    }

    console.log(`Starting reset all data operation for tenant org_id=${org_id}...`);

    // Delete in correct order to avoid foreign key issues
    // ONLY for this tenant using COALESCE pattern

    // Golf data (has org_id via golf_rounds)
    await sql(`
      DELETE FROM golf_holes
      WHERE round_id IN (
        SELECT id FROM golf_rounds WHERE COALESCE(org_id, 0) = COALESCE($1, 0)
      );
    `, [org_id]);

    await sql(`DELETE FROM golf_rounds WHERE COALESCE(org_id, 0) = COALESCE($1, 0);`, [org_id]);

    // Daily golf course is shared (no org_id) - don't delete

    // Player-related data
    await sql(`
      DELETE FROM scores
      WHERE player_id IN (
        SELECT id FROM players WHERE COALESCE(org_id, 0) = COALESCE($1, 0)
      );
    `, [org_id]);

    await sql(`
      DELETE FROM daily_players
      WHERE player_id IN (
        SELECT id FROM players WHERE COALESCE(org_id, 0) = COALESCE($1, 0)
      );
    `, [org_id]);

    // Games for this tenant
    await sql(`DELETE FROM games WHERE COALESCE(org_id, 0) = COALESCE($1, 0);`, [org_id]);

    // Players for this tenant
    await sql(`DELETE FROM players WHERE COALESCE(org_id, 0) = COALESCE($1, 0);`, [org_id]);

    // Start words are shared - don't delete

    console.log(`Reset all data operation completed successfully for tenant org_id=${org_id}`);

    return c.json({
      ok: true,
      message: org_id === null
        ? "All data has been reset for default tenant (grordle.com)"
        : `All data has been reset for this tenant (org_id=${org_id})`
    });
  } catch (err) {
    console.error("reset-all-data function error", err);
    return c.json({
      error: "Server error in reset-all-data",
      details: err.message
    }, 500);
  }
}
