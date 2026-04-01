import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { isPathWritable, isPathDeletable } from '../lib/paths.js';
import { estimateTokens } from '../lib/tokens.js';

const router = Router();

router.get('/file', (req, res) => {
  const filePath = req.query.path as string;
  if (!filePath) return res.status(400).json({ error: 'path required' });

  const resolved = path.resolve(filePath);
  try {
    const stat = fs.statSync(resolved);
    const content = fs.readFileSync(resolved, 'utf-8');
    res.json({
      content,
      sizeBytes: stat.size,
      modified: stat.mtime.toISOString(),
      tokens: estimateTokens(content),
    });
  } catch {
    res.status(404).json({ error: 'File not found' });
  }
});

router.put('/file', (req, res) => {
  const filePath = req.query.path as string;
  if (!filePath) return res.status(400).json({ error: 'path required' });

  const resolved = path.resolve(filePath);
  if (!isPathWritable(resolved)) {
    return res.status(403).json({ error: 'Path not in writable allowlist' });
  }

  const { content } = req.body;
  if (typeof content !== 'string') {
    return res.status(400).json({ error: 'content must be a string' });
  }

  try {
    const dir = path.dirname(resolved);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(resolved, content, 'utf-8');
    const stat = fs.statSync(resolved);
    res.json({
      sizeBytes: stat.size,
      tokens: estimateTokens(content),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to write file' });
  }
});

router.delete('/file', (req, res) => {
  const filePath = req.query.path as string;
  if (!filePath) return res.status(400).json({ error: 'path required' });

  const resolved = path.resolve(filePath);
  if (!isPathDeletable(resolved)) {
    return res.status(403).json({ error: 'Path not deletable' });
  }

  try {
    const filename = path.basename(resolved);
    fs.unlinkSync(resolved);

    // If this is a memory file, also remove its entry from MEMORY.md
    const dir = path.dirname(resolved);
    const memoryIndex = path.join(dir, 'MEMORY.md');
    if (resolved.includes('/memory/') && filename !== 'MEMORY.md' && fs.existsSync(memoryIndex)) {
      const indexContent = fs.readFileSync(memoryIndex, 'utf-8');
      const updatedContent = indexContent
        .split('\n')
        .filter(line => !line.includes(filename))
        .join('\n');
      fs.writeFileSync(memoryIndex, updatedContent, 'utf-8');
    }

    res.json({ deleted: true });
  } catch {
    res.status(404).json({ error: 'File not found' });
  }
});

export default router;
