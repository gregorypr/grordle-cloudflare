// Cloudflare Pages Function: completed-golf-rounds handler

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

export async function completedGolfRoundsHandler(c) {
  const sql = c.get("sql");
  const org_id = c.get("org_id");

  try {
    const date = c.req.query("date") || getAustralianDate();

    // Get all completed rounds for today (tenant-scoped)
    const roundsResult = await sql(
      `SELECT
        p.player_name,
        gr.id as round_id,
        gr.total_score,
        json_agg(
          json_build_object(
            'hole_number', gh.hole_number,
            'target_word', gh.target_word,
            'start_word', gh.start_word,
            'par', gh.par,
            'attempts', gh.attempts,
            'score', gh.score,
            'guesses', gh.guesses
          ) ORDER BY gh.hole_number
        ) as holes
       FROM golf_rounds gr
       JOIN players p ON gr.player_id = p.id
       LEFT JOIN golf_holes gh ON gr.id = gh.round_id
       WHERE gr.is_completed = TRUE
         AND (gr.started_at AT TIME ZONE 'UTC' AT TIME ZONE 'Australia/Sydney')::date = $1::date
         AND COALESCE(gr.org_id, 0) = COALESCE($2, 0)
       GROUP BY p.player_name, gr.id, gr.total_score
       ORDER BY gr.total_score ASC, p.player_name ASC`,
      [date, org_id]
    );

    // Get all registered players for "not yet played" section
    const allPlayersResult = await sql(
      `SELECT player_name as name
       FROM players
       WHERE COALESCE(org_id, 0) = COALESCE($1, 0)
       ORDER BY LOWER(player_name)`,
      [org_id]
    );

    return c.json({
      ok: true,
      rounds: roundsResult,
      allPlayers: allPlayersResult
    });
  } catch (err) {
    console.error("completed-golf-rounds function error", err);
    return c.json({
      error: "Server error in completed-golf-rounds",
      details: err.message
    }, 500);
  }
}
