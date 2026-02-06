-- Migration: Add Multi-Tenant Support
-- This migration adds organization/tenant support while maintaining backward compatibility
-- Existing data (org_id = NULL) represents the default tenant (grordle.com)

-- Step 1: Create organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,        -- URL slug (e.g., 'friends', 'work')
  name TEXT NOT NULL,                -- Display name
  display_name TEXT,                 -- Custom branding name (optional)
  domain TEXT UNIQUE,                -- Custom domain (optional)
  admin_password TEXT,               -- Tenant-specific admin password (deprecated - super admin has access)
  motd TEXT,                         -- Message of the day (tenant-specific)
  primary_color TEXT DEFAULT '#8b5cf6',   -- Branding: primary color (purple default)
  secondary_color TEXT DEFAULT '#7c3aed', -- Branding: secondary color
  created_at TIMESTAMP DEFAULT NOW(),
  settings JSONB DEFAULT '{}'::jsonb -- Additional tenant-specific settings
);

-- Step 2: Add org_id to existing tables (nullable for backward compatibility)
ALTER TABLE players ADD COLUMN IF NOT EXISTS org_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE games ADD COLUMN IF NOT EXISTS org_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE golf_rounds ADD COLUMN IF NOT EXISTS org_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE;

-- Step 3: Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_players_org_id ON players(org_id);
CREATE INDEX IF NOT EXISTS idx_players_org_name ON players(org_id, player_name);
CREATE INDEX IF NOT EXISTS idx_games_org_id ON games(org_id);
CREATE INDEX IF NOT EXISTS idx_games_org_date ON games(org_id, play_date);
CREATE INDEX IF NOT EXISTS idx_golf_rounds_org_id ON golf_rounds(org_id);
CREATE INDEX IF NOT EXISTS idx_golf_rounds_org_player ON golf_rounds(org_id, player_id);

-- Step 4: Update unique constraints to be tenant-aware
-- Drop old constraint, add new tenant-aware constraint
ALTER TABLE players DROP CONSTRAINT IF EXISTS players_player_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_players_name_org_unique
  ON players(LOWER(player_name), COALESCE(org_id, 0));

-- Games table: one game per date per tenant
ALTER TABLE games DROP CONSTRAINT IF EXISTS games_play_date_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_games_date_org_unique
  ON games(play_date, COALESCE(org_id, 0));

-- Step 5: Insert default tenant (optional - for tracking)
-- This represents the existing grordle.com players (org_id = NULL in data)
-- We don't actually set org_id = 1 on existing data to maintain NULL = default behavior

-- Migration complete!
-- Existing data with org_id = NULL represents default tenant (grordle.com)
-- New tenants will have org_id = 1, 2, 3, etc.
