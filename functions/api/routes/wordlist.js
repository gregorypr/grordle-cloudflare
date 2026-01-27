// Cloudflare Pages Function: wordlist handler

export async function wordlistHandler(c) {
  const sql = c.get("sql");
  const method = c.req.method;

  try {
    // Handle POST: get word details for multiple words
    if (method === "POST") {
      const body = await c.req.json();
      const { words } = body || {};

      if (!Array.isArray(words) || words.length === 0) {
        return c.json({ error: "words array required" }, 400);
      }

      const upperWords = words.map(w => String(w).toUpperCase());
      const placeholders = upperWords.map((_, i) => `$${i + 1}`).join(", ");

      const query = `
        SELECT word, difficulty, scrabble_score, par
        FROM wordlist
        WHERE word IN (${placeholders})
      `;

      const result = await sql(query, upperWords);

      return c.json({
        words: result,
        count: result.length
      });
    }

    // GET: query wordlist
    const par = c.req.query("par");
    const word = c.req.query("word");
    const limit = c.req.query("limit") || "100";
    const random = c.req.query("random");

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

    const result = await sql(query, params);

    return c.json({
      words: result,
      count: result.length
    });
  } catch (err) {
    console.error("wordlist function error", err);
    return c.json({
      error: "Server error in wordlist",
      details: err.message
    }, 500);
  }
}
