// api/schedule-wordlist-migration.js
// API endpoint to schedule a wordlist migration for midnight Sydney time
// The actual migration is performed by the cron job when the scheduled time arrives

import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Get current Sydney time info
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

export default async (req, res) => {
  // Handle GET to check current schedule status
  if (req.method === "GET") {
    try {
      const client = await pool.connect();
      try {
        // Check if scheduled_migrations table exists
        const tableCheck = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_name = 'scheduled_migrations'
          )
        `);

        if (!tableCheck.rows[0].exists) {
          return res.status(200).json({
            scheduled: false,
            message: "No migrations scheduled"
          });
        }

        // Get pending migration
        const result = await client.query(`
          SELECT * FROM scheduled_migrations
          WHERE status = 'pending'
          ORDER BY created_at DESC
          LIMIT 1
        `);

        if (result.rows.length === 0) {
          return res.status(200).json({
            scheduled: false,
            message: "No migrations scheduled"
          });
        }

        const sydneyInfo = getSydneyTimeInfo();

        return res.status(200).json({
          scheduled: true,
          scheduledFor: result.rows[0].scheduled_for,
          createdAt: result.rows[0].created_at,
          currentSydneyTime: `${sydneyInfo.date} ${sydneyInfo.time}`
        });

      } finally {
        client.release();
      }
    } catch (err) {
      console.error('[schedule-wordlist-migration] Error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  // Handle POST to schedule a new migration
  if (req.method === "POST") {
    try {
      const { adminPassword } = req.body || {};

      // Require admin password
      if (adminPassword !== "admin123") {
        return res.status(403).json({ error: "Invalid admin password" });
      }

      const client = await pool.connect();
      try {
        // Create table if not exists
        await client.query(`
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

        // Calculate next midnight Sydney time
        const sydneyInfo = getSydneyTimeInfo();
        let scheduledDate = sydneyInfo.date;

        // If it's already past midnight (any time after 00:00), schedule for tomorrow
        // Actually, we always schedule for the NEXT midnight
        // Get tomorrow's date in Sydney
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowFormatter = new Intl.DateTimeFormat('en-AU', {
          timeZone: 'Australia/Sydney',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        });
        const tomorrowParts = tomorrowFormatter.formatToParts(tomorrow);
        scheduledDate = `${tomorrowParts.find(p => p.type === 'year').value}-${tomorrowParts.find(p => p.type === 'month').value}-${tomorrowParts.find(p => p.type === 'day').value}`;

        // Cancel any existing pending migrations
        await client.query(`
          UPDATE scheduled_migrations
          SET status = 'cancelled'
          WHERE status = 'pending' AND migration_type = 'wordlist'
        `);

        // Insert new scheduled migration
        const result = await client.query(`
          INSERT INTO scheduled_migrations (migration_type, scheduled_for, status)
          VALUES ('wordlist', $1, 'pending')
          RETURNING *
        `, [scheduledDate]);

        console.log(`[schedule-wordlist-migration] Scheduled migration for ${scheduledDate} (midnight Sydney time)`);

        return res.status(200).json({
          ok: true,
          message: `Wordlist migration scheduled for midnight Sydney time on ${scheduledDate}`,
          scheduledFor: scheduledDate,
          currentSydneyTime: `${sydneyInfo.date} ${sydneyInfo.time}`,
          id: result.rows[0].id
        });

      } finally {
        client.release();
      }
    } catch (err) {
      console.error('[schedule-wordlist-migration] Error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  // Handle DELETE to cancel a scheduled migration
  if (req.method === "DELETE") {
    try {
      const { adminPassword } = req.body || {};

      if (adminPassword !== "admin123") {
        return res.status(403).json({ error: "Invalid admin password" });
      }

      const client = await pool.connect();
      try {
        const result = await client.query(`
          UPDATE scheduled_migrations
          SET status = 'cancelled'
          WHERE status = 'pending' AND migration_type = 'wordlist'
          RETURNING *
        `);

        if (result.rowCount === 0) {
          return res.status(200).json({
            ok: true,
            message: "No pending migrations to cancel"
          });
        }

        return res.status(200).json({
          ok: true,
          message: `Cancelled ${result.rowCount} pending migration(s)`,
          cancelled: result.rows
        });

      } finally {
        client.release();
      }
    } catch (err) {
      console.error('[schedule-wordlist-migration] Error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
};
