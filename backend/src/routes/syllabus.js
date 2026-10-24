import { withBloom } from '../blooms.js';
import { Router } from 'express';
import { storePaper } from './savedPapers.js';
import { generateSyllabusPaper, syllabusBody } from '../syllabusGenerator.js';

import { z } from 'zod';
import { requireRegisteredSubject, recordGeneratedPaper } from './subjects.js';
import { query } from '../db.js';
import { normalizeName, objectiveFields, validateObjective } from '../validation.js';
import { extractSyllabusText, questionHash, reuseSignature, syllabusTopics } from '../localModel.js';
import { MAX_SYLLABUS_UNITS } from '../unitNumbers.js';

const router = Router();
const inspectedUploads = new Map();
const uploadBody = z.object({
  fileName: z.string().min(1).max(200),
  mimeType: z.enum(['application/pdf', 'text/plain', 'image/jpeg', 'image/png', 'image/webp']),
  data: z.string().min(1).max(7_000_000).regex(/^[A-Za-z0-9+/]+={0,2}$/),
});
const uploadKey = body => questionHash(`${body.mimeType}:${Buffer.from(body.data, 'base64').toString('hex')}`);
function cacheInspectedUpload(key, text) {
  const now = Date.now();
  for (const [storedKey, value] of inspectedUploads) if (value.expiresAt <= now) inspectedUploads.delete(storedKey);
  while (inspectedUploads.size >= 12) inspectedUploads.delete(inspectedUploads.keys().next().value);
  inspectedUploads.set(key, { text, expiresAt: now + 15 * 60 * 1000 });
}

router.post('/syllabus/inspect', async (req, res) => {
  const body = uploadBody.parse(req.body);
  const text = await extractSyllabusText(body);
  const topics = syllabusTopics(text);
  const units = [...new Set(topics.map(item => item.unit))].filter(unit => unit >= 1 && unit <= MAX_SYLLABUS_UNITS).sort((a, b) => a - b);
  cacheInspectedUpload(uploadKey(body), text);
  res.json({
    units,
    topicCount: topics.length,
    topicsByUnit: units.map(unit => ({ unit, count: topics.filter(item => item.unit === unit).length })),
  });
});

// Serialize matching uploads in this server so concurrent requests share current history.
const pending=new Map();
router.post('/papers/from-syllabus',async(req,res,next)=>{
  const key=questionHash(`${req.body?.subject || ''}|${req.body?.data || ''}`);
  const previous=pending.get(key) || Promise.resolve();
  let release;const gate=new Promise(resolve=>{release=resolve;});pending.set(key,gate);
  await previous;
  let done=false;const finish=()=>{if(done)return;done=true;release();if(pending.get(key)===gate)pending.delete(key);};
  res.once('finish',finish);res.once('close',finish);next();
});
router.post('/papers/from-syllabus', async (req, res) => {
  const startedAt=performance.now();
  const body = syllabusBody.parse(req.body);
  if(body.subject) await requireRegisteredSubject(body.subject);
  let syllabusHash;
  let generationStartedAt=startedAt;
  {
    const key = uploadKey(body);
    const cached = inspectedUploads.get(key);
    if (cached?.expiresAt > Date.now()) body.preparedText = cached.text;
    else body.preparedText = await extractSyllabusText(body);
    syllabusHash = questionHash(body.preparedText);
    const history = (await query('SELECT question_hash,signature_hash FROM syllabus_history WHERE subject IS NOT DISTINCT FROM $1 AND syllabus_hash=$2',[body.subject || null,syllabusHash])).rows;
    body.previousQuestionHashes=history.map(r=>r.question_hash);
    body.previousSignatures=history.map(r=>r.signature_hash).filter(Boolean);
    body.reviewedQuestions=(await query(`SELECT question FROM reviewed_examples WHERE review_source IN ('faculty','local') ORDER BY approved_at DESC LIMIT 500`)).rows.map(r=>r.question);
  }
  generationStartedAt=performance.now();
  const result = await generateSyllabusPaper(body);
  const generatedAt=performance.now();
  {
    const questions=result.paper.questions;
    const history=new Set(body.previousQuestionHashes), signatures=new Set(body.previousSignatures);
    const repeated=questions.filter(q=>history.has(questionHash(q.text)) || signatures.has(reuseSignature(q))).length;
    const budget=Math.floor(questions.length*.2);
    if(repeated>budget)return res.status(409).json({error:'This paper exceeds the 20% repeat limit. Add more topics or request fewer questions.'});
    const fresh=questions.filter(q=>!history.has(questionHash(q.text)));
    const reserved=await query(`INSERT INTO syllabus_history(subject,syllabus_hash,question_hash,signature_hash)
      SELECT $1,$2,h.question_hash,h.signature_hash FROM jsonb_to_recordset($3::jsonb) AS h(question_hash text,signature_hash text)
      ON CONFLICT DO NOTHING RETURNING question_hash`,[body.subject || null,syllabusHash,JSON.stringify(fresh.map(q=>({question_hash:questionHash(q.text),signature_hash:reuseSignature(q)})))]);
    if(reserved.rows.length!==fresh.length)return res.status(409).json({error:'Another request used these variations. Generate again.'});
    Object.assign(result.paper,{repeatCount:repeated,repeatBudget:budget,repeatLimitPercent:20});
  }
  if(body.subject) await recordGeneratedPaper(body.subject, result.paper.questions.length, 'syllabus');
  const saved = await storePaper(body.subject, `${(body.subject || 'Unassigned').replaceAll('_',' ')} - Syllabus paper`, result.paper.questions, {...result.paper,source:'syllabus'});
  console.info('[Syllabus paper timing]',JSON.stringify({preparationMs:Math.round(generationStartedAt-startedAt),generationMs:Math.round(generatedAt-generationStartedAt),persistenceMs:Math.round(performance.now()-generatedAt),totalMs:Math.round(performance.now()-startedAt),questionCount:result.paper.questions.length,photo:/^image\//.test(body.mimeType),provider:result.paper.model}));
  res.json({ ...result, ...saved, savedUnit: body.unit });
});

const saveBody = z.object({
  subject: z.string().trim().min(1).max(60).transform(normalizeName),
  unit: z.number().int().min(1).max(MAX_SYLLABUS_UNITS).optional(),
  questions: z.array(z.object({
    ...objectiveFields,
    topic: z.string().trim().min(1).max(200), subtopic: z.string().trim().min(1).max(200),
    text: z.string().trim().min(10).max(2000), marks: z.number().int().min(1).max(100),
    difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']),
    unit: z.number().int().min(1).max(MAX_SYLLABUS_UNITS).optional(),
  }).superRefine(validateObjective)).min(1).max(100),
});

router.post('/papers/save-syllabus', async (req, res) => {
  const body = saveBody.parse(req.body);
  await requireRegisteredSubject(body.subject);
  const questions = body.questions.map(original => {const q=withBloom(original);return ({ ...q,bloom_level:q.bloomLevel, unit:q.unit || body.unit || 1, topic: normalizeName(q.topic).slice(0, 60),
    subtopic: normalizeName(q.subtopic).slice(0, 60), question_type:q.questionType });});
  const { rows } = await query(`WITH inserted AS (
    INSERT INTO questions(subject, unit, topic, subtopic, text, marks, difficulty, question_type, options, answer, bloom_level)
    SELECT $1, q.unit, q.topic, q.subtopic, q.text, q.marks, q.difficulty, q.question_type, q.options, q.answer,q.bloom_level
    FROM jsonb_to_recordset($2::jsonb) AS q(unit smallint, topic text, subtopic text, text text, marks smallint, difficulty text, question_type text, options jsonb, answer text,bloom_level text)
    ON CONFLICT DO NOTHING RETURNING id
  ) SELECT count(*)::int AS saved FROM inserted`, [body.subject, JSON.stringify(questions)]);
  const saved = rows[0].saved;
  res.json({ savedToBank: saved, alreadyInBank: questions.length - saved, savedUnit: body.unit });
});
export default router;
