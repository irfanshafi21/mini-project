import { Router } from 'express';
import { generateSyllabusPaper, syllabusBody } from '../syllabusGenerator.js';

import { requireRegisteredSubject } from './subjects.js';
import { query } from '../db.js';
import { normalizeName } from '../validation.js';

const router = Router();
router.post('/papers/from-syllabus', async (req, res) => {
  const body = syllabusBody.parse(req.body);
  await requireRegisteredSubject(body.subject);
  const result = await generateSyllabusPaper(body);
  const questions = result.paper.questions.map(q => ({ topic: normalizeName(q.topic).slice(0, 60),
    subtopic: normalizeName(q.subtopic).slice(0, 60), text: q.text, marks: q.marks, difficulty: q.difficulty }));
  // One statement keeps saving the full paper and updating its activity atomic.
  const { rows } = await query(`WITH inserted AS (
    INSERT INTO questions(subject, unit, topic, subtopic, text, marks, difficulty)
    SELECT $1, $2, q.topic, q.subtopic, q.text, q.marks, q.difficulty
    FROM jsonb_to_recordset($3::jsonb) AS q(topic text, subtopic text, text text, marks smallint, difficulty text)
    ON CONFLICT DO NOTHING RETURNING id
  ), activity AS (
    UPDATE subjects SET syllabus_questions = syllabus_questions + $4,
      generated_papers = generated_papers + 1 WHERE name = $1 RETURNING name
  ) SELECT count(*)::int AS saved FROM inserted`, [body.subject, body.unit, JSON.stringify(questions), questions.length]);
  const saved = rows[0].saved;
  res.json({ ...result, savedToBank: saved, alreadyInBank: questions.length - saved, savedUnit: body.unit });
});
export default router;
