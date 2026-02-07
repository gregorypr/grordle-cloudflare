// Cloudflare Pages Function: manage-organizations handler
// Admin-only endpoint for creating/editing/deleting tenants

export async function manageOrganizationsHandler(c) {
  const sql = c.get("sql");

  if (c.req.method === "GET") {
    // List all organizations
    try {
      const orgs = await sql(`
        SELECT
          o.id,
          o.slug,
          o.name,
          o.display_name,
          o.domain,
          o.motd,
          o.primary_color,
          o.secondary_color,
          o.created_at,
          COUNT(DISTINCT p.id) as player_count
        FROM organizations o
        LEFT JOIN players p ON p.org_id = o.id
        GROUP BY o.id, o.slug, o.name, o.display_name, o.domain, o.motd, o.primary_color, o.secondary_color, o.created_at
        ORDER BY o.created_at DESC
      `);

      return c.json({ ok: true, organizations: orgs });
    } catch (err) {
      console.error('Error listing organizations:', err);
      return c.json({ ok: false, error: 'Server error', details: err.message }, 500);
    }
  }

  if (c.req.method === "POST") {
    // Create new organization
    try {
      const body = await c.req.json();
      const { slug, name, display_name, domain, motd, primary_color, secondary_color, admin_password } = body;

      if (!slug || !name) {
        return c.json({ error: 'slug and name are required' }, 400);
      }

      // Validate slug format (lowercase, alphanumeric, hyphens)
      if (!/^[a-z0-9-]+$/.test(slug)) {
        return c.json({ error: 'slug must be lowercase alphanumeric with hyphens only' }, 400);
      }

      // Check if slug already exists
      const existing = await sql(
        `SELECT id FROM organizations WHERE slug = $1`,
        [slug]
      );

      if (existing.length > 0) {
        return c.json({ error: 'Organization with this slug already exists' }, 409);
      }

      // Create organization
      const result = await sql(
        `INSERT INTO organizations (slug, name, display_name, domain, motd, primary_color, secondary_color, admin_password)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, slug, name, display_name, domain, motd, primary_color, secondary_color, created_at`,
        [slug, name, display_name || null, domain || null, motd || null, primary_color || '#8b5cf6', secondary_color || '#7c3aed', admin_password || null]
      );

      return c.json({
        ok: true,
        organization: result[0],
        message: `Organization '${name}' created. Access at: ${slug}.grordle.com`
      }, 201);
    } catch (err) {
      console.error('Error creating organization:', err);
      return c.json({ error: 'Server error', details: err.message }, 500);
    }
  }

  if (c.req.method === "PUT") {
    // Update organization
    try {
      const body = await c.req.json();
      const { id, slug, name, display_name, domain, motd, primary_color, secondary_color, admin_password } = body;

      if (!id) {
        return c.json({ error: 'id is required' }, 400);
      }

      // Build update query dynamically
      const updates = [];
      const params = [];
      let paramIndex = 1;

      if (slug !== undefined) {
        if (!/^[a-z0-9-]+$/.test(slug)) {
          return c.json({ error: 'slug must be lowercase alphanumeric with hyphens only' }, 400);
        }
        updates.push(`slug = $${paramIndex++}`);
        params.push(slug);
      }

      if (name !== undefined) {
        updates.push(`name = $${paramIndex++}`);
        params.push(name);
      }

      if (display_name !== undefined) {
        updates.push(`display_name = $${paramIndex++}`);
        params.push(display_name);
      }

      if (domain !== undefined) {
        updates.push(`domain = $${paramIndex++}`);
        params.push(domain);
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

      if (admin_password !== undefined) {
        updates.push(`admin_password = $${paramIndex++}`);
        params.push(admin_password);
      }

      if (updates.length === 0) {
        return c.json({ error: 'No fields to update' }, 400);
      }

      params.push(id);
      const result = await sql(
        `UPDATE organizations SET ${updates.join(', ')}
         WHERE id = $${paramIndex}
         RETURNING id, slug, name, display_name, domain, motd, primary_color, secondary_color, created_at`,
        params
      );

      if (result.length === 0) {
        return c.json({ error: 'Organization not found' }, 404);
      }

      return c.json({
        ok: true,
        organization: result[0],
        message: 'Organization updated successfully'
      });
    } catch (err) {
      console.error('Error updating organization:', err);
      return c.json({ error: 'Server error', details: err.message }, 500);
    }
  }

  if (c.req.method === "DELETE") {
    // Delete organization
    try {
      const body = await c.req.json();
      const { id, confirmPassword } = body;

      if (!id) {
        return c.json({ error: 'id is required' }, 400);
      }

      if (confirmPassword !== 'admin123') {
        return c.json({ error: 'Invalid password' }, 403);
      }

      // Check player count
      const players = await sql(
        `SELECT COUNT(*) as count FROM players WHERE org_id = $1`,
        [id]
      );

      const playerCount = parseInt(players[0].count);

      if (playerCount > 0) {
        return c.json({
          error: `Cannot delete organization with ${playerCount} player(s). Delete players first or use force delete.`
        }, 400);
      }

      // Delete organization (cascade will handle related data if ON DELETE CASCADE is set)
      await sql(`DELETE FROM organizations WHERE id = $1`, [id]);

      return c.json({
        ok: true,
        message: 'Organization deleted successfully'
      });
    } catch (err) {
      console.error('Error deleting organization:', err);
      return c.json({ error: 'Server error', details: err.message }, 500);
    }
  }

  return c.json({ error: 'Method not allowed' }, 405);
}
