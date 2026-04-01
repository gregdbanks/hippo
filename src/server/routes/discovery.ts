import { Router } from 'express';
import { discover } from '../lib/discover.js';

const router = Router();

router.get('/discovery', (_req, res) => {
  try {
    const result = discover();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to discover config files' });
  }
});

export default router;
