import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function investigateJaneIssue() {
  try {
    const playerName = 'jane'; // or whatever the actual name was
    const today = '2026-01-10'; // adjust as needed
    
    console.log(`\n=== Investigating issue for player: ${playerName} on date: ${today} ===\n`);
    
    // 1. Check if player exists
    const playerCheck = await pool.query(
      `SELECT id, player_name FROM players WHERE LOWER(player_name) = LOWER($1);`,
      [playerName]
    );
    
    if (playerCheck.rowCount === 0) {
      console.log('❌ Player not found in players table');
      await pool.end();
      return;
    }
    
    const playerId = playerCheck.rows[0].id;
    console.log(`✅ Player found: ID=${playerId}, Name="${playerCheck.rows[0].player_name}"`);
    
    // 2. Get game_id for the date
    const gameCheck = await pool.query(
      `SELECT id FROM games WHERE play_date = $1;`,
      [today]
    );
    
    if (gameCheck.rowCount === 0) {
      console.log(`❌ No game found for date ${today}`);
      await pool.end();
      return;
    }
    
    const gameId = gameCheck.rows[0].id;
    console.log(`✅ Game found: ID=${gameId} for date ${today}`);
    
    // 3. Check daily_players table (this determines "already played" in start.js)
    const dailyPlayerCheck = await pool.query(
      `SELECT * FROM daily_players WHERE game_id = $1 AND player_id = $2;`,
      [gameId, playerId]
    );
    
    console.log(`\n📋 daily_players check:`);
    if (dailyPlayerCheck.rowCount > 0) {
      console.log(`  ✅ Entry EXISTS in daily_players (this causes "already played" message)`);
      console.table(dailyPlayerCheck.rows);
    } else {
      console.log(`  ❌ NO entry in daily_players (player can start game)`);
    }
    
    // 4. Check scores table (this is what admin panel shows)
    const scoresCheck = await pool.query(
      `SELECT * FROM scores WHERE game_id = $1 AND player_id = $2;`,
      [gameId, playerId]
    );
    
    console.log(`\n🎯 scores check:`);
    if (scoresCheck.rowCount > 0) {
      console.log(`  ✅ Entry EXISTS in scores (admin panel shows score)`);
      console.table(scoresCheck.rows);
    } else {
      console.log(`  ❌ NO entry in scores (admin panel shows NULL score)`);
    }
    
    // 5. Check player_games table
    const playerGamesCheck = await pool.query(
      `SELECT * FROM player_games WHERE game_id = $1 AND player_id = $2;`,
      [gameId, playerId]
    );
    
    console.log(`\n💾 player_games check:`);
    if (playerGamesCheck.rowCount > 0) {
      console.log(`  ✅ Entry EXISTS in player_games`);
      console.table(playerGamesCheck.rows);
    } else {
      console.log(`  ❌ NO entry in player_games`);
    }
    
    // 6. Summary
    console.log(`\n\n=== SUMMARY ===`);
    console.log(`The issue occurs when:`);
    console.log(`  - daily_players has entry: ${dailyPlayerCheck.rowCount > 0 ? 'YES ✅' : 'NO ❌'} (blocks login)`);
    console.log(`  - scores has entry: ${scoresCheck.rowCount > 0 ? 'YES ✅' : 'NO ❌'} (shows in admin)`);
    console.log(`  - player_games has entry: ${playerGamesCheck.rowCount > 0 ? 'YES ✅' : 'NO ❌'} (game state)`);
    
    if (dailyPlayerCheck.rowCount > 0 && scoresCheck.rowCount === 0) {
      console.log(`\n🔴 ISSUE IDENTIFIED:`);
      console.log(`Player is in daily_players but NOT in scores!`);
      console.log(`This means:`);
      console.log(`  1. Player started the game (entry added to daily_players)`);
      console.log(`  2. Player never completed/submitted the game (no entry in scores)`);
      console.log(`  3. Game thinks they already played (checks daily_players)`);
      console.log(`  4. Admin panel shows no score (checks scores table)`);
      console.log(`\nRoot cause: Player started but didn't complete. The game should either:`);
      console.log(`  A) Only add to daily_players when game is submitted, OR`);
      console.log(`  B) Allow resuming if in daily_players but not in scores`);
    }
    
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    await pool.end();
    process.exit(1);
  }
}

investigateJaneIssue();
