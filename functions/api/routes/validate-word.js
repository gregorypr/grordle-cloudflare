// Cloudflare Pages Function: validate-word handler

export async function validateWordHandler(c) {
  const sql = c.get("sql");

  try {
    const body = await c.req.json();
    const { word } = body;

    if (!word || typeof word !== "string") {
      return c.json({ error: "Word is required" }, 400);
    }

    const upperWord = word.toUpperCase().trim();

    if (!/^[A-Z]{5}$/.test(upperWord)) {
      return c.json({ valid: false, word: upperWord });
    }

    // Single query with LEFT JOIN to get both validation and curated data
    const result = await sql(
      `SELECT
        v.word,
        w.difficulty,
        w.par
       FROM validation_words v
       LEFT JOIN wordlist w ON v.word = w.word
       WHERE v.word = $1`,
      [upperWord]
    );

    if (result.length > 0) {
      return c.json({
        valid: true,
        word: upperWord,
        difficulty: result[0].difficulty,
        par: result[0].par
      });
    }

    // Word not found in validation list
    return c.json({ valid: false, word: upperWord });
  } catch (err) {
    console.error("validate-word function error", err);
    return c.json({
      error: "Server error in validate-word",
      details: err.message
    }, 500);
  }
}
