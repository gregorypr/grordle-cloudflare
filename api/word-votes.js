export default function handler(req, res) {
  res.status(404).json({ ok: false, error: 'Word voting API has been removed.' });
}
