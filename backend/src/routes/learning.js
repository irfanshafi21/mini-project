import { Router } from 'express';
import { z } from 'zod';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { query } from '../db.js';
import { HttpError } from '../errors.js';
import { getLocalModelInfo, validateLocalModel, reloadLocalModel, questionHash } from '../localModel.js';

const router=Router();
const runtime=process.env.MODEL_RUNTIME_DIR || fileURLToPath(new URL('../../.runtime/',import.meta.url));
const trainer=fileURLToPath(new URL('../../ml/train_reviewed.py',import.meta.url));
const label=z.enum(['concept','process','comparison','numerical']);
let training=false;
router.get('/status',async(_req,res)=>{
  const count=Number((await query('SELECT count(*) AS n FROM reviewed_examples')).rows[0].n);
  const {rows}=await query('SELECT id,status,report,created_at FROM model_training_runs ORDER BY id DESC LIMIT 1');
  res.json({approvedExamples:count,training,activeModel:getLocalModelInfo(),lastRun:rows[0] || null});
});
router.post('/reviews',async(req,res)=>{
  const b=z.object({paperId:z.number().int().positive(),reviews:z.array(z.object({
    index:z.number().int().min(0).max(49),label,text:z.string().max(2000),marks:z.number().int(),
    options:z.array(z.string()).max(4).default([]),answer:z.string().default(''),
  })).min(1).max(50)}).parse(req.body);
  if(new Set(b.reviews.map(r=>r.index)).size!==b.reviews.length)throw new HttpError(400,'Review each question once.');
  const paper=(await query('SELECT paper FROM saved_papers WHERE id=$1 AND NOT is_deleted',[b.paperId])).rows[0]?.paper;
  if(!paper)throw new HttpError(404,'Stored paper not found. Save your paper edits first.');
  const examples=b.reviews.map(r=>{
    const q=paper.questions[r.index];
    if(!q || q.text!==r.text || q.marks!==r.marks || JSON.stringify(q.options || [])!==JSON.stringify(r.options) || (q.answer || '')!==r.answer)
      throw new HttpError(409,'The paper changed. Reload and review the latest saved version.');
    return {question_index:r.index,topic:q.topic.replaceAll('_',' ').trim().slice(0,200),label:r.label,question:q,question_hash:questionHash(q.text)};
  });
  await query(`INSERT INTO reviewed_examples(paper_id,question_index,topic,label,question,question_hash)
    SELECT $1,r.question_index,r.topic,r.label,r.question,r.question_hash FROM jsonb_to_recordset($2::jsonb)
    AS r(question_index int,topic text,label text,question jsonb,question_hash text)
    ON CONFLICT(paper_id,question_index) DO UPDATE SET topic=EXCLUDED.topic,label=EXCLUDED.label,
    question=EXCLUDED.question,question_hash=EXCLUDED.question_hash,approved_at=now()`,[b.paperId,JSON.stringify(examples)]);
  res.status(201).json({approved:examples.length});
});
function runTrainer(input,output){
  return new Promise((resolve,reject)=>{
    const child=spawn(process.env.PYTHON_COMMAND || 'python',[trainer,'--reviews',input,'--output',output],{windowsHide:true});
    let stdout='',stderr='';
    const timer=setTimeout(()=>{child.kill();reject(new HttpError(503,'Training timed out. The active model was kept.'));},60000);
    child.stdout.on('data',b=>{stdout+=b;if(stdout.length>100000){child.kill();}});
    child.stderr.on('data',b=>{stderr+=b;});
    child.on('error',()=>{clearTimeout(timer);reject(new HttpError(503,'Install Python 3 to retrain the local model.'));});
    child.on('close',code=>{clearTimeout(timer);if(code!==0){console.error('Reviewed model training failed:',stderr.slice(-1000));reject(new HttpError(503,'Training failed. The active model was kept.'));return;}
      try{resolve(JSON.parse(stdout));}catch{reject(new HttpError(503,'Training did not return a valid report.'));}});
  });
}
export async function trainApprovedExamples(){
  if(training)throw new HttpError(409,'A training run is already in progress.');
  const {rows}=await query('SELECT topic,label FROM (SELECT topic,label,approved_at,id FROM reviewed_examples ORDER BY approved_at DESC,id DESC LIMIT 5000) latest ORDER BY approved_at,id');
  if(!rows.length)throw new HttpError(400,'Approve reviewed questions before training.');
  training=true;
  try{
    const dir=path.join(runtime,randomUUID());await fs.mkdir(dir,{recursive:true});
    const input=path.join(dir,'reviews.json'),output=path.join(dir,'model.json');
    await fs.writeFile(input,JSON.stringify(rows),'utf8');
    const report=await runTrainer(input,output), current=getLocalModelInfo();
    const promoted=report.reviewedTopicsUsed>0 && report.accuracy>=current.accuracy;
    const status=promoted?'activated':'kept_previous';
    if(promoted){
      const candidate=JSON.parse(await fs.readFile(output,'utf8'));
      candidate.trainedAt=new Date().toISOString();validateLocalModel(candidate);
      const temp=path.join(runtime,'active-model.tmp'),active=path.join(runtime,'active-model.json');
      await fs.writeFile(temp,JSON.stringify(candidate),'utf8');await fs.rename(temp,active);reloadLocalModel(candidate);
    }
    const full={...report,previousAccuracy:current.accuracy,promoted};
    await query('INSERT INTO model_training_runs(status,report) VALUES($1,$2::jsonb)',[status,JSON.stringify(full)]);
    return {status,report:full};
  }catch(err){await query('INSERT INTO model_training_runs(status,report) VALUES($1,$2::jsonb)',['failed',JSON.stringify({message:err.message})]);throw err;}
  finally{training=false;}
}
router.post('/train',async(_req,res)=>res.json(await trainApprovedExamples()));
router.get('/papers/:id',async(req,res)=>{
 const id=z.coerce.number().int().positive().parse(req.params.id);
 const job=(await query('SELECT status,attempts,report,updated_at FROM automatic_learning_jobs WHERE paper_id=$1',[id])).rows[0];
 res.json({job:job || null});
});
export default router;
