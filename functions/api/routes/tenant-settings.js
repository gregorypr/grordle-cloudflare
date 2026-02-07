// Cloudflare Pages Function: tenant-settings handler
// Get and update tenant-specific settings (MOTD, branding)

export async function tenantSettingsHandler(c) {
  const sql = c.get("sql");
  const org_id = c.get("org_id");

  if (c.req.method === "GET") {
    // Get settings for current tenant
    try {
      if (org_id === null) {
        // Default tenant (grordle.com) - return defaults
        return c.json({
          name: "Grordle",
          display_name: "Grordle",
          motd: null,
          primary_color: "#8b5cf6",
          secondary_color: "#7c3aed"
        });
      }

      const result = await sql(
        `SELECT name, display_name, motd, primary_color, secondary_color, admin_password, settings
         FROM organizations
         WHERE id = $1`,
        [org_id]
      );

      if (result.length === 0) {
        return c.json({ error: "Organization not found" }, 404);
      }

      return c.json(result[0]);
    } catch (err) {
      console.error('Error fetching tenant settings:', err);
      return c.json({ error: 'Server error' }, 500);
    }
  }

  if (c.req.method === "PUT" || c.req.method === "POST") {
    // Update settings for current tenant
    try {
      const body = await c.req.json();
      const { display_name, motd, primary_color, secondary_color } = body;

      if (org_id === null) {
        return c.json({ error: "Cannot modify default tenant settings via this endpoint" }, 403);
      }

      // Build update query
      const updates = [];
      const params = [];
      let paramIndex = 1;

      if (display_name !== undefined) {
        updates.push(`display_name = $${paramIndex++}`);
        params.push(display_name);
      }

      if (motd !== undefined) {
        updates.push(`motd = $${paramIndex++}`);
        params.push(motd);
      }

      if (primary_color !== undefined) {
        updates.push(`primary_color = $${paramIndex++}`);
        params.push(primary_color);
      }

      if (secondary_color !== undefined) {
        updates.push(`secondary_color = $${paramIndex++}`);
        params.push(secondary_color);
      }

      if (updates.length === 0) {
        return c.json({ error: 'No fields to update' }, 400);
      }

      params.push(org_id);
      const result = await sql(
        `UPDATE organizations SET ${updates.join(', ')}
         WHERE id = $${paramIndex}
         RETURNING name, display_name, motd, primary_color, secondary_color`,
        params
      );

      if (result.length === 0) {
        return c.json({ error: 'Organization not found' }, 404);
      }

      return c.json({
        ok: true,
        settings: result[0],
        message: 'Tenant settings updated successfully'
      });
    } catch (err) {
      console.error('Error updating tenant settings:', err);
      return c.json({ error: 'Server error', details: err.message }, 500);
    }
  }

  return c.json({ error: 'Method not allowed' }, 405);
}
