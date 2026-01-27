// Cloudflare Pages Function: motd (message of the day) handler

export async function motdHandler(c) {
  const sql = c.get("sql");
  const method = c.req.method;

  try {
    if (method === "GET") {
      const date = c.req.query("date");
      const month = c.req.query("month");
      const year = c.req.query("year");

      if (date) {
        // Get single date message
        const result = await sql(
          "SELECT message, created_by FROM message_of_day WHERE message_date = $1",
          [date]
        );

        return c.json({
          ok: true,
          message: result[0]?.message || "",
          createdBy: result[0]?.created_by || ""
        });
      } else if (month && year) {
        // Get all messages for a month
        const startDate = `${year}-${month.padStart(2, '0')}-01`;
        const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0];

        const result = await sql(
          `SELECT message_date, message, created_by
           FROM message_of_day
           WHERE message_date >= $1 AND message_date <= $2
           ORDER BY message_date`,
          [startDate, endDate]
        );

        // Convert to object keyed by date
        const messages = {};
        result.forEach(row => {
          const dateStr = row.message_date.toISOString().split('T')[0];
          messages[dateStr] = {
            message: row.message,
            createdBy: row.created_by
          };
        });

        return c.json({ ok: true, messages });
      }

      return c.json({ ok: false, error: "Missing date or month/year parameter" }, 400);
    }

    if (method === "POST") {
      const body = await c.req.json();
      const { date, message, playerName } = body;

      if (!date) {
        return c.json({ ok: false, error: "Missing date" }, 400);
      }

      if (!message || message.trim() === "") {
        // Delete message if empty
        await sql(
          "DELETE FROM message_of_day WHERE message_date = $1",
          [date]
        );
        return c.json({ ok: true, deleted: true });
      }

      // Truncate message to 50 characters
      const truncatedMessage = message.trim().substring(0, 50);

      // Upsert message
      await sql(
        `INSERT INTO message_of_day (message_date, message, created_by, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (message_date)
         DO UPDATE SET message = $2, created_by = $3, updated_at = NOW()`,
        [date, truncatedMessage, playerName || "Anonymous"]
      );

      return c.json({ ok: true, saved: true });
    }

    return c.json({ ok: false, error: "Method not allowed" }, 405);
  } catch (err) {
    console.error("[motd] Error:", err);
    return c.json({ ok: false, error: err.message }, 500);
  }
}
