// api/motd.js - Message of the Day API
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

// Ensure table exists
async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS message_of_day (
      id SERIAL PRIMARY KEY,
      message_date DATE NOT NULL UNIQUE,
      message TEXT NOT NULL,
      created_by TEXT,
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);
}

export default async function handler(req, res) {
  try {
    await ensureTable();

    if (req.method === "GET") {
      // Get message(s) - either for a specific date or a range for calendar view
      const { date, month, year } = req.query;

      if (date) {
        // Get single date message
        const result = await pool.query(
          "SELECT message, created_by FROM message_of_day WHERE message_date = $1",
          [date]
        );

        return res.status(200).json({
          ok: true,
          message: result.rows[0]?.message || "",
          createdBy: result.rows[0]?.created_by || ""
        });
      } else if (month && year) {
        // Get all messages for a month (for calendar view)
        const startDate = `${year}-${month.padStart(2, '0')}-01`;
        const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0];

        const result = await pool.query(
          `SELECT message_date, message, created_by
           FROM message_of_day
           WHERE message_date >= $1 AND message_date <= $2
           ORDER BY message_date`,
          [startDate, endDate]
        );

        // Convert to object keyed by date
        const messages = {};
        result.rows.forEach(row => {
          const dateStr = row.message_date.toISOString().split('T')[0];
          messages[dateStr] = {
            message: row.message,
            createdBy: row.created_by
          };
        });

        return res.status(200).json({ ok: true, messages });
      }

      return res.status(400).json({ ok: false, error: "Missing date or month/year parameter" });
    }

    if (req.method === "POST") {
      // Save or update message
      const { date, message, playerName } = req.body;

      if (!date) {
        return res.status(400).json({ ok: false, error: "Missing date" });
      }

      if (!message || message.trim() === "") {
        // Delete message if empty
        await pool.query(
          "DELETE FROM message_of_day WHERE message_date = $1",
          [date]
        );
        return res.status(200).json({ ok: true, deleted: true });
      }

      // Truncate message to 50 characters
      const truncatedMessage = message.trim().substring(0, 50);

      // Upsert message
      await pool.query(
        `INSERT INTO message_of_day (message_date, message, created_by, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (message_date)
         DO UPDATE SET message = $2, created_by = $3, updated_at = NOW()`,
        [date, truncatedMessage, playerName || "Anonymous"]
      );

      return res.status(200).json({ ok: true, saved: true });
    }

    return res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (err) {
    console.error("[motd] Error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
