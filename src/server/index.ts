import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import discoveryRouter from './routes/discovery.js';
import filesRouter from './routes/files.js';
import memoriesRouter from './routes/memories.js';
import settingsRouter from './routes/settings.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3456;

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

// API routes
app.use('/api', discoveryRouter);
app.use('/api', filesRouter);
app.use('/api', memoriesRouter);
app.use('/api', settingsRouter);

// Serve static frontend in production
const clientDist = path.join(__dirname, '..', 'dist', 'client');
app.use(express.static(clientDist));
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

app.listen(PORT, '127.0.0.1');
