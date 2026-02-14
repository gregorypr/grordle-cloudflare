// Cloudflare Pages Functions API Router using Hono
import { Hono } from "hono";
import { handle } from "hono/cloudflare-pages";
import { neon } from "@neondatabase/serverless";

// Import route handlers
import { authHandler } from "./routes/auth.js";
import { startHandler } from "./routes/start.js";
import { statusHandler } from "./routes/status.js";
import { submitHandler } from "./routes/submit.js";
import { leaderboardHandler } from "./routes/leaderboard.js";
import { saveGameHandler } from "./routes/save-game.js";
import { completedGamesHandler } from "./routes/completed-games.js";
import { validateWordHandler } from "./routes/validate-word.js";
import { wordlistHandler } from "./routes/wordlist.js";
import { gameStateHandler } from "./routes/game-state.js";
import { getTargetWordHandler } from "./routes/get-target-word.js";
import { motdHandler } from "./routes/motd.js";
import { resetPlayerStatusHandler } from "./routes/reset-player-status.js";
import { scheduleWordlistMigrationHandler } from "./routes/schedule-wordlist-migration.js";
import { resetPasswordHandler } from "./routes/reset-password.js";
import { deleteUserHandler } from "./routes/delete-user.js";
import { resetAllDataHandler } from "./routes/reset-all-data.js";
import { editDailyScoreHandler } from "./routes/edit-daily-score.js";
import { editGolfScoreHandler } from "./routes/edit-golf-score.js";
import { wordVotesHandler } from "./routes/word-votes.js";
import { manageOrganizationsHandler } from "./routes/manage-organizations.js";
import { tenantSettingsHandler } from "./routes/tenant-settings.js";
import { yesterdayWinnersHandler } from "./routes/yesterday-winners.js";

// Golf routes
import { golfStartHandler } from "./routes/golf-start.js";
import { golfGetHoleHandler } from "./routes/golf-get-hole.js";
import { golfNextHoleHandler } from "./routes/golf-next-hole.js";
import { golfSubmitHandler } from "./routes/golf-submit.js";
import { golfSaveGuessesHandler } from "./routes/golf-save-guesses.js";
import { golfLeaderboardHandler } from "./routes/golf-leaderboard.js";
import { golfGameStateHandler } from "./routes/golf-game-state.js";

// Create Hono app
const app = new Hono().basePath("/api");

// Middleware to inject database connection
app.use("*", async (c, next) => {
  const sql = neon(c.env.DATABASE_URL);
  c.set("sql", sql);
  await next();
});

// Middleware to detect tenant/organization from subdomain
app.use("*", async (c, next) => {
  const sql = c.get("sql");
  let org_id = null; // Default tenant (grordle.com)

  try {
    const host = c.req.header('host') || '';

    // Check if subdomain exists (e.g., friends.grordle.com)
    // Ignore 'www' and non-subdomain cases
    if (host.includes('.grordle.com') && !host.startsWith('www.') && host !== 'grordle.com') {
      const subdomain = host.split('.')[0];

      // Look up organization by slug
      const orgResult = await sql(
        'SELECT id FROM organizations WHERE slug = $1',
        [subdomain]
      );

      if (orgResult.length === 0) {
        // Return error for all requests if slug does not exist
        return c.text('Tenant not found for subdomain.', 404);
      }
      org_id = orgResult[0].id;
    }
    // Could also check for custom domains here
    else if (host && host !== 'grordle.com' && host !== 'localhost:3000' && !host.includes('.pages.dev')) {
      const orgResult = await sql(
        'SELECT id FROM organizations WHERE domain = $1',
        [host]
      );

      if (orgResult.length === 0) {
        // Return error for all requests if domain does not exist
        return c.text('Tenant not found for custom domain.', 404);
      }
      org_id = orgResult[0].id;
    }
  } catch (err) {
    console.error('Error detecting tenant:', err);
    // Return error for all requests if tenant detection fails
    return c.text('Tenant detection error.', 500);
  }

  c.set("org_id", org_id);
  await next();
});

// Auth routes
app.post("/auth", authHandler);

// Game routes
app.post("/start", startHandler);
app.get("/status", statusHandler);
app.post("/status", statusHandler);
app.post("/submit", submitHandler);
app.get("/leaderboard", leaderboardHandler);
app.post("/save-game", saveGameHandler);
app.get("/completed-games", completedGamesHandler);
app.get("/game-state", gameStateHandler);
app.get("/get-target-word", getTargetWordHandler);
app.get("/motd", motdHandler);
app.post("/motd", motdHandler);
app.post("/reset-player-status", resetPlayerStatusHandler);
app.get("/schedule-wordlist-migration", scheduleWordlistMigrationHandler);
app.post("/schedule-wordlist-migration", scheduleWordlistMigrationHandler);
app.delete("/schedule-wordlist-migration", scheduleWordlistMigrationHandler);

// Admin routes
app.post("/reset-password", resetPasswordHandler);
app.post("/delete-user", deleteUserHandler);
app.post("/reset-all-data", resetAllDataHandler);
app.post("/edit-daily-score", editDailyScoreHandler);
app.post("/edit-golf-score", editGolfScoreHandler);
app.all("/word-votes", wordVotesHandler);

// Organization management (super admin)
app.get("/manage-organizations", manageOrganizationsHandler);
app.post("/manage-organizations", manageOrganizationsHandler);
app.put("/manage-organizations", manageOrganizationsHandler);
app.delete("/manage-organizations", manageOrganizationsHandler);

// Tenant settings (tenant admin)
app.get("/tenant-settings", tenantSettingsHandler);
app.put("/tenant-settings", tenantSettingsHandler);
app.post("/tenant-settings", tenantSettingsHandler);

// Yesterday's winners
app.get("/yesterday-winners", yesterdayWinnersHandler);

// Word routes
app.post("/validate-word", validateWordHandler);
app.get("/wordlist", wordlistHandler);
app.post("/wordlist", wordlistHandler);

// Golf routes
app.post("/golf-start", golfStartHandler);
app.post("/golf-get-hole", golfGetHoleHandler);
app.post("/golf-next-hole", golfNextHoleHandler);
app.post("/golf-submit", golfSubmitHandler);
app.post("/golf-save-guesses", golfSaveGuessesHandler);
app.get("/golf-leaderboard", golfLeaderboardHandler);
app.post("/golf-game-state", golfGameStateHandler);

// 404 handler
app.all("*", (c) => {
  return c.json({ error: "Not Found" }, 404);
});

// Export for Cloudflare Pages Functions
export const onRequest = handle(app);
