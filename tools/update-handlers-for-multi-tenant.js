// Helper script to update route handlers for multi-tenant support
// This script provides guidance and checks for updating handlers

import fs from 'fs';
import path from 'path';

const routesDir = 'functions/api/routes';

// Files that need org_id context
const filesToUpdate = [
  // Game routes
  'submit.js',
  'save-game.js',
  'completed-games.js',
  'leaderboard.js',

  // Golf routes
  'golf-start.js',
  'golf-get-hole.js',
  'golf-next-hole.js',
  'golf-submit.js',
  'golf-save-guesses.js',
  'golf-leaderboard.js',
  'golf-game-state.js',

  // Admin routes
  'reset-player-status.js',
  'reset-password.js',
  'delete-user.js',
  'reset-all-data.js',
  'edit-daily-score.js',
  'edit-golf-score.js',
];

// Patterns to look for
const patterns = {
  needsOrgIdContext: /export async function \w+Handler\(c\) \{\s*const sql = c\.get\("sql"\);/,
  playerQuery: /SELECT.*FROM players WHERE/gi,
  gameQuery: /SELECT.*FROM games WHERE/gi,
  golfRoundsQuery: /SELECT.*FROM golf_rounds WHERE/gi,
  insertPlayer: /INSERT INTO players \(/gi,
  insertGame: /INSERT INTO games \(/gi,
  insertGolfRound: /INSERT INTO golf_rounds \(/gi,
};

console.log('🔍 Scanning route handlers for multi-tenant updates needed...\n');

for (const file of filesToUpdate) {
  const filePath = path.join(routesDir, file);

  if (!fs.existsSync(filePath)) {
    console.log(`⏭️  ${file} - File not found, skipping`);
    continue;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const issues = [];

  // Check if org_id context is added
  if (!content.includes('c.get("org_id")')) {
    issues.push('❌ Missing org_id context: Add `const org_id = c.get("org_id");`');
  }

  // Check for player queries
  const playerMatches = content.match(patterns.playerQuery);
  if (playerMatches) {
    const hasOrgFilter = content.includes('COALESCE(org_id, 0)') ||
                         content.includes('org_id =') ||
                         content.includes('org_id IS NULL');
    if (!hasOrgFilter) {
      issues.push(`⚠️  Found ${playerMatches.length} player quer${playerMatches.length > 1 ? 'ies' : 'y'} - may need org_id filtering`);
    }
  }

  // Check for game queries
  const gameMatches = content.match(patterns.gameQuery);
  if (gameMatches) {
    const hasOrgFilter = content.includes('COALESCE(org_id, 0)') ||
                         content.includes('org_id =') ||
                         content.includes('org_id IS NULL');
    if (!hasOrgFilter) {
      issues.push(`⚠️  Found ${gameMatches.length} game quer${gameMatches.length > 1 ? 'ies' : 'y'} - may need org_id filtering`);
    }
  }

  // Check for golf_rounds queries
  const golfMatches = content.match(patterns.golfRoundsQuery);
  if (golfMatches) {
    const hasOrgFilter = content.includes('COALESCE(org_id, 0)') ||
                         content.includes('org_id =') ||
                         content.includes('org_id IS NULL');
    if (!hasOrgFilter) {
      issues.push(`⚠️  Found ${golfMatches.length} golf_rounds quer${golfMatches.length > 1 ? 'ies' : 'y'} - may need org_id filtering`);
    }
  }

  // Report
  if (issues.length === 0) {
    console.log(`✅ ${file} - Looks good`);
  } else {
    console.log(`📝 ${file}:`);
    issues.forEach(issue => console.log(`   ${issue}`));
  }
  console.log('');
}

console.log('\n📚 Reference: See MULTI_TENANT_STATUS.md for update pattern');
console.log('🔧 Update pattern:');
console.log('   1. Add: const org_id = c.get("org_id");');
console.log('   2. Filter players: WHERE COALESCE(org_id, 0) = COALESCE($N, 0)');
console.log('   3. Filter games: WHERE COALESCE(org_id, 0) = COALESCE($N, 0)');
console.log('   4. Filter golf_rounds: WHERE COALESCE(org_id, 0) = COALESCE($N, 0)');
console.log('   5. Add org_id to INSERT statements');
