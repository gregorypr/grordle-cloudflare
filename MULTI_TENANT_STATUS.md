# Multi-Tenant Implementation Status

## Completed ✓

### 1. Database Migration
- ✅ Created `migrations/001-add-multi-tenant-support.sql`
- ✅ Added `organizations` table
- ✅ Added `org_id` columns to `players`, `games`, `golf_rounds`
- ✅ Added indexes for performance
- ✅ Updated unique constraints to be tenant-aware
- ✅ Created migration runner script

### 2. Middleware
- ✅ Added tenant detection middleware to `functions/api/[[route]].js`
- ✅ Detects subdomain (e.g., friends.grordle.com)
- ✅ Detects custom domains
- ✅ Sets `org_id` in context (NULL = default tenant)

### 3. Utility Functions
- ✅ Created `functions/api/utils/tenant.js` with helper functions

### 4. Route Handlers Updated
- ✅ `auth.js` - Registration and login filtered by tenant
- ✅ `status.js` - Player lists and scores filtered by tenant
- ✅ `start.js` - Game and player creation tenant-aware

## Remaining Work

### Route Handlers to Update

**Game Routes:**
- ⏳ `submit.js` - Add org_id context, filter player lookup
- ⏳ `save-game.js` - Add org_id context
- ⏳ `completed-games.js` - Filter by org_id
- ⏳ `leaderboard.js` - Filter by org_id
- ⏳ `validate-word.js` - No changes needed (wordlist is shared)
- ⏳ `get-target-word.js` - No changes needed (wordlist is shared)
- ⏳ `game-state.js` - No changes needed (wordlist is shared)
- ⏳ `wordlist.js` - No changes needed (shared)
- ⏳ `motd.js` - Could be tenant-specific or shared (decide)

**Golf Routes:**
- ⏳ `golf-start.js` - Add org_id to golf_rounds creation
- ⏳ `golf-get-hole.js` - Filter golf_rounds by org_id
- ⏳ `golf-next-hole.js` - Filter golf_rounds by org_id
- ⏳ `golf-submit.js` - Filter golf_rounds by org_id
- ⏳ `golf-save-guesses.js` - Filter golf_rounds by org_id
- ⏳ `golf-leaderboard.js` - Filter by org_id
- ⏳ `golf-game-state.js` - Filter by org_id

**Admin Routes:**
- ⏳ `reset-player-status.js` - Filter by org_id
- ⏳ `reset-password.js` - Filter by org_id
- ⏳ `delete-user.js` - Filter by org_id
- ⏳ `reset-all-data.js` - Filter by org_id (DANGEROUS - needs org scoping!)
- ⏳ `edit-daily-score.js` - Filter by org_id
- ⏳ `edit-golf-score.js` - Filter by org_id

### Admin UI
- ⏳ Add tenant management section
- ⏳ Create new organization interface
- ⏳ List organizations
- ⏳ Tenant-specific admin password

### Testing
- ⏳ Run migration on dev database
- ⏳ Test existing grordle.com still works (org_id = NULL)
- ⏳ Create test organization
- ⏳ Test subdomain routing
- ⏳ Verify data isolation between tenants

## Update Pattern for Remaining Handlers

For each handler file, follow this pattern:

```javascript
// 1. Add org_id to context
export async function handlerName(c) {
  const sql = c.get("sql");
  const org_id = c.get("org_id"); // Add this line

  // 2. Update player lookups
  // Before:
  await sql('SELECT * FROM players WHERE player_name = $1', [name]);

  // After:
  await sql(
    'SELECT * FROM players WHERE player_name = $1 AND COALESCE(org_id, 0) = COALESCE($2, 0)',
    [name, org_id]
  );

  // 3. Update game lookups
  // Before:
  await sql('SELECT * FROM games WHERE play_date = $1', [date]);

  // After:
  await sql(
    'SELECT * FROM games WHERE play_date = $1 AND COALESCE(org_id, 0) = COALESCE($2, 0)',
    [date, org_id]
  );

  // 4. Update golf_rounds lookups
  // Before:
  await sql('SELECT * FROM golf_rounds WHERE player_id = $1', [playerId]);

  // After:
  await sql(
    'SELECT * FROM golf_rounds WHERE player_id = $1 AND COALESCE(org_id, 0) = COALESCE($2, 0)',
    [playerId, org_id]
  );
}
```

## Deployment Steps

1. **Run Migration**
   ```bash
   node tools/run-migration.js migrations/001-add-multi-tenant-support.sql
   ```

2. **Update Remaining Handlers** (see pattern above)

3. **Deploy to Cloudflare**
   ```bash
   npm run build
   npx wrangler pages deploy dist --project-name=grordle-cloudflare
   ```

4. **Test Default Tenant**
   - Visit grordle.com
   - Verify existing users can login
   - Play a game
   - Check leaderboard

5. **Create Test Organization**
   ```sql
   INSERT INTO organizations (slug, name) VALUES ('test', 'Test Organization');
   ```

6. **Configure Subdomain**
   - In Cloudflare Pages, add custom domain: `test.grordle.com`
   - Point to same deployment

7. **Test New Tenant**
   - Visit test.grordle.com
   - Register new user
   - Verify isolated from grordle.com users

## Notes

- Wordlist is SHARED across all tenants
- Daily start words are SHARED (all tenants get same start word per date)
- Validation words are SHARED
- NULL org_id = default tenant (grordle.com)
- All new tenants get sequential org_id (1, 2, 3, ...)
