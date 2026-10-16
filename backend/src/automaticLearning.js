import { classifyBloom, startsWithBloomVerb } from './blooms.js';
import { query } from './db.js';
import { questionHash, classifyTopic } from './localModel.js';
import { validateObjective } from './validation.js';
import { trainApprovedExamples } from './routes/learning.js';

export function localLearningConfiguration(){return {provider:'local',model:'topic-and-bloom-naive-bayes'};}
export async function reviewLocally(paper){
 return paper.questions.map((q,index)=>{
  const bloomLevel=classifyBloom(q.text),issues=[];
  validateObjective(q,{addIssue:issue=>issues.push(issue)});
  const approved=q.bloomSource==='local-model' && startsWithBloomVerb(q.text,bloomLevel) &&
   (!q.bloomLevel || q.bloomLevel===bloomLevel) && issues.length===0 && q.text.length>=10 &&
   !(bloomLevel==='K1' && /\d/.test(q.text) && /calculate|compute/i.test(q.text));
  return {index,topic:q.topic,label:classifyTopic(q.topic),bloomLevel,approved,
   confidence:approved?1:0,reason:approved?'Local structural checks and classifier agree; not an independent correctness score.':'Not eligible for automatic local self-training.'};
 });
}

let running=false;
export async function processAutomaticLearning({review=reviewLocally,train=trainApprovedExamples}={}){
 if(running)return;running=true;
 let job;
 try{
  const claimed=await query(`WITH candidate AS (
    SELECT paper_id FROM automatic_learning_jobs WHERE attempts<3 AND next_attempt_at<=now()
    AND (status IN ('pending','waiting_for_key','retrying') OR (status='processing' AND updated_at<now()-interval '60 minutes'))
    ORDER BY paper_id LIMIT 1 FOR UPDATE SKIP LOCKED)
   UPDATE automatic_learning_jobs j SET status='processing',updated_at=now() FROM candidate c
   WHERE j.paper_id=c.paper_id RETURNING j.paper_id,j.attempts`);
  job=claimed.rows[0];if(!job)return;
  const configuration=localLearningConfiguration();
  const row=(await query('SELECT paper FROM saved_papers WHERE id=$1 AND NOT is_deleted',[job.paper_id])).rows[0];
  if(!row){await query("UPDATE automatic_learning_jobs SET status='skipped',updated_at=now() WHERE paper_id=$1",[job.paper_id]);return;}
  const paper=row.paper,reviews=await review(paper);
  const latest=(await query('SELECT paper FROM saved_papers WHERE id=$1 AND NOT is_deleted',[job.paper_id])).rows[0]?.paper;
  if(!latest || JSON.stringify(latest.questions)!==JSON.stringify(paper.questions))throw new Error('Paper changed during automatic review. Retrying the current version.');
  const examples=reviews.filter(r=>r.approved && r.bloomLevel && r.confidence>=0.9 && (!paper.questions[r.index].bloomLevel || !r.bloomLevel || (r.bloomLevel===paper.questions[r.index].bloomLevel && startsWithBloomVerb(paper.questions[r.index].text,r.bloomLevel)))).map(r=>({question_index:r.index,topic:r.topic,label:r.label,bloom_level:r.bloomLevel || classifyBloom(paper.questions[r.index].text),question:{...paper.questions[r.index],topic:r.topic,subtopic:r.label},question_hash:questionHash(paper.questions[r.index].text)}));
  // Re-review replaces machine labels for this snapshot; never retain rejected stale examples.
  await query("DELETE FROM reviewed_examples WHERE paper_id=$1 AND review_source IN ('llm','local')",[job.paper_id]);
  if(examples.length)await query(`INSERT INTO reviewed_examples(paper_id,question_index,topic,label,question,question_hash,review_source,bloom_level)
    SELECT $1,r.question_index,r.topic,r.label,r.question,r.question_hash,'local',r.bloom_level FROM jsonb_to_recordset($2::jsonb)
    AS r(question_index int,topic text,label text,question jsonb,question_hash text,bloom_level text)
    ON CONFLICT(paper_id,question_index) DO UPDATE SET topic=EXCLUDED.topic,label=EXCLUDED.label,question=EXCLUDED.question,
      question_hash=EXCLUDED.question_hash,bloom_level=EXCLUDED.bloom_level,review_source='local',approved_at=now()
    WHERE reviewed_examples.review_source IN ('llm','local')`,[job.paper_id,JSON.stringify(examples)]);
  const training=examples.length?await train():null;
  const report={accepted:examples.length,rejected:reviews.length-examples.length,reviewerProvider:configuration.provider,reviewerModel:configuration.model,training,reviews};
  await query("UPDATE automatic_learning_jobs SET status='completed',attempts=attempts+1,updated_at=now(),report=$2::jsonb WHERE paper_id=$1",[job.paper_id,JSON.stringify(report)]);
 }catch(error){
  if(job)await query("UPDATE automatic_learning_jobs SET status=$2,attempts=attempts+1,next_attempt_at=now()+interval '1 minute',updated_at=now(),report=$3::jsonb WHERE paper_id=$1",[job.paper_id,job.attempts>=2?'failed':'retrying',JSON.stringify({message:error.name==='AbortError' || error.name==='TimeoutError'?'Local reviewer timed out.':error.message.slice(0,300)})]);
 }finally{running=false;}
}
export function startAutomaticLearning(){
 const tick=()=>processAutomaticLearning().catch(()=>console.error('Automatic learning worker unavailable; check database migration.'));
 void tick();const timer=setInterval(tick,15000);timer.unref();return timer;
}
