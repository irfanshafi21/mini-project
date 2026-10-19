import cors from 'cors';
import express from 'express';
import { query } from './db.js';
import { errorHandler } from './errors.js';
import generate from './routes/generate.js';
import questions from './routes/questions.js';
import stats from './routes/stats.js';
import syllabus from './routes/syllabus.js';
import subjects from './routes/subjects.js';
import savedPapers from './routes/savedPapers.js';
import learning from './routes/learning.js';

export const app = express();

app.use(cors());           // lets the React frontend (another port) call this API
app.use('/api/papers/from-syllabus', express.json({ limit: '7mb' }));
app.use('/api/papers/saved', express.json({ limit: '256kb' }));
app.use('/api/model',express.json({limit:'256kb'}));
app.use(express.json());

app.get('/api/health', async (_req, res) => {
  await query('SELECT 1');
  const aiProvider = (process.env.AI_PROVIDER || 'local').toLowerCase();
  res.json({ status: 'ok', aiProvider, model: aiProvider === 'groq' ? process.env.GROQ_MODEL || null : 'college-local-classifier-grammar-v2' });
});

app.use('/api/model',learning);
app.use('/api/questions', questions);
app.use('/api/subjects', subjects);
app.use('/api/stats', stats);
app.use('/api/papers', savedPapers);
app.use('/api', generate);
app.use('/api', syllabus);

app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));
app.use(errorHandler);
