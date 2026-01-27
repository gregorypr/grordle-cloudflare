// Local development server for debugging API functions
import express from 'express';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(express.json());

// Helper to wrap Vercel-style handlers
const wrapHandler = (handler) => async (req, res) => {
  try {
    const response = await handler(req, res);
    if (response && !res.headersSent) {
      res.status(response.statusCode || 200).json(response.body);
    }
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Import and mount API routes
const routes = [
  'auth',
  'start',
  'status',
  'submit',
  'leaderboard',
  'save-game',
  'completed-games',
  'golf-start',
  'golf-get-hole',
  'golf-next-hole',
  'golf-submit',
  'golf-save-guesses',
  'golf-leaderboard',
  'get-par-distribution'
];

// Dynamically import and mount each API function
for (const route of routes) {
  const modulePath = join(__dirname, 'api', `${route}.js`);
  try {
    const module = await import(modulePath);
    const handler = module.default || module.handler;
    if (handler) {
      app.all(`/api/${route}`, wrapHandler(handler));
      console.log(`✓ Mounted /api/${route}`);
    }
  } catch (error) {
    console.warn(`⚠ Could not load ${route}:`, error.message);
  }
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n🚀 Local API server running on http://localhost:${PORT}`);
  console.log(`📊 Database: ${process.env.DATABASE_URL}\n`);
});
