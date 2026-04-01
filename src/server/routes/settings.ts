import { Router } from 'express';
import fs from 'fs';
import { SETTINGS_PATH } from '../lib/paths.js';

const router = Router();

router.get('/settings', (_req, res) => {
  try {
    const content = fs.readFileSync(SETTINGS_PATH, 'utf-8');
    const parsed = JSON.parse(content);
    res.json({ content, parsed });
  } catch {
    res.status(404).json({ error: 'Settings file not found' });
  }
});

router.put('/settings', (req, res) => {
  const { content } = req.body;
  if (typeof content !== 'string') {
    return res.status(400).json({ error: 'content must be a string' });
  }

  // Validate JSON before writing
  try {
    JSON.parse(content);
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  try {
    fs.writeFileSync(SETTINGS_PATH, content, 'utf-8');
    res.json({ saved: true });
  } catch {
    res.status(500).json({ error: 'Failed to write settings' });
  }
});

export default router;
