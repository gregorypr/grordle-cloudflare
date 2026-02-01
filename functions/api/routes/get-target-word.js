// Cloudflare Pages Function: get-target-word handler

export async function getTargetWordHandler(c) {
  const sql = c.get("sql");

  try {
    const date = c.req.query("date");

    if (!date) {
      return c.json({ error: "Date is required" }, 400);
    }

    // Get wordlist from database in insertion order (by id for stability)
    const wordlistResult = await sql(`
      SELECT word FROM wordlist
      ORDER BY id
    `);

    if (wordlistResult.length === 0) {
      return c.json({ error: "Wordlist is empty" }, 500);
    }

    const words = wordlistResult.map(row => row.word);

    // Generate seed from date string
    const dateStr = "TARGET:" + date;
    let seed = 0;
    for (let i = 0; i < dateStr.length; i++) {
      seed = (seed * 31 + dateStr.charCodeAt(i)) >>> 0;
    }

    // Select word using seed
    const index = seed % words.length;
    const targetWord = words[index];

    return c.json({
      ok: true,
      targetWord: targetWord,
      date: date,
      wordlistSize: words.length
    });
  } catch (err) {
    console.error("get-target-word function error", err);
    return c.json({
      error: "Server error in get-target-word",
      details: err.message
    }, 500);
  }
}
