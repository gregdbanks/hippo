import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { REPO_ROOT } from '../lib/paths.js';
import { estimateTokens } from '../lib/tokens.js';

const router = Router();

router.get('/docs', (_req, res) => {
  try {
    const files = fs.readdirSync(REPO_ROOT)
      .filter(f => f.endsWith('.md'))
      .map(f => {
        const filePath = path.join(REPO_ROOT, f);
        const stat = fs.statSync(filePath);
        const content = fs.readFileSync(filePath, 'utf-8');
        return {
          filename: f,
          path: filePath,
          sizeBytes: stat.size,
          tokens: estimateTokens(content),
          modified: stat.mtime.toISOString(),
        };
      });
    res.json(files);
  } catch {
    res.status(500).json({ error: 'Failed to read docs' });
  }
});

export default router;
