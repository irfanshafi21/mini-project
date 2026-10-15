import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { HttpError } from '../errors.js';
import { normalizeName } from '../validation.js';
import { toApi } from '../mapper.js';
import { requireRegisteredSubject } from './subjects.js';

const router = Router();
const subject = z.string().trim().min(1).max(60).transform(normalizeName);
const title = z.string().trim().min(1).max(120);
const manual = z.object({ subject, title, questionIds: z.array(z.number().int().positive()).min(1).max(50) })
  .refine(b => new Set(b.questionIds).size === b.questionIds.length, { message: 'Select each question only once.' });
const snapshotQuestion = z.object({
  text: z.string().trim().min(1).max(2000), marks: z.number().int().min(1).max(100),
  unit: z.number().int().min(1).max(5), difficulty: z.enum(['EASY','MEDIUM','HARD']),
  topic: z.string().max(200), subtopic: z.string().max(200).optional(),
  syllabusReference: z.string().max(500).optional(),
});
const snapshot = z.object({ subject, title, questions: z.array(snapshotQuestion).min(1).max(50) });
async function store(subjectName, paperTitle, questions) {
  const totalMarks = questions.reduce((sum,q) => sum + q.marks,0);
  if (totalMarks > 1000) throw new HttpError(400,'A paper may contain at most 1,000 marks.');
  const paper = { subject: subjectName, title: paperTitle, questions, totalMarks, requestedMarks: totalMarks, complete: true };
  const { rows } = await query('INSERT INTO saved_papers(subject,title,paper) VALUES($1,$2,$3::jsonb) RETURNING id,created_at', [subjectName,paperTitle,JSON.stringify(paper)]);
  return { id: rows[0].id, createdAt: rows[0].created_at, paper };
}
router.post('/manual', async (req,res) => {
  const b = manual.parse(req.body);
  await requireRegisteredSubject(b.subject);
  // Only fetch live questions belonging to this subject; never trust client-supplied text/marks.
  const { rows } = await query('SELECT * FROM questions WHERE subject=$1 AND NOT is_deleted AND id=ANY($2::int[])',[b.subject,b.questionIds]);
  if(rows.length !== b.questionIds.length) throw new HttpError(400,'Some selected questions were removed or belong to another subject. Refresh your selection.');
  const byId = new Map(rows.map(q=>[q.id,toApi(q)]));
  res.status(201).json(await store(b.subject,b.title,b.questionIds.map(id=>byId.get(id))));
});
router.post('/saved', async (req,res) => {
  const b = snapshot.parse(req.body);
  await requireRegisteredSubject(b.subject);
  res.status(201).json(await store(b.subject,b.title,b.questions));
});
router.get('/saved', async (req,res) => {
  const b = z.object({ subject, page:z.coerce.number().int().min(1).default(1) }).parse(req.query);
  await requireRegisteredSubject(b.subject);
  const { rows } = await query('SELECT id,title,created_at,paper FROM saved_papers WHERE subject=$1 ORDER BY id DESC LIMIT 20 OFFSET $2',[b.subject,(b.page-1)*20]);
  res.json({ items: rows.map(r=>({id:r.id,title:r.title,createdAt:r.created_at,totalMarks:r.paper.totalMarks,count:r.paper.questions.length})), page:b.page });
});
router.get('/saved/:id', async (req,res) => {
  const id=z.coerce.number().int().positive().parse(req.params.id);
  const { rows } = await query('SELECT * FROM saved_papers WHERE id=$1',[id]);
  if(!rows.length) throw new HttpError(404,'Saved paper not found.');
  const r=rows[0];res.json({id:r.id,createdAt:r.created_at,paper:r.paper});
});
export default router;
