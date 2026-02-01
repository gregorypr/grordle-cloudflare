// Cloudflare Pages Function: schedule-wordlist-migration handler

function getSydneyTimeInfo() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Sydney',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  const parts = formatter.formatToParts(now);
  const year = parts.find(p => p.type === 'year').value;
  const month = parts.find(p => p.type === 'month').value;
  const day = parts.find(p => p.type === 'day').value;
  const hour = parts.find(p => p.type === 'hour').value;
  const minute = parts.find(p => p.type === 'minute').value;

  return {
    date: `${year}-${month}-${day}`,
    time: `${hour}:${minute}`,
    hour: parseInt(hour),
    minute: parseInt(minute)
  };
}

export async function scheduleWordlistMigrationHandler(c) {
  const sql = c.get("sql");
  const method = c.req.method;

  // Handle GET to check current schedule status
  if (method === "GET") {
    try {
      const tableCheck = await sql(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_name = 'scheduled_migrations'
        )
      `);

      if (!tableCheck[0].exists) {
        return c.json({
          scheduled: false,
          message: "No migrations scheduled"
        });
      }

      const result = await sql(`
        SELECT * FROM scheduled_migrations
        WHERE status = 'pending'
        ORDER BY created_at DESC
        LIMIT 1
      `);

      if (result.length === 0) {
        return c.json({
          scheduled: false,
          message: "No migrations scheduled"
        });
      }

      const sydneyInfo = getSydneyTimeInfo();

      return c.json({
        scheduled: true,
        scheduledFor: result[0].scheduled_for,
        createdAt: result[0].created_at,
        currentSydneyTime: `${sydneyInfo.date} ${sydneyInfo.time}`
      });

    } catch (err) {
      console.error('[schedule-wordlist-migration] Error:', err);
      return c.json({ error: err.message }, 500);
    }
  }

  // Handle POST to schedule a new migration
  if (method === "POST") {
    try {
      const body = await c.req.json();
      const { adminPassword } = body || {};

      if (adminPassword !== "admin123") {
        return c.json({ error: "Invalid admin password" }, 403);
      }

      await sql(`
        CREATE TABLE IF NOT EXISTS scheduled_migrations (
          id SERIAL PRIMARY KEY,
          migration_type VARCHAR(50) NOT NULL DEFAULT 'wordlist',
          scheduled_for DATE NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'pending',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          completed_at TIMESTAMP WITH TIME ZONE,
          result JSONB
        )
      `);

      const sydneyInfo = getSydneyTimeInfo();

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowFormatter = new Intl.DateTimeFormat('en-AU', {
        timeZone: 'Australia/Sydney',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      const tomorrowParts = tomorrowFormatter.formatToParts(tomorrow);
      const scheduledDate = `${tomorrowParts.find(p => p.type === 'year').value}-${tomorrowParts.find(p => p.type === 'month').value}-${tomorrowParts.find(p => p.type === 'day').value}`;

      await sql(`
        UPDATE scheduled_migrations
        SET status = 'cancelled'
        WHERE status = 'pending' AND migration_type = 'wordlist'
      `);

      const result = await sql(`
        INSERT INTO scheduled_migrations (migration_type, scheduled_for, status)
        VALUES ('wordlist', $1, 'pending')
        RETURNING *
      `, [scheduledDate]);

      console.log(`[schedule-wordlist-migration] Scheduled migration for ${scheduledDate} (midnight Sydney time)`);

      return c.json({
        ok: true,
        message: `Wordlist migration scheduled for midnight Sydney time on ${scheduledDate}`,
        scheduledFor: scheduledDate,
        currentSydneyTime: `${sydneyInfo.date} ${sydneyInfo.time}`,
        id: result[0].id
      });

    } catch (err) {
      console.error('[schedule-wordlist-migration] Error:', err);
      return c.json({ error: err.message }, 500);
    }
  }

  // Handle DELETE to cancel a scheduled migration
  if (method === "DELETE") {
    try {
      const body = await c.req.json();
      const { adminPassword } = body || {};

      if (adminPassword !== "admin123") {
        return c.json({ error: "Invalid admin password" }, 403);
      }

      const result = await sql(`
        UPDATE scheduled_migrations
        SET status = 'cancelled'
        WHERE status = 'pending' AND migration_type = 'wordlist'
        RETURNING *
      `);

      if (result.length === 0) {
        return c.json({
          ok: true,
          message: "No pending migrations to cancel"
        });
      }

      return c.json({
        ok: true,
        message: `Cancelled ${result.length} pending migration(s)`,
        cancelled: result
      });

    } catch (err) {
      console.error('[schedule-wordlist-migration] Error:', err);
      return c.json({ error: err.message }, 500);
    }
  }

  return c.json({ error: "Method not allowed" }, 405);
}
