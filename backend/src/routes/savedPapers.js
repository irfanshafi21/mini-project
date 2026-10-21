import { withBloom, startsWithBloomVerb } from '../blooms.js';
import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { HttpError } from '../errors.js';
import { normalizeName, objectiveFields, validateObjective } from '../validation.js';
import { toApi } from '../mapper.js';
import { requireRegisteredSubject } from './subjects.js';

const router = Router();
const subject = z.string().trim().min(1).max(60).transform(normalizeName);
const title = z.string().trim().min(1).max(120);
const manual = z.object({ subject:z.preprocess(v=>typeof v==='string' && !v.trim()?undefined:v,subject.optional()), title, questionIds: z.array(z.number().int().positive()).min(1).max(100) })
  .refine(b => new Set(b.questionIds).size === b.questionIds.length, { message: 'Select each question only once.' });
const snapshotQuestion = z.object({
  ...objectiveFields,
  // Provenance in old saved snapshots can contain free-form values. Ignore unknown
  // provenance rather than rejecting an otherwise editable question.
  bloomSource: z.preprocess(value => ['local-model','assigned','requested-llm','teacher-reviewed'].includes(value) ? value : undefined, z.enum(['local-model','assigned','requested-llm','teacher-reviewed']).optional()),
  text: z.string().trim().min(1).max(2000), marks: z.number().int().min(1).max(100),
  unit: z.number().int().min(1).max(5), difficulty: z.enum(['EASY','MEDIUM','HARD']),
  topic: z.string().max(200), subtopic: z.string().max(200).optional(),
}).superRefine(validateObjective);
const snapshot = z.object({ subject:subject.optional(), title, questions: z.array(snapshotQuestion).min(1).max(100) });
export async function storePaper(subjectName, paperTitle, questions, metadata = {}) {
  questions=questions.map(withBloom);
  const totalMarks = questions.reduce((sum,q) => sum + q.marks,0);
  if (totalMarks > 1000) throw new HttpError(400,'A paper may contain at most 1,000 marks.');
  const paper = { ...metadata, subject: subjectName || 'UNASSIGNED', title: paperTitle, questions, totalMarks, requestedMarks: totalMarks, complete: true };
  const { rows } = await query('INSERT INTO saved_papers(subject,title,paper) VALUES($1,$2,$3::jsonb) RETURNING id,created_at', [subjectName || null,paperTitle,JSON.stringify(paper)]);
  await query('INSERT INTO automatic_learning_jobs(paper_id) VALUES($1) ON CONFLICT DO NOTHING',[rows[0].id]);
  return { id: rows[0].id, createdAt: rows[0].created_at, paper };
}
router.post('/manual', async (req,res) => {
  const b = manual.parse(req.body);
  if(b.subject) await requireRegisteredSubject(b.subject);
  // Only fetch live questions belonging to this subject; never trust client-supplied text/marks.
  const { rows } = await query('SELECT * FROM questions WHERE NOT is_deleted AND id=ANY($1::int[])' + (b.subject?' AND subject=$2':''),b.subject?[b.questionIds,b.subject]:[b.questionIds]);
  if(rows.length !== b.questionIds.length) throw new HttpError(400,'Some selected questions were removed or belong to another subject. Refresh your selection.');
  const byId = new Map(rows.map(q=>[q.id,toApi(q)]));
  const subjects=[...new Set(rows.map(q=>q.subject))], paperSubject=b.subject || (subjects.length===1?subjects[0]:null);
  res.status(201).json(await storePaper(paperSubject,b.title,b.questionIds.map(id=>byId.get(id)), {source:'manual'}));
});
router.post('/saved', async (req,res) => {
  const b = snapshot.parse(req.body);
  if(b.subject) await requireRegisteredSubject(b.subject);
  res.status(201).json(await storePaper(b.subject,b.title,b.questions));
});
router.put('/saved/:id', async (req,res) => {
  const id=z.coerce.number().int().positive().parse(req.params.id), b=snapshot.parse(req.body);
  const previous=(await query('SELECT * FROM saved_papers WHERE id=$1 AND NOT is_deleted',[id])).rows[0];
  if(!previous) throw new HttpError(404,'Stored paper not found.');
  if((previous.subject || undefined)!==b.subject) throw new HttpError(400,'A stored paper must keep its original subject.');
  b.questions.forEach((q,i)=>{const old=previous.paper.questions[i];if(q.bloomLevel && (old?.bloomSource==='requested-llm' || old?.bloomLevel!==q.bloomLevel) && !startsWithBloomVerb(q.text,q.bloomLevel))throw new HttpError(400,'Question '+(i+1)+' must start with an allowed '+q.bloomLevel+' verb.');});
  const totalMarks=b.questions.reduce((n,q)=>n+q.marks,0);
  if(totalMarks>1000) throw new HttpError(400,'A paper may contain at most 1,000 marks.');
  const paper={...previous.paper,title:b.title,questions:b.questions.map(withBloom),totalMarks,requestedMarks:totalMarks,complete:true};
  const {rows}=await query('UPDATE saved_papers SET title=$2,paper=$3::jsonb WHERE id=$1 AND NOT is_deleted RETURNING id,created_at',[id,b.title,JSON.stringify(paper)]);
  if(!rows.length) throw new HttpError(404,'Stored paper not found.');
  res.json({id:rows[0].id,createdAt:rows[0].created_at,paper});
});
router.get('/saved', async (req,res) => {
  const b = z.object({ subject:subject.optional(), q:z.string().trim().max(120).optional(), page:z.coerce.number().int().min(1).default(1) }).parse(req.query);
  if(b.subject) await requireRegisteredSubject(b.subject);
  const params=[],where=['NOT is_deleted'];
  if(b.subject) {params.push(b.subject);where.push(`subject=$${params.length}`);}
  if(b.q) {params.push('%'+b.q+'%');where.push(`title ILIKE $${params.length}`);}
  const filter=where.join(' AND ');
  const total=Number((await query(`SELECT count(*) AS n FROM saved_papers WHERE ${filter}`,params)).rows[0].n);
  const { rows } = await query(`SELECT id,subject,title,created_at,paper FROM saved_papers WHERE ${filter} ORDER BY id DESC LIMIT 20 OFFSET $${params.length+1}`,[...params,(b.page-1)*20]);
  res.json({ items: rows.map(r=>({id:r.id,subject:r.subject || r.paper.subject || 'UNASSIGNED',title:r.title,createdAt:r.created_at,totalMarks:r.paper.totalMarks,count:r.paper.questions.length,source:r.paper.source})), page:b.page,total });
});
router.get('/saved/:id', async (req,res) => {
  const id=z.coerce.number().int().positive().parse(req.params.id);
  const { rows } = await query('SELECT * FROM saved_papers WHERE id=$1 AND NOT is_deleted',[id]);
  if(!rows.length) throw new HttpError(404,'Saved paper not found.');
  const r=rows[0];res.json({id:r.id,createdAt:r.created_at,paper:{...r.paper,questions:r.paper.questions.map(withBloom)}});
});
export default router;
