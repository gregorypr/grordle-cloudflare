# Deployment Guide: New Instance Setup

This guide walks you through deploying a separate instance of Grordle for a different group.

## Prerequisites

- GitHub account (if using Git deployment)
- Cloudflare account
- PostgreSQL database (we recommend [Neon](https://neon.tech/) - free tier available)

## Step 1: Create New Database

### Option A: Neon (Recommended)

1. Go to [neon.tech](https://neon.tech/) and sign up
2. Create a new project
3. Copy the connection string (starts with `postgresql://`)
4. Save it - you'll need it for Step 4

### Option B: Other PostgreSQL Providers

- [Supabase](https://supabase.com/)
- [Railway](https://railway.app/)
- Any PostgreSQL 14+ instance

## Step 2: Set Up Database Schema

Run this SQL to create all required tables:

```sql
-- Players table
CREATE TABLE IF NOT EXISTS players (
  id SERIAL PRIMARY KEY,
  player_name TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  password_reset_required BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Games table (daily games)
CREATE TABLE IF NOT EXISTS games (
  id SERIAL PRIMARY KEY,
  play_date DATE UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Daily players (who started a game on a given date)
CREATE TABLE IF NOT EXISTS daily_players (
  id SERIAL PRIMARY KEY,
  game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(game_id, player_id)
);

-- Scores table
CREATE TABLE IF NOT EXISTS scores (
  id SERIAL PRIMARY KEY,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
  attempts INTEGER NOT NULL,
  success BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Wordlist table
CREATE TABLE IF NOT EXISTS wordlist (
  id SERIAL PRIMARY KEY,
  word TEXT UNIQUE NOT NULL,
  difficulty NUMERIC,
  scrabble_score NUMERIC,
  par INTEGER
);

-- Golf rounds table
CREATE TABLE IF NOT EXISTS golf_rounds (
  id SERIAL PRIMARY KEY,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  course_date DATE NOT NULL,
  current_hole INTEGER DEFAULT 1,
  total_strokes INTEGER DEFAULT 0,
  is_completed BOOLEAN DEFAULT FALSE,
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Golf holes table
CREATE TABLE IF NOT EXISTS golf_holes (
  id SERIAL PRIMARY KEY,
  round_id INTEGER REFERENCES golf_rounds(id) ON DELETE CASCADE,
  hole_number INTEGER NOT NULL,
  target_word TEXT NOT NULL,
  par INTEGER NOT NULL,
  strokes INTEGER DEFAULT 0,
  is_completed BOOLEAN DEFAULT FALSE,
  guesses JSONB DEFAULT '[]'::jsonb,
  UNIQUE(round_id, hole_number)
);

-- Daily golf course table
CREATE TABLE IF NOT EXISTS daily_golf_course (
  id SERIAL PRIMARY KEY,
  course_date DATE NOT NULL,
  hole_number INTEGER NOT NULL,
  target_word TEXT NOT NULL,
  par INTEGER NOT NULL,
  difficulty NUMERIC,
  UNIQUE(course_date, hole_number)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_scores_player_id ON scores(player_id);
CREATE INDEX IF NOT EXISTS idx_scores_game_id ON scores(game_id);
CREATE INDEX IF NOT EXISTS idx_daily_players_game_id ON daily_players(game_id);
CREATE INDEX IF NOT EXISTS idx_daily_players_player_id ON daily_players(player_id);
CREATE INDEX IF NOT EXISTS idx_golf_rounds_player_date ON golf_rounds(player_id, course_date);
CREATE INDEX IF NOT EXISTS idx_golf_holes_round_id ON golf_holes(round_id);
CREATE INDEX IF NOT EXISTS idx_daily_golf_course_date ON daily_golf_course(course_date);
```

## Step 3: Populate Wordlist

You'll need to populate the `wordlist` table. You can:

### Option A: Use the existing wordlist data

Run the script from the project directory with your new database URL:

```bash
# Set your new database URL
export DATABASE_URL="postgresql://your-new-connection-string"

# Run the wordlist population script (you'll need to create this)
node tools/populate-wordlist.js
```

### Option B: Copy from existing database

If you have access to the current database:

```sql
-- On old database: Export
COPY (SELECT word, difficulty, scrabble_score, par FROM wordlist ORDER BY id)
TO '/tmp/wordlist.csv' WITH CSV HEADER;

-- On new database: Import
COPY wordlist(word, difficulty, scrabble_score, par)
FROM '/tmp/wordlist.csv' WITH CSV HEADER;
```

### Option C: Minimal setup for testing

```sql
-- Insert a few test words
INSERT INTO wordlist (word, difficulty, scrabble_score, par) VALUES
('HELLO', 10.5, 8, 3),
('WORLD', 12.3, 9, 3),
('GAMES', 15.2, 8, 3),
('WORDS', 18.4, 9, 4);
```

## Step 4: Set Up Cloudflare Pages

1. **Go to Cloudflare Dashboard**
   - Navigate to Pages
   - Click "Create a project"

2. **Connect to Git** (recommended)
   - Connect your GitHub account
   - Select the `grordle-cloudflare` repository
   - Or fork it first and select your fork

3. **Configure Build Settings**
   - Framework preset: **Vite**
   - Build command: `npm run build`
   - Build output directory: `dist`

4. **Environment Variables**
   - Add `DATABASE_URL` with your PostgreSQL connection string
   - Format: `postgresql://user:password@host/database?sslmode=require`

5. **Deploy**
   - Click "Save and Deploy"
   - Wait for build to complete (~2-3 minutes)

## Step 5: Custom Domain (Optional)

1. In Cloudflare Pages project settings
2. Go to "Custom domains"
3. Add your domain
4. Follow DNS configuration instructions

## Step 6: Customize Your Instance

### Change Admin Password

Edit `src/components/AdminPanel.jsx` line 50:

```javascript
const ADMIN_PASSWORD = "your-secure-password-here";
```

Commit and push to trigger redeployment.

### Branding/Styling (Optional)

- Update `index.html` for title/meta tags
- Modify colors in Tailwind classes throughout components
- Change logo/favicon in `public/` directory

## Step 7: Post-Deployment Verification

1. **Test Basic Functionality**
   - Visit your deployed URL
   - Try registering a user
   - Play a Daily game
   - Play a Golf game

2. **Test Admin Panel**
   - Access `/admin` or admin section
   - Login with admin password
   - Try viewing users
   - Test password reset

3. **Verify Database**
   - Check that users are being created
   - Verify scores are being saved
   - Confirm golf rounds work

## Maintenance

### Database Backups

Set up automated backups in your PostgreSQL provider:
- Neon: Automatic with Point-in-Time Recovery
- Supabase: Automatic daily backups
- Railway: Configure in project settings

### Monitoring

- Check Cloudflare Pages analytics for traffic
- Monitor database usage in provider dashboard
- Set up error alerts in Cloudflare

### Updates

To update your instance with new features:

```bash
git pull origin main
git push  # If using Git deployment, triggers auto-deploy
```

Or manually trigger deployment in Cloudflare Pages dashboard.

## Troubleshooting

### "500 Server Error" on API calls
- Check `DATABASE_URL` is set correctly in Cloudflare environment variables
- Verify database is accessible (not IP-restricted)
- Check Cloudflare Functions logs

### Database connection fails
- Ensure connection string includes `?sslmode=require`
- Check database is not sleeping (Neon free tier)
- Verify credentials are correct

### Build fails
- Check Node.js version (should be 18+)
- Verify all dependencies install correctly
- Review build logs in Cloudflare dashboard

### Users can't register/login
- Check `players` table exists
- Verify database permissions
- Look for errors in browser console

## Support

For issues specific to this codebase, check:
- GitHub repository issues
- Cloudflare Pages documentation
- Your database provider's docs

## Costs

**Free tier deployment:**
- Cloudflare Pages: Free (up to 500 builds/month)
- Neon: Free (0.5GB storage, always-available compute)
- **Total: $0/month** for small groups

**Paid upgrades needed if:**
- Heavy traffic (>100k requests/day)
- Large user base (>1000 active users)
- Want dedicated/faster database
