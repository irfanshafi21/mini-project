import { Router } from 'express';
import { generateSyllabusPaper, syllabusBody } from '../syllabusGenerator.js';

import { z } from 'zod';
import { requireRegisteredSubject, recordGeneratedPaper } from './subjects.js';
import { query } from '../db.js';
import { normalizeName } from '../validation.js';

const router = Router();
router.post('/papers/from-syllabus', async (req, res) => {
  const body = syllabusBody.parse(req.body);
  await requireRegisteredSubject(body.subject);
  const result = await generateSyllabusPaper(body);
  await recordGeneratedPaper(body.subject, result.paper.questions.length, 'syllabus');
  res.json({ ...result, savedUnit: body.unit });
});

const saveBody = z.object({
  subject: z.string().trim().min(1).max(60).transform(normalizeName),
  unit: z.number().int().min(1).max(5),
  questions: z.array(z.object({
    topic: z.string().trim().min(1).max(200), subtopic: z.string().trim().min(1).max(200),
    text: z.string().trim().min(10).max(2000), marks: z.number().int().min(1).max(100),
    difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']),
  })).min(1).max(50),
});

router.post('/papers/save-syllabus', async (req, res) => {
  const body = saveBody.parse(req.body);
  await requireRegisteredSubject(body.subject);
  const questions = body.questions.map(q => ({ ...q, topic: normalizeName(q.topic).slice(0, 60),
    subtopic: normalizeName(q.subtopic).slice(0, 60) }));
  const { rows } = await query(`WITH inserted AS (
    INSERT INTO questions(subject, unit, topic, subtopic, text, marks, difficulty)
    SELECT $1, $2, q.topic, q.subtopic, q.text, q.marks, q.difficulty
    FROM jsonb_to_recordset($3::jsonb) AS q(topic text, subtopic text, text text, marks smallint, difficulty text)
    ON CONFLICT DO NOTHING RETURNING id
  ) SELECT count(*)::int AS saved FROM inserted`, [body.subject, body.unit, JSON.stringify(questions)]);
  const saved = rows[0].saved;
  res.json({ savedToBank: saved, alreadyInBank: questions.length - saved, savedUnit: body.unit });
});
export default router;
