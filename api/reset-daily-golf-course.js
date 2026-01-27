// api/reset-daily-golf-course.js
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

    const today = getAustralianDate();
    
    const result = await pool.query(
      `DELETE FROM daily_golf_course WHERE course_date = $1 RETURNING hole_number`,
      [today]
    );

    console.log(`[reset-daily-golf-course] Deleted ${result.rowCount} holes for ${today}`);

    return res.status(200).json({
      ok: true,
      message: `Deleted today's course`,
      date: today,
      holesDeleted: result.rowCount
    });
  } catch (err) {
    console.error("[reset-daily-golf-course] Error:", err);
    return res.status(500).json({ error: err.message });
  }
};
