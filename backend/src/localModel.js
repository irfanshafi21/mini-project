import fs from 'node:fs';
import { createHash, randomInt } from 'node:crypto';
import { HttpError } from './errors.js';

const model = JSON.parse(fs.readFileSync(new URL('../ml/model.json', import.meta.url), 'utf8'));
export const questionHash = text => createHash('sha256').update(text.toLowerCase().replace(/\s+/g, ' ').trim()).digest('hex');
export function classifyTopic(text) {
  const words = text.toLowerCase().match(/[a-z]+/g) || [];
  const features = [...words, ...words.flatMap(w => Array.from({ length: Math.max(0,w.length-2) },(_,i)=>'#'+w.slice(i,i+3)))];
  return model.labels.map(label=>({label,score:model.logPrior[label]+features.reduce((n,w)=>n+(model.logLikelihood[label][w]||0),0)})).sort((a,b)=>b.score-a.score)[0].label;
}
export async function extractSyllabusText(body) {
  const bytes = Buffer.from(body.data, 'base64');
  if (!bytes.length || bytes.length > 5*1024*1024 || bytes.toString('base64') !== body.data) throw new HttpError(400,'Upload a valid PDF or TXT syllabus up to 5 MB.');
  let text;
  if (body.mimeType === 'application/pdf') {
    if (bytes.subarray(0,5).toString() !== '%PDF-') throw new HttpError(400,'The uploaded file is not a PDF.');
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({data:new Uint8Array(bytes)});
    try { text = (await parser.getText()).text; }
    catch { throw new HttpError(400,'Cannot read this PDF. Use a text-based PDF or TXT syllabus.'); }
    finally { await parser.destroy(); }
  } else text=bytes.toString('utf8');
  if(text.trim().length<30 || text.length>100000) throw new HttpError(400,'Upload readable syllabus text between 30 and 100,000 characters.');
  return text;
}
export function syllabusTopics(text) {
  let unit=1, active=!/\bunit\s*[-:]?\s*(\d|IV|III|II|V|I)\b/i.test(text), skip=false;
  const topics=[],seen=new Set();let buffer=[];
  const flush=()=>{
    const paragraph=buffer.join(' ').replace(/\s+/g,' ').trim();buffer=[];
    for(let topic of paragraph.split(/[;.]\s*/)){
      topic=topic.replace(/\s*[-–—]\s*\d+\s*(hours?|hrs?)\b/ig,'').replace(/^\s*[-•\d.)]+\s*/,'').trim();
      if(topic.length<5 || topic.length>220 || !/[a-z]/i.test(topic))continue;
      if(/^(learning|course|sample|assessment|this is|questions may|overall|illustrative|suggested)/i.test(topic))continue;
      const key=topic.toLowerCase();if(!seen.has(key)){seen.add(key);topics.push({topic,unit});}
    }
  };
  for(const raw of text.split(/\r?\n/)){
    const line=raw.trim();
    const heading=line.match(/^unit\s*[-:]?\s*(\d|IV|III|II|V|I)\b\s*[:.\-–—]*/i);
    if(heading){flush();unit=Number(heading[1])||({I:1,II:2,III:3,IV:4,V:5}[heading[1].toUpperCase()]);if(!unit||unit>5)unit=1;active=true;skip=false;const title=line.slice(heading[0].length).replace(/\s*[-–—]\s*\d+\s*(hours?|hrs?)\b/ig,'');if(title)buffer.push(title+'.');continue;}
    if(/^(learning outcomes?|course objectives?|assessment scope|illustrative difficulty|suggested practical|overall course)/i.test(line)){flush();skip=true;continue;}
    if(!line){if(!skip)flush();continue;}
    if(!active||skip||/^--|sample syllabus|^page\b/i.test(line))continue;
    buffer.push(line);
  }
  flush();
  if(!topics.length)throw new HttpError(400,'No syllabus topics found. Include topic lines and optional Unit 1–5 headings.');
  return topics;
}

const patterns={
 concept:['Define {t} and identify its main purpose.','State the key characteristics of {t}.','Explain the role of {t} in a computer system.','Describe {t} using a suitable example.','Discuss the principles underlying {t}.','Explain the main components involved in {t}.','Describe the benefits and limitations of {t}.','Explain how {t} is applied in a practical system.'],
 process:['Outline the steps involved in {t}.','Explain how {t} operates, using an example.','Describe the sequence of operations in {t}.','Illustrate {t} with a labelled flow diagram.','Trace a suitable example through {t}.','Discuss the factors that affect {t}.','Analyse the main stages and limitations of {t}.','Explain how to verify the outcome of {t}.'],
 comparison:['Compare the alternatives covered by {t}.','Explain the key differences in {t} using a table.','Discuss the advantages and limitations of the approaches in {t}.','Illustrate the differences in {t} with examples.','Explain when each approach in {t} would be suitable.','Analyse the trade-offs involved in {t}.','Describe the similarities and differences in {t}.','Evaluate the approaches covered by {t} for a practical application.'],
 numerical:['Demonstrate {t} using a worked example and state your input values.','Explain the method used for {t}, with a numerical example.','Show the steps required for {t} using clearly stated assumptions.','Illustrate {t} with a calculation and verify the result.','Discuss the parameters needed for {t} and demonstrate their use.','Derive and apply a suitable expression for {t}.','Analyse how changing an input affects {t}, using sample values.','Explain how to check the accuracy of a calculation involving {t}.'],
};
export function generateLocalQuestions(text, slots, previousHashes=[]) {
  const topics=syllabusTopics(text), used=new Set(previousHashes), questions=[];
  const family=topic=>{const predicted=classifyTopic(topic);return predicted==='numerical'&&!/arithmetic|conversion|ratio|calculation|time|speedup|throughput|addition|subtraction|multiplication|division|performance|number system/i.test(topic)?'concept':predicted;};
  const candidates=topics.flatMap(({topic,unit})=>patterns[family(topic)].map((pattern,index)=>({
    topic:topic.slice(0,200),subtopic:classifyTopic(topic),unit,syllabusReference:topic.slice(0,500),
    text:pattern.replace('{t}',topic),pattern:index,
  })));
  // Randomise available candidates, then use the learned family and requested complexity.
  for(let i=candidates.length-1;i>0;i--){const j=randomInt(i+1);[candidates[i],candidates[j]]=[candidates[j],candidates[i]];}
  const topicUse=new Map();
  for(const slot of slots){
    const available=candidates.filter(q=>!used.has(questionHash(q.text)));
    if(!available.length) throw new HttpError(409,'No unused question variations remain for this syllabus. Add syllabus topics or expand the local model patterns.');
    const desired=slot.difficulty==='EASY'?0:slot.difficulty==='MEDIUM'?3:6;
    available.sort((a,b)=>(topicUse.get(a.topic)||0)-(topicUse.get(b.topic)||0) || Math.abs(a.pattern-desired)-Math.abs(b.pattern-desired));
    const chosen=available[0]; used.add(questionHash(chosen.text));topicUse.set(chosen.topic,(topicUse.get(chosen.topic)||0)+1);
    questions.push({...chosen,...slot,id:`LOCAL${questions.length+1}`});
  }
  return questions;
}
