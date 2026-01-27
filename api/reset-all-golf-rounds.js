// api/reset-all-golf-rounds.js
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Helper to get Australian date (handles AEST/AEDT automatically)
function getAustralianDate() {
  const formatter = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Sydney',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = formatter.formatToParts(new Date());
  const year = parts.find(p => p.type === 'year').value;
  const month = parts.find(p => p.type === 'month').value;
  const day = parts.find(p => p.type === 'day').value;
  return `${year}-${month}-${day}`;
}

export default async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { adminPassword } = req.body || {};
    
    if (adminPassword !== "admin123") {
      return res.status(403).json({ error: "Invalid admin password" });
    }

    console.log("[reset-all-golf-rounds] Resetting all golf rounds for today");

    const today = getAustralianDate();
    const startOfDay = `${today} 00:00:00`;
    const endOfDay = `${today} 23:59:59`;

    // Delete all golf rounds that were started today
    const deleteResult = await pool.query(
      `DELETE FROM golf_rounds 
       WHERE started_at >= $1::timestamp AND started_at <= $2::timestamp
       RETURNING id;`,
      [startOfDay, endOfDay]
    );

    console.log(`[reset-all-golf-rounds] Deleted ${deleteResult.rowCount} rounds for ${today}`);

    return res.status(200).json({
      ok: true,
      message: `Deleted ${deleteResult.rowCount} golf round(s) for today`,
      date: today,
      deletedRounds: deleteResult.rowCount
    });
  } catch (err) {
    console.error("[reset-all-golf-rounds] Error:", err);
    return res.status(500).json({ error: err.message });
  }
};
