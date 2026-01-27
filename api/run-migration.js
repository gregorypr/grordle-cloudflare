// api/run-migration.js
// TEMPORARY endpoint to run a migration from the API (remove after use!)

import { up as migrateWordVotes } from '../migrations/add-word-votes-table.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    await migrateWordVotes();
    res.status(200).json({ success: true, message: 'Migration completed.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}
