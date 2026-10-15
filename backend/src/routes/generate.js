import { Router } from 'express';
import { storePaper } from './savedPapers.js';
import { query } from '../db.js';
import { HttpError } from '../errors.js';
import { toApi } from '../mapper.js';
import { generatePaper } from '../javaCore.js';
import { autoBody, paperBody } from '../validation.js';

import { requireRegisteredSubject, recordGeneratedPaper } from './subjects.js';

const router = Router();

/**
 * POST /api/papers/generate
 * { "unit": 1, "topic": "java", "totalMarks": 24, "split": { "easy": 40, "medium": 40, "hard": 20 } }
 * unit 0 (or missing) = all units; topic / subtopic are optional filters.
 */
router.post('/papers/generate', async (req, res) => {
  const b = paperBody.parse(req.body);
  await requireRegisteredSubject(b.subject);
  const where = ['NOT is_deleted'];
  const params = [];
  const add = (sql, v) => {
    params.push(v);
    where.push(sql.replace('$?', `$${params.length}`));
  };
  if (b.units) add('unit = ANY($?::smallint[])', b.units);
  else if (b.unit) add('unit = $?', b.unit);
  if (b.subject) add('subject = $?', b.subject);
  if (b.topic) add('topic = $?', b.topic);
  if (b.subtopic) add('subtopic = $?', b.subtopic);

  const { rows } = await query(`SELECT * FROM questions WHERE ${where.join(' AND ')}`, params);
  if (!rows.length) throw new HttpError(404, 'No questions available for this unit/topic');

  const result = await generatePaper(rows.map(toApi), b.totalMarks, b.split, b.markCounts, b.count);
  const complete = result.totalMarks === b.totalMarks;
  if (complete) await recordGeneratedPaper(b.subject, result.questions.length, 'bank');
  const paper = {
      subject: b.subject || 'ALL',
      unit: b.unit || 'ALL',
      units: b.units || (b.unit ? [b.unit] : [1,2,3,4,5]),
      topic: b.topic ?? 'ALL',
      subtopic: b.subtopic ?? null,
      requestedMarks: b.totalMarks,
      totalMarks: result.totalMarks,
      complete,
      targets: result.targets,
      questions: result.questions,
    };
  const saved = complete ? await storePaper(b.subject, `${b.subject.replaceAll('_',' ')} - Question paper`, result.questions, {...paper,source:'bank'}) : null;
  res.json({ ...(saved || {paper}),
    ...(complete ? {} : { warning: `Only ${result.totalMarks} of ${b.totalMarks} marks could be reached. Add more questions to the bank.` }),
  });
});

/**
 * POST /api/generate/questions   -> the "automatic" option of the web page
 * { "topic": "java", "subtopic": "stack", "marks": 5, "difficulty": "medium", "count": 3 }
 * Picks random matching questions from the bank. If the bank has fewer than requested, the
 * response reports the shortfall (the AI/ML generator of the next phase will fill that gap).
 */
router.post('/generate/questions', async (req, res) => {
  const b = autoBody.parse(req.body);
  await requireRegisteredSubject(b.subject);
  const where = ['NOT is_deleted', 'topic = $1', 'marks = $2', 'difficulty = $3'];
  const params = [b.topic, b.marks, b.difficulty];
  if (b.subject) {
    params.push(b.subject);
    where.push(`subject = $${params.length}`);
  }
  if (b.subtopic) {
    params.push(b.subtopic);
    where.push(`subtopic = $${params.length}`);
  }
  if (b.unit) {
    params.push(b.unit);
    where.push(`unit = $${params.length}`);
  }
  params.push(b.count);
  const { rows } = await query(
    `SELECT * FROM questions WHERE ${where.join(' AND ')} ORDER BY random() LIMIT $${params.length}`,
    params,
  );
  const shortfall = b.count - rows.length;
  res.json({
    requested: b.count,
    found: rows.length,
    shortfall,
    questions: rows.map(toApi),
    note: shortfall > 0 ? 'Not enough matching questions in the bank. AI generation (next phase) will fill the gap.' : null,
  });
});

export default router;
