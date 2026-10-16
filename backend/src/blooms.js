import fs from 'node:fs';
import { HttpError } from './errors.js';
export const BLOOM_LEVELS=['K1','K2','K3','K4','K5','K6'];
export const BLOOM_NAMES={K1:'Remember',K2:'Understand',K3:'Apply',K4:'Analyze',K5:'Evaluate',K6:'Create'};
export const BLOOM_VERBS=JSON.parse(fs.readFileSync(new URL('../ml/bloom-verbs.json',import.meta.url),'utf8'));
let model=JSON.parse(fs.readFileSync(new URL('../ml/bloom-model.json',import.meta.url),'utf8'));
export function reloadBloomModel(candidate){if(candidate?.labels?.join(',')===BLOOM_LEVELS.join(','))model=candidate;}
export function getBloomInfo(){return model.report;}
export function classifyBloom(text){
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
