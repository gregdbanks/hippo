import { Router } from 'express';
import { getMemories } from '../lib/discover.js';

const router = Router();

router.get('/memories/:slug', (req, res) => {
  try {
    const memories = getMemories(req.params.slug);
    res.json(memories);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read memories' });
  }
});

export default router;
