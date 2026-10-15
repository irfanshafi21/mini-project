import { Router } from 'express';
import { generateSyllabusPaper, syllabusBody } from '../syllabusGenerator.js';

import { z } from 'zod';
import { requireRegisteredSubject, recordGeneratedPaper } from './subjects.js';
import { query } from '../db.js';
import { normalizeName } from '../validation.js';
import { extractSyllabusText, questionHash } from '../localModel.js';

const router = Router();
router.post('/papers/from-syllabus', async (req, res) => {
  const body = syllabusBody.parse(req.body);
  await requireRegisteredSubject(body.subject);
  const local = (process.env.AI_PROVIDER || 'local') === 'local';
  let syllabusHash;
  if(local) {
    body.preparedText = await extractSyllabusText(body);
    syllabusHash = questionHash(body.preparedText);
    body.previousQuestionHashes = (await query('SELECT question_hash FROM syllabus_history WHERE subject=$1 AND syllabus_hash=$2',[body.subject,syllabusHash])).rows.map(row=>row.question_hash);
  }
  const result = await generateSyllabusPaper(body);
  if(local) {
    const hashes=result.paper.questions.map(q=>questionHash(q.text));
    const reserved=await query(`INSERT INTO syllabus_history(subject,syllabus_hash,question_hash)
      SELECT $1,$2,h FROM unnest($3::text[]) h ON CONFLICT DO NOTHING RETURNING question_hash`,[body.subject,syllabusHash,hashes]);
    if(reserved.rows.length!==hashes.length) return res.status(409).json({error:'Another request used these variations. Generate again to select unused questions.'});
  }
  await recordGeneratedPaper(body.subject, result.paper.questions.length, 'syllabus');
  res.json({ ...result, savedUnit: body.unit });
});

const saveBody = z.object({
  subject: z.string().trim().min(1).max(60).transform(normalizeName),
  unit: z.number().int().min(1).max(5).optional(),
  questions: z.array(z.object({
    topic: z.string().trim().min(1).max(200), subtopic: z.string().trim().min(1).max(200),
    text: z.string().trim().min(10).max(2000), marks: z.number().int().min(1).max(100),
    difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']),
    unit: z.number().int().min(1).max(5).optional(),
  })).min(1).max(50),
});

router.post('/papers/save-syllabus', async (req, res) => {
  const body = saveBody.parse(req.body);
  await requireRegisteredSubject(body.subject);
  const questions = body.questions.map(q => ({ ...q, unit:q.unit || body.unit || 1, topic: normalizeName(q.topic).slice(0, 60),
    subtopic: normalizeName(q.subtopic).slice(0, 60) }));
  const { rows } = await query(`WITH inserted AS (
    INSERT INTO questions(subject, unit, topic, subtopic, text, marks, difficulty)
    SELECT $1, q.unit, q.topic, q.subtopic, q.text, q.marks, q.difficulty
    FROM jsonb_to_recordset($2::jsonb) AS q(unit smallint, topic text, subtopic text, text text, marks smallint, difficulty text)
    ON CONFLICT DO NOTHING RETURNING id
  ) SELECT count(*)::int AS saved FROM inserted`, [body.subject, JSON.stringify(questions)]);
  const saved = rows[0].saved;
  res.json({ savedToBank: saved, alreadyInBank: questions.length - saved, savedUnit: body.unit });
});
export default router;
