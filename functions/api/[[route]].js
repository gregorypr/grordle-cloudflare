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
