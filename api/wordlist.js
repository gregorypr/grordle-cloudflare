// api/wordlist.js
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

export default async (req, res) => {
  try {
    if (!connectionString) {
      throw new Error("DATABASE_URL not set");
    }

    // GET: query wordlist
    if (req.method === "GET") {
      const { par, word, limit = 100, random } = req.query;

      let query = "SELECT word, difficulty, scrabble_score, par FROM wordlist";
      const conditions = [];
      const params = [];
      let paramIndex = 1;

      // Filter by specific word
      if (word) {
        conditions.push(`word = $${paramIndex}`);
        params.push(word.toUpperCase());
        paramIndex++;
      }

      // Filter by PAR
      if (par) {
        const parValue = parseInt(par);
        if ([3, 4, 5].includes(parValue)) {
          conditions.push(`par = $${paramIndex}`);
          params.push(parValue);
          paramIndex++;
        }
      }

      if (conditions.length > 0) {
        query += " WHERE " + conditions.join(" AND ");
      }

      // Random selection
      if (random === "true") {
        query += " ORDER BY RANDOM()";
      } else {
        query += " ORDER BY difficulty ASC";
      }

      // Limit results
      const limitValue = Math.min(parseInt(limit) || 100, 1000);
      query += ` LIMIT $${paramIndex}`;
      params.push(limitValue);

      const result = await pool.query(query, params);

      return res.status(200).json({
        words: result.rows,
        count: result.rowCount
      });
    }

    // POST: get word details for multiple words
    if (req.method === "POST") {
      const { words } = req.body || {};

      if (!Array.isArray(words) || words.length === 0) {
        return res.status(400).json({ error: "words array required" });
      }

      const upperWords = words.map(w => String(w).toUpperCase());
      const placeholders = upperWords.map((_, i) => `$${i + 1}`).join(", ");

      const query = `
        SELECT word, difficulty, scrabble_score, par
        FROM wordlist
        WHERE word IN (${placeholders})
      `;

      const result = await pool.query(query, upperWords);

      return res.status(200).json({
        words: result.rows,
        count: result.rowCount
      });
    }

    return res.status(405).send("Method Not Allowed");
  } catch (err) {
    console.error("wordlist function error", err);
    return res.status(500).json({
      error: "Server error in wordlist",
      details: err.message
    });
  }
};
