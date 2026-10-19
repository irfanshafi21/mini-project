import fs from 'node:fs';
import { HttpError } from './errors.js';
export const BLOOM_LEVELS=['K1','K2','K3','K4','K5','K6'];
export const BLOOM_NAMES={K1:'Remember',K2:'Understand',K3:'Apply',K4:'Analyze',K5:'Evaluate',K6:'Create'};
export const BLOOM_VERBS=JSON.parse(fs.readFileSync(new URL('../ml/bloom-verbs.json',import.meta.url),'utf8'));
let model=JSON.parse(fs.readFileSync(new URL('../ml/bloom-model.json',import.meta.url),'utf8'));
export function reloadBloomModel(candidate){if(candidate?.labels?.join(',')===BLOOM_LEVELS.join(','))model=candidate;}
export function getBloomInfo(){return model.report;}
function uniqueOpeningVerbLevel(text){
 let clean=String(text || '').trim().replace(/^\([a-z]\)\s*/i,'');
 // Remove common, explicit context lead-ins while preserving the actual
 // instruction that follows them (for example, "Using the diagram, Analyze...").
 clean=clean.replace(/^(?:using|based on|given|from|according to|with|refer to)\b[^,;:]{0,120}[,;:]\s*/i,'');
 const owners=new Map();
 for(const level of BLOOM_LEVELS)for(const verb of BLOOM_VERBS[level]){
  const key=verb.toLowerCase();owners.set(key,[...(owners.get(key)||[]),level]);
 }
 // Only trust an unambiguous verb at the start of the task. Shared verbs such
 // as "compare" fall through to the contextual model.
 for(const [verb,levels] of [...owners].sort((a,b)=>b[0].length-a[0].length)){
  if(levels.length===1 && new RegExp('^'+verb.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?:\\b|\\s)','i').test(clean))return levels[0];
 }
 return undefined;
}
export function classifyBloom(text){
 // Generated questions start with their selected college verb. Also accept a
 // short lead-in before an unambiguous task verb; shared verbs such as
 // "compare" remain context-classified by the trained model.
 const ruleLevel=uniqueOpeningVerbLevel(text);
 if(ruleLevel)return ruleLevel;
 const words=String(text || '').toLowerCase().match(/[a-z]+/g) || [];
 const features=[...words,...words.slice(1).map((w,i)=>'@'+words[i]+' '+w)];
 return BLOOM_LEVELS.map(level=>({level,score:model.prior[level]+features.reduce((sum,w)=>sum+(model.weights[level][w] || 0),0)})).sort((a,b)=>b.score-a.score)[0].level;
}
export function startsWithBloomVerb(text,level){const clean=String(text).trim().replace(/^\([a-z]\)\s*/i,'');return (BLOOM_VERBS[level] || []).some(v=>new RegExp('^'+v+'(?:\\b|[ :])','i').test(clean));}
export function withBloom(q){return {...q,bloomLevel:BLOOM_LEVELS.includes(q.bloomLevel)?q.bloomLevel:classifyBloom(q.text),bloomSource:q.bloomSource || (q.bloomLevel?'assigned':'local-model')};}
export function assignBloomSlots(slots,counts){
 if(!counts)return slots;
 return slots.map(slot=>({...slot})).map((slot,index,all)=>{
 const order=all.slice(0,index).filter(s=>s.marks===slot.marks).length;
 const levels=BLOOM_LEVELS.flatMap(l=>Array(counts[slot.marks]?.[l] || 0).fill(l));
 if(levels.length!==all.filter(s=>s.marks===slot.marks).length)throw new HttpError(400,`K1-K6 counts must total the ${slot.marks}-mark question count.`);
 return {...slot,bloomLevel:levels[order]};
 });
}

export function validateBloomPrefix(q,ctx){if(q.bloomLevel && !startsWithBloomVerb(q.text,q.bloomLevel))ctx.addIssue({code:'custom',path:['bloomLevel'],message:'Question must start with an allowed verb for '+q.bloomLevel});}

// Match K counts and difficulty independently; a K6 question need not be HARD.
export function selectBloomBank(pool,slots,counts){
 const selected=[];
 for(const mark of [...new Set(slots.map(s=>s.marks))]){
  const required=slots.filter(s=>s.marks===mark),difficulty=['EASY','MEDIUM','HARD'];
  const size=11,source=0,sink=10,capacity=Array.from({length:size},()=>Array(size).fill(0));
  BLOOM_LEVELS.forEach((k,i)=>{capacity[source][i+1]=counts[mark]?.[k] || 0;difficulty.forEach((d,j)=>{capacity[i+1][j+7]=pool.filter(q=>q.marks===mark && q.bloomLevel===k && q.difficulty===d && startsWithBloomVerb(q.text,k)).length;});});
  difficulty.forEach((d,j)=>{capacity[j+7][sink]=required.filter(s=>s.difficulty===d).length;});
  const original=capacity.map(row=>[...row]);let total=0;
  while(true){const parent=Array(size).fill(-1),queue=[source];parent[source]=source;
   for(let at=0;at<queue.length && parent[sink]<0;at++)for(let v=0;v<size;v++)if(parent[v]<0 && capacity[queue[at]][v]>0){parent[v]=queue[at];queue.push(v);}
   if(parent[sink]<0)break;let amount=50;for(let v=sink;v!==source;v=parent[v])amount=Math.min(amount,capacity[parent[v]][v]);
   for(let v=sink;v!==source;v=parent[v]){capacity[parent[v]][v]-=amount;capacity[v][parent[v]]+=amount;}total+=amount;
  }
  if(total!==required.length)throw new HttpError(409,`Not enough ${mark}-mark bank questions to satisfy both K levels and difficulty. Add matching questions or adjust the allocation.`);
  BLOOM_LEVELS.forEach((k,i)=>difficulty.forEach((d,j)=>{const n=original[i+1][j+7]-capacity[i+1][j+7];selected.push(...pool.filter(q=>q.marks===mark && q.bloomLevel===k && q.difficulty===d && startsWithBloomVerb(q.text,k)).slice(0,n));}));
 }
 return selected;
}
