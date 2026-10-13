import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { HttpError } from '../errors.js';
import { normalizeName } from '../validation.js';

const router = Router();
const subjectBody = z.object({ name: z.string().trim().min(1).max(60).transform(normalizeName) });

export async function requireRegisteredSubject(name) {
  const { rows } = await query('SELECT name FROM subjects WHERE name = $1', [name]);
  if (!rows.length) throw new HttpError(400, 'Register this subject in Subjects before using it.');
}

router.post('/', async (req, res) => {
  const { name } = subjectBody.parse(req.body);
  const { rows } = await query('INSERT INTO subjects (name) VALUES ($1) ON CONFLICT (name) DO NOTHING RETURNING name', [name]);
  if (!rows.length) return res.status(409).json({ error: 'This subject already exists' });
  res.status(201).json({ name: rows[0].name });
});

export default router;
