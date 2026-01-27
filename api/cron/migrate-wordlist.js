// api/cron/migrate-wordlist.js
// Vercel Cron job to run wordlist migration when scheduled
// Only runs if a migration has been scheduled via the admin panel
// This endpoint is called by Vercel's cron scheduler

import { Pool } from "pg";
import fs from "fs";
import path from "path";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Verify the request is from Vercel Cron
function isValidCronRequest(req) {
  // Vercel sends this header for cron jobs
  const authHeader = req.headers['authorization'];
  const cronSecret = process.env.CRON_SECRET;

  // If CRON_SECRET is set, validate it
  if (cronSecret) {
    return authHeader === `Bearer ${cronSecret}`;
  }

  // Also allow if the request has the Vercel cron header
  return req.headers['x-vercel-cron'] === '1';
}

// Get current Sydney date
function getSydneyDate() {
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
  // Only allow GET (Vercel cron uses GET)
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Validate cron request
  if (!isValidCronRequest(req)) {
    console.log("[cron/migrate-wordlist] Unauthorized request");
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    console.log("[cron/migrate-wordlist] Cron triggered, checking for scheduled migrations...");

    // Check if there's a scheduled migration for today
    const checkClient = await pool.connect();
    let pendingMigration = null;

    try {
      // Check if scheduled_migrations table exists
      const tableCheck = await checkClient.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_name = 'scheduled_migrations'
        )
      `);

      if (!tableCheck.rows[0].exists) {
        console.log("[cron/migrate-wordlist] No scheduled_migrations table found, skipping");
        return res.status(200).json({
          ok: true,
          skipped: true,
          reason: "No migrations table exists"
        });
      }

      // Check for pending migration scheduled for today
      const sydneyDate = getSydneyDate();
      const result = await checkClient.query(`
        SELECT * FROM scheduled_migrations
        WHERE status = 'pending'
          AND migration_type = 'wordlist'
          AND scheduled_for <= $1
        ORDER BY scheduled_for ASC
        LIMIT 1
      `, [sydneyDate]);

      if (result.rows.length === 0) {
        console.log("[cron/migrate-wordlist] No pending migrations scheduled for today or earlier");
        return res.status(200).json({
          ok: true,
          skipped: true,
          reason: "No migration scheduled",
          sydneyDate
        });
      }

      pendingMigration = result.rows[0];
      console.log(`[cron/migrate-wordlist] Found pending migration ID ${pendingMigration.id} scheduled for ${pendingMigration.scheduled_for}`);

      // Mark as in_progress
      await checkClient.query(`
        UPDATE scheduled_migrations
        SET status = 'in_progress'
        WHERE id = $1
      `, [pendingMigration.id]);

    } finally {
      checkClient.release();
    }

    console.log("[cron/migrate-wordlist] Starting scheduled wordlist migration...");

    // Read the wordlist-table-cleaned.txt file from the data directory
    const wordlistPath = path.join(process.cwd(), 'data', 'wordlist-table-cleaned.txt');
    console.log(`[cron/migrate-wordlist] Reading from: ${wordlistPath}`);

    if (!fs.existsSync(wordlistPath)) {
      return res.status(500).json({
        error: `Wordlist file not found at: ${wordlistPath}`,
        note: "Make sure data/wordlist-table-cleaned.txt is deployed with your application"
      });
    }

    const fileContent = fs.readFileSync(wordlistPath, 'utf-8');
    const lines = fileContent.split('\n').slice(1); // Skip header

    // Parse all valid words
    const words = [];
    let lineNumber = 2;
    const warnings = [];

    for (const line of lines) {
      if (!line.trim()) {
        lineNumber++;
        continue;
      }

      const parts = line.split('\t');
      if (parts.length < 4) {
        warnings.push(`Line ${lineNumber}: not enough columns`);
        lineNumber++;
        continue;
      }

      const word = parts[0].trim().toUpperCase();
      const difficulty = parseFloat(parts[1]);
      const scrabbleScore = parseFloat(parts[2]);
      const par = parseInt(parts[3]);

      if (!word || word.length !== 5) {
        warnings.push(`Line ${lineNumber}: invalid word "${word}"`);
        lineNumber++;
        continue;
      }

      if (isNaN(difficulty) || isNaN(scrabbleScore) || isNaN(par)) {
        warnings.push(`Line ${lineNumber}: invalid numeric values`);
        lineNumber++;
        continue;
      }

      words.push({ word, difficulty, scrabbleScore, par });
      lineNumber++;
    }

    console.log(`[cron/migrate-wordlist] Parsed ${words.length} valid words from file`);

    // Begin transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Clear existing wordlist data
      console.log('[cron/migrate-wordlist] Clearing existing wordlist data...');
      const deleteResult = await client.query('DELETE FROM wordlist');
      console.log(`[cron/migrate-wordlist] Deleted ${deleteResult.rowCount} existing words`);

      // Insert in batches of 100 for better performance
      const batchSize = 100;
      let imported = 0;

      for (let i = 0; i < words.length; i += batchSize) {
        const batch = words.slice(i, i + batchSize);
        const values = [];
        const placeholders = [];

        batch.forEach((w, idx) => {
          const base = idx * 4;
          placeholders.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`);
          values.push(w.word, w.difficulty, w.scrabbleScore, w.par);
        });

        await client.query(`
          INSERT INTO wordlist (word, difficulty, scrabble_score, par)
          VALUES ${placeholders.join(', ')}
        `, values);

        imported += batch.length;
      }

      await client.query('COMMIT');

      // Rebuild indexes and update statistics for optimal query performance
      console.log('[cron/migrate-wordlist] Rebuilding indexes and updating statistics...');
      await client.query('REINDEX TABLE wordlist');
      await client.query('ANALYZE wordlist');

      // Get final statistics
      const stats = await client.query(`
        SELECT
          COUNT(*) as total_words,
          MIN(par) as min_par,
          MAX(par) as max_par,
          AVG(difficulty)::numeric(10,2) as avg_difficulty
        FROM wordlist
      `);

      const distribution = await client.query(`
        SELECT par, COUNT(*) as count
        FROM wordlist
        GROUP BY par
        ORDER BY par
      `);

      console.log('[cron/migrate-wordlist] Migration complete!');
      console.log(`[cron/migrate-wordlist] Total words: ${stats.rows[0].total_words}`);

      const result = {
        ok: true,
        message: "Scheduled wordlist migration completed successfully",
        timestamp: new Date().toISOString(),
        deletedCount: deleteResult.rowCount,
        importedCount: imported,
        stats: {
          totalWords: parseInt(stats.rows[0].total_words),
          parRange: `${stats.rows[0].min_par} - ${stats.rows[0].max_par}`,
          avgDifficulty: parseFloat(stats.rows[0].avg_difficulty)
        },
        distribution: distribution.rows.map(row => ({
          par: row.par,
          count: parseInt(row.count)
        }))
      };

      // Mark the scheduled migration as completed
      if (pendingMigration) {
        await client.query(`
          UPDATE scheduled_migrations
          SET status = 'completed', completed_at = CURRENT_TIMESTAMP, result = $1
          WHERE id = $2
        `, [JSON.stringify(result), pendingMigration.id]);
      }

      return res.status(200).json(result);

    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

  } catch (err) {
    console.error('[cron/migrate-wordlist] Error:', err);

    // Mark the scheduled migration as failed
    if (typeof pendingMigration !== 'undefined' && pendingMigration) {
      try {
        const errorClient = await pool.connect();
        await errorClient.query(`
          UPDATE scheduled_migrations
          SET status = 'failed', completed_at = CURRENT_TIMESTAMP, result = $1
          WHERE id = $2
        `, [JSON.stringify({ error: err.message }), pendingMigration.id]);
        errorClient.release();
      } catch (updateErr) {
        console.error('[cron/migrate-wordlist] Failed to update migration status:', updateErr);
      }
    }

    return res.status(500).json({
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
};
