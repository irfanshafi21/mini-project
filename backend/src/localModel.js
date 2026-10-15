import fs from 'node:fs';
import { objectiveCandidates } from './objectiveQuestions.js';
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
function splitTopics(paragraph) {
  const parts=[];let start=0,depth=0;
  for(let i=0;i<paragraph.length;i++) {
    if(paragraph[i]==='(')depth++;
    if(paragraph[i]===')')depth=Math.max(0,depth-1);
    if(!depth && /[;.•]/.test(paragraph[i]) && !(paragraph[i]==='.' && /\d/.test(paragraph[i-1]||'') && /\d/.test(paragraph[i+1]||''))) {parts.push(paragraph.slice(start,i));start=i+1;}
  }
  parts.push(paragraph.slice(start));return parts;
}
const sectionTitle=/^(probability and statistics|linear algebra|calculus and optimi[sz]ation|programming,? data structures and algorithms|database management and warehousing|machine learning|artificial intelligence|general aptitude(?:\s*\(\d+\s*marks\))?)$/i;
export function syllabusTopics(text) {
  let unit=1, active=!/\bunit\s*[-:]?\s*(\d|IV|III|II|V|I)\b/i.test(text), skip=false;
  const topics=[],seen=new Set(),titles=[];let buffer=[];
  const flush=()=>{
    const paragraph=buffer.join(' ').replace(/\s+/g,' ').trim();buffer=[];
    for(let topic of splitTopics(paragraph)){
      topic=topic.replace(/\s*[-–—]\s*\d+\s*(hours?|hrs?)\b/ig,'').replace(/^\s*[-•\d.)]+\s*/,'').replace(/\s+\d{1,3}$/, '').trim();
      if(sectionTitle.test(topic))continue;
      if(topic.length<5 || topic.length>220 || !/[a-z]/i.test(topic))continue;
      if(/^(learning|course|sample|assessment|this is|questions may|overall|illustrative|suggested)/i.test(topic))continue;
      const key=topic.toLowerCase();if(!seen.has(key)){seen.add(key);topics.push({topic,unit});}
    }
  };
  for(const raw of text.split(/\r?\n/)){
    const line=raw.trim().replace(/^#{1,6}\s*/, '').replace(/\*\*([^*]+)\*\*/g,'$1').replace(/`([^`]+)`/g,'$1').replace(/^[-*•]\s+/, '');
    const heading=line.match(/^unit\s*[-:]?\s*(\d|IV|III|II|V|I)\b\s*[:.\-–—]*/i);
    if(heading){flush();unit=Number(heading[1])||({I:1,II:2,III:3,IV:4,V:5}[heading[1].toUpperCase()]);if(!unit||unit>5)unit=1;active=true;skip=false;const title=line.slice(heading[0].length).replace(/\s*[-–—]\s*\d+\s*(hours?|hrs?)\b/ig,'');if(title)titles.push({topic:title.replace(/[.]+$/, '').trim(),unit});continue;}
    if(/^(learning outcomes?|course objectives?|assessment scope|illustrative difficulty|suggested practical|overall course)/i.test(line)){flush();skip=true;continue;}
    if(!line){if(!skip)flush();continue;}
    if(!active||skip||/^--|sample syllabus|^page\b/i.test(line))continue;
    if(/^\s*[-*•]\s+/.test(raw))flush();
    buffer.push(line);
  }
  flush();
  for(const title of titles) if(!topics.some(t=>t.unit===title.unit) && title.topic.length>=5) topics.push(title);
  if(!topics.length)throw new HttpError(400,'No syllabus topics found. Include topic lines and optional Unit 1–5 headings.');
  return topics;
}

const patterns={
 concept:['Define {t} and identify its main purpose.','State the key characteristics of {t}.','Explain the role of {t} in a computer system.','Describe {t} using a suitable example.','Discuss the principles underlying {t}.','Explain the main components involved in {t}.','Describe the benefits and limitations of {t}.','Explain how {t} is applied in a practical system.'],
 process:['Outline the steps involved in {t}.','Explain how {t} operates, using an example.','Describe the sequence of operations in {t}.','Illustrate {t} with a labelled flow diagram.','Trace a suitable example through {t}.','Discuss the factors that affect {t}.','Analyse the main stages and limitations of {t}.','Explain how to verify the outcome of {t}.'],
 comparison:['Compare the alternatives covered by {t}.','Explain the key differences in {t} using a table.','Discuss the advantages and limitations of the approaches in {t}.','Illustrate the differences in {t} with examples.','Explain when each approach in {t} would be suitable.','Analyse the trade-offs involved in {t}.','Describe the similarities and differences in {t}.','Evaluate the approaches covered by {t} for a practical application.'],
 numerical:['Demonstrate {t} using a worked example and state your input values.','Explain the method used for {t}, with a numerical example.','Show the steps required for {t} using clearly stated assumptions.','Illustrate {t} with a calculation and verify the result.','Discuss the parameters needed for {t} and demonstrate their use.','Derive and apply a suitable expression for {t}.','Analyse how changing an input affects {t}, using sample values.','Explain how to check the accuracy of a calculation involving {t}.'],
};
// Marks control answer scope independently of the learned topic family and difficulty.
const shortPatterns = [
  'Define {t}.', 'State the purpose of {t}.', 'List two characteristics of {t}.',
  'Give one example of {t}.', 'State one advantage of {t}.',
  'State one limitation of {t}.', 'What is meant by {t}?', 'State one application of {t}.',
];
function focusedTopic(topic) {
  // A syllabus heading followed by a list is an umbrella, not one short question.
  return topic.split(':')[0].replace(/\s+concepts?$/i, '').split(/[,;]/)[0].trim();
}
function markedText(topic, family, marks, index) {
  if (marks === 2) return shortPatterns[index].replace('{t}', focusedTopic(topic));
  if (marks === 5) return patterns[family][index].replace('{t}', focusedTopic(topic));
  const [a,b,c] = marks === 10 ? [2,4,4] : [4,6,6];
  const introductions = [
    'Explain the fundamental principles of', 'Describe the main components of',
    'Explain the purpose and terminology of', 'Describe the underlying organisation of',
    'Explain the key features of', 'Describe the basic operation of',
    'Explain the central ideas of', 'Describe the architecture associated with',
  ];
  return `(a) ${introductions[index]} ${topic}. (${a} marks)\n` +
    `(b) Explain its operation using a labelled diagram or a worked example, as appropriate. (${b} marks)\n` +
    `(c) Analyse its benefits and limitations in a practical computer system. (${c} marks)`;
}
export function generateLocalQuestions(text, slots, previousHashes=[], oneMarkType='MCQ') {
  const topics=syllabusTopics(text), used=new Set(previousHashes), questions=[];
  const family=topic=>{const predicted=classifyTopic(topic);return predicted==='numerical'&&!/arithmetic|conversion|ratio|calculation|time|speedup|throughput|addition|subtraction|multiplication|division|performance|number system/i.test(topic)?'concept':predicted;};
  const candidates=[...new Set(slots.map(s=>s.marks))].filter(m=>m!==1).flatMap(marks=>topics.flatMap(({topic,unit})=>patterns[family(topic)].map((_,index)=>({
    topic:(marks<=5?focusedTopic(topic):topic).slice(0,200),subtopic:classifyTopic(topic),unit,syllabusReference:topic.slice(0,500),
    text:markedText(topic,family(topic),marks,index),pattern:index,marks,
  }))));
  if(slots.some(s=>s.marks===1)) candidates.push(...objectiveCandidates(topics,oneMarkType));
  for(let i=candidates.length-1;i>0;i--){const j=randomInt(i+1);[candidates[i],candidates[j]]=[candidates[j],candidates[i]];}
  const topicUse=new Map();
  for(const slot of slots){
    const available=candidates.filter(q=>q.marks===slot.marks&&!used.has(questionHash(q.text)));
    if(!available.length) throw new HttpError(409,slot.marks===1 ? 'Not enough unused checked one-mark facts match this syllabus. Add more detailed supported topics, or request fewer one-mark questions.' : `No unused ${slot.marks}-mark question variations remain for this syllabus. Add syllabus topics or expand the local model patterns.`);
    const desired=slot.difficulty==='EASY'?0:slot.difficulty==='MEDIUM'?3:6;
    available.sort((a,b)=>(topicUse.get(a.topic)||0)-(topicUse.get(b.topic)||0) || Math.abs(a.pattern-desired)-Math.abs(b.pattern-desired));
    const chosen=available[0]; used.add(questionHash(chosen.text));topicUse.set(chosen.topic,(topicUse.get(chosen.topic)||0)+1);
    questions.push({...chosen,...slot,id:`LOCAL${questions.length+1}`});
  }
  return questions;
}
