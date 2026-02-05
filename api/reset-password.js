import { pool, ensureTables } from './config.js';

export default async function handler(req, res) {
  try {
    await ensureTables();
  } catch (err) {
    console.error('Error ensuring tables:', err);
    return res.status(500).json({ error: 'Server error ensuring tables' });
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { playerName } = req.body;
  if (!playerName) {
    return res.status(400).json({ error: 'playerName is required' });
  }
  try {
    // Set password_reset_required to true and clear password hash
    await pool.query(
      'UPDATE players SET password_hash = NULL, password_reset_required = TRUE WHERE LOWER(player_name) = LOWER($1)',
      [playerName]
    );
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Error resetting password:', err);
    return res.status(500).json({ error: 'Server error resetting password' });
  }
};
