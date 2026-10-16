import { classifyBloom } from '../blooms.js';
import { Router } from 'express';
import { query } from '../db.js';
import { HttpError, notFound } from '../errors.js';
import { toApi } from '../mapper.js';
import { listQuery, parseId, questionBody } from '../validation.js';

import { requireRegisteredSubject } from './subjects.js';

const router = Router();

const idFrom = (req) => {
  const id = parseId(req.params.id);
  if (id === null) throw new HttpError(400, 'Invalid question number (use 101 or Q101)');
  return id;
};

// GET /api/questions?unit=1&topic=java&difficulty=medium&marks=5&q=stack&page=1&limit=20
router.get('/', async (req, res) => {
  const f = listQuery.parse(req.query);
  if (f.subject) await requireRegisteredSubject(f.subject);
  const where = ['NOT is_deleted'];
  const params = [];
  const add = (sql, value) => {
    params.push(value);
    where.push(sql.replace('$?', `$${params.length}`));
  };
  if (f.unit) add('unit = $?', f.unit);
  if (f.subject) add('subject = $?', f.subject);
  if (f.topic) add('topic = $?', f.topic);
  if (f.subtopic) add('subtopic = $?', f.subtopic);
  if (f.difficulty) add('difficulty = $?', f.difficulty);
  if (f.marks) add('marks = $?', f.marks);
  if(f.bloomLevel)add('bloom_level = $?',f.bloomLevel);
  if (f.q) add('text ILIKE $?', `%${f.q}%`);
  const w = where.join(' AND ');

  const total = (await query(`SELECT count(*)::int AS n FROM questions WHERE ${w}`, params)).rows[0].n;
  const { rows } = await query(
    `SELECT * FROM questions WHERE ${w}
     ORDER BY unit, topic, marks, id
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, f.limit, (f.page - 1) * f.limit],
  );
  res.json({ total, page: f.page, limit: f.limit, items: rows.map(toApi) });
});

// GET /api/questions/deleted   (the "recycle bin", newest first)
router.get('/deleted', async (_req, res) => {
  const { rows } = await query('SELECT * FROM questions WHERE is_deleted ORDER BY deleted_at DESC, id DESC');
  res.json({ total: rows.length, items: rows.map(toApi) });
});

// POST /api/questions   -> manual question entry; the question number is assigned automatically
router.post('/', async (req, res) => {
  const b = questionBody.parse(req.body);
  await requireRegisteredSubject(b.subject);
  const { rows } = await query(
    `INSERT INTO questions (unit, topic, subtopic, difficulty, marks, text, subject, question_type, options, answer, bloom_level)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11) RETURNING *`,
    [b.unit, b.topic, b.subtopic, b.difficulty, b.marks, b.text, b.subject, b.questionType, JSON.stringify(b.options), b.answer,b.bloomLevel || classifyBloom(b.text)],
  );
  res.status(201).json(toApi(rows[0]));
});

// POST /api/questions/undo   -> restores the most recently deleted question (like the Stack in Java)
router.post('/undo', async (_req, res) => {
  const { rows } = await query(
    `UPDATE questions SET is_deleted = FALSE, deleted_at = NULL, updated_at = now()
     WHERE id = (SELECT id FROM questions WHERE is_deleted ORDER BY deleted_at DESC, id DESC LIMIT 1)
     RETURNING *`,
  );
  if (!rows.length) throw new HttpError(404, 'Nothing to undo');
  res.json(toApi(rows[0]));
});

router.get('/:id', async (req, res) => {
  const { rows } = await query('SELECT * FROM questions WHERE id = $1 AND NOT is_deleted', [idFrom(req)]);
  if (!rows.length) throw notFound();
  res.json(toApi(rows[0]));
});

router.put('/:id', async (req, res) => {
  const id = idFrom(req);
  const b = questionBody.parse(req.body);
  await requireRegisteredSubject(b.subject);
  const { rows } = await query(
    `UPDATE questions
     SET unit = $2, topic = $3, subtopic = $4, difficulty = $5, marks = $6, text = $7, subject = $8, question_type=$9, options=$10::jsonb, answer=$11,bloom_level=$12, updated_at = now()
     WHERE id = $1 AND NOT is_deleted RETURNING *`,
    [id, b.unit, b.topic, b.subtopic, b.difficulty, b.marks, b.text, b.subject,b.questionType,JSON.stringify(b.options),b.answer,b.bloomLevel || classifyBloom(b.text)],
  );
  if (!rows.length) throw notFound();
  res.json(toApi(rows[0]));
});

// DELETE is a "soft delete": the row stays in the table so it can be restored
router.delete('/:id', async (req, res) => {
  const { rows } = await query(
    `UPDATE questions SET is_deleted = TRUE, deleted_at = now()
     WHERE id = $1 AND NOT is_deleted RETURNING *`,
    [idFrom(req)],
  );
  if (!rows.length) throw notFound();
  res.json(toApi(rows[0]));
});

router.post('/:id/restore', async (req, res) => {
  const { rows } = await query(
    `UPDATE questions SET is_deleted = FALSE, deleted_at = NULL, updated_at = now()
     WHERE id = $1 AND is_deleted RETURNING *`,
    [idFrom(req)],
  );
  if (!rows.length) throw new HttpError(404, 'This question is not in the deleted list');
  res.json(toApi(rows[0]));
});

export default router;
