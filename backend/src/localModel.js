import { classifyBloom, startsWithBloomVerb, reloadBloomModel } from './blooms.js';
import fs from 'node:fs';
import path from 'node:path';
import { objectiveCandidates } from './objectiveQuestions.js';
import { createHash, randomInt } from 'node:crypto';
import { HttpError } from './errors.js';

const activePath=process.env.MODEL_RUNTIME_DIR ? path.join(process.env.MODEL_RUNTIME_DIR,'active-model.json') : new URL('../.runtime/active-model.json',import.meta.url);
let model=JSON.parse(fs.readFileSync(fs.existsSync(activePath)?activePath:new URL('../ml/model.json',import.meta.url),'utf8'));
if(model.bloomModel)reloadBloomModel(model.bloomModel);
export function validateLocalModel(candidate){
  if(candidate.kind!=='multinomial-naive-bayes-topic-type' || !['concept','process','comparison','numerical'].every(l=>candidate.labels?.includes(l) && Number.isFinite(candidate.logPrior?.[l]) && candidate.logLikelihood?.[l]))throw new Error('Invalid trained model');
}
export function reloadLocalModel(candidate){validateLocalModel(candidate);model=candidate;if(candidate.bloomModel)reloadBloomModel(candidate.bloomModel); }
export function getLocalModelInfo(){const r=model.trainingReport || JSON.parse(fs.readFileSync(new URL('../ml/evaluation.json',import.meta.url),'utf8'));return {kind:model.kind,trainedAt:model.trainedAt || null,accuracy:r.accuracy,trainingExamples:r.trainingExamples,testExamples:r.testExamples,reviewedTopicsUsed:r.reviewedTopicsUsed || 0,independentBenchmark:r.independentBenchmark ? {accuracy:r.independentBenchmark.accuracy,testExamples:r.independentBenchmark.testExamples,macroF1:r.independentBenchmark.macroF1,splitHash:r.splitHashes?.benchmark}:null};}

export const questionHash = text => createHash('sha256').update(text.toLowerCase().replace(/\s+/g, ' ').trim()).digest('hex');
export function classifyTopic(text) {
  const words = text.toLowerCase().match(/[a-z]+/g) || [];
  const settings=model.featureSettings || {}, weight=settings.wordWeight || 1;
  const features = [...Array.from({length:weight},()=>words).flat(), ...words.flatMap(w => Array.from({ length: Math.max(0,w.length-2) },(_,i)=>'#'+w.slice(i,i+3)))];
  if(settings.bigrams)for(let i=1;i<words.length;i++)for(let j=0;j<weight;j++)features.push('@'+words[i-1]+' '+words[i]);
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
const looksStructured = text => /```|\b(function|class|return|printf|print|console\.|int\s+\w+|public\s+static)\b|(?:\b[a-z_]\w*\s*=\s*[^=]+)|(?:\d+(?:\.\d+)?\s*[=<>+*/^%≤≥≠-]\s*\d)|(?:\b[a-z]\s*[=<>+*/^≤≥≠]\s*[a-z0-9]\b)|(?:\b[a-z]\s*-\s*[a-z0-9]\b)/i.test(text);
const taskVerb=/\b(?:calculate|compute|solve|prove|derive|evaluate|trace|debug|predict|write|implement|perform|execute|insert|delete|push|pop|enqueue|dequeue|traverse|sort|search\s+(?:for|the|an?|element|key|value)|merge|rotate|convert|simplify|integrate|differentiate|factor|expand|estimate|measure)\b/i;
const authoredTask=/^(?:define|state|list|give|name|explain|describe|compare|discuss|outline|illustrate|trace|debug|predict|write|implement|calculate|compute|solve|prove|derive|evaluate|design|construct|find|determine|show|demonstrate|perform|execute|insert|delete|push|pop|enqueue|dequeue|traverse|sort|merge|rotate|convert|simplify|integrate|differentiate|factor|expand|estimate|measure)\b/i;
function splitTopics(paragraph) {
  // Keep source-authored problems intact: punctuation and line breaks are part
  // of equations, decimal values, code, and step-by-step exercises.
  if (looksStructured(paragraph) || authoredTask.test(paragraph.trim()) || taskVerb.test(paragraph)) return [paragraph];
  const parts=[];let start=0,depth=0;
  for(let i=0;i<paragraph.length;i++) {
    if(paragraph[i]==='(')depth++;
    if(paragraph[i]===')')depth=Math.max(0,depth-1);
    if(!depth && /[;.•]/.test(paragraph[i]) && !(paragraph[i]==='.' && /\d/.test(paragraph[i-1]||'') && /\d/.test(paragraph[i+1]||''))) {parts.push(paragraph.slice(start,i));start=i+1;}
  }
  parts.push(paragraph.slice(start));return parts;
}
const sectionTitle=/^(probability and statistics|linear algebra|calculus and optimi[sz]ation|programming,? data structures and algorithms|database management and warehousing|machine learning|artificial intelligence|general aptitude(?:\s*\(\d+\s*marks\))?)$/i;
const projectInstructionNoise=/\b(?:developer prompt|system prompt|user request|project requirements?|project instructions?|critical requirements|testing instructions?|regression test|test suite|error message|ui labels?|upload instructions?|prompt examples?|question paper generator|preserve existing features|do not (?:modify|change|remove|replace|assume|silently|blindly|invent)|run (?:the )?(?:existing )?(?:tests|test suite|build)|click to browse|drop your syllabus|choose your syllabus|generate (?:the )?question paper|add to question bank|the uploaded file|work directly on my existing|final verification and report|inspect the existing implementation first|implement subject-aware question generation|support question-type selection|generate genuine problem-solving questions|fix retrieval filtering and validation|prevent irrelevant questions|handle insufficient questions|inspect model training|add regression tests)\b/i;
function isProjectInstruction(text){return projectInstructionNoise.test(String(text||'')) || /^(?:error|warning|note to (?:the )?(?:user|developer))\s*:/i.test(String(text||'').trim()) || /^(?:#{1,6}\s*)?(?:\d+\.\s*)?(?:inspect|implement|support|generate|fix|prevent|handle|run|add|report)\b/i.test(String(text||'').trim()) && /\b(?:existing implementation|question generation|question-type|engineering subjects|regression tests|the test suite|final verification|existing project)\b/i.test(String(text||''));}
export function syllabusTopics(text) {
  let unit=1, active=!/\bunit\s*[-:]?\s*(\d|IV|III|II|V|I)\b/i.test(text), skip=false;
  const topics=[],seen=new Set(),titles=[];let buffer=[];
  const flush=()=>{
    const paragraph=buffer.join('\n').trim();buffer=[];
    for(let topic of splitTopics(paragraph)){
      if(isProjectInstruction(topic))continue;
      const structured=looksStructured(topic);
      if(!structured) topic=topic.replace(/\s*[-–—]\s*\d+\s*(hours?|hrs?)\b/ig,'').replace(/^\s*[-•\d.)]+\s*/,'').replace(/\s+\d{1,3}$/, '').replace(/\s+/g,' ').trim();
      if(sectionTitle.test(topic))continue;
      if((topic.length<5 && !structured) || (topic.length>220 && !structured && !authoredTask.test(topic)) || (!/[a-z]/i.test(topic) && !structured))continue;
      if(/^(learning|course|sample|assessment|this is|questions may|overall|illustrative|suggested|example values|example inputs|sample values)/i.test(topic))continue;
      const key=topic.toLowerCase();if(!seen.has(key)){seen.add(key);topics.push({topic,unit});}
    }
  };
  for(const raw of text.split(/\r?\n/)){
    const line=raw.trim().replace(/^#{1,6}\s*/, '').replace(/\*\*([^*]+)\*\*/g,'$1').replace(/`([^`]+)`/g,'$1').replace(/^[-*•]\s+/, '');
    const heading=line.match(/^unit\s*[-:]?\s*(\d|IV|III|II|V|I)\b\s*[:.\-–—]*/i);
    if(heading){flush();unit=Number(heading[1])||({I:1,II:2,III:3,IV:4,V:5}[heading[1].toUpperCase()]);if(!unit||unit>5)unit=1;active=true;skip=false;const title=line.slice(heading[0].length).replace(/\s*[-–—]\s*\d+\s*(hours?|hrs?)\b/ig,'');if(title)titles.push({topic:title.replace(/[.]+$/, '').trim(),unit});continue;}
    if(/^(learning outcomes?|course objectives?|assessment scope|illustrative difficulty|suggested practical|overall course)/i.test(line)){flush();skip=true;continue;}
    if(isProjectInstruction(line)){flush();continue;}
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
  concept:['Define {t} and identify its main purpose.','State the key characteristics of {t}.','Explain the role of {t} in its subject area.','Describe {t} using a suitable example.','Discuss the principles underlying {t}.','Explain the main components involved in {t}.','Describe the benefits and limitations of {t}.','Explain how {t} is applied in practice.'],
 process:['Outline the steps involved in {t}.','Explain how {t} operates, using an example.','Describe the sequence of operations in {t}.','Illustrate {t} with a labelled flow diagram.','Trace a suitable example through {t}.','Discuss the factors that affect {t}.','Analyse the main stages and limitations of {t}.','Explain how to verify the outcome of {t}.'],
 comparison:['Compare the alternatives covered by {t}.','Explain the key differences in {t} using a table.','Discuss the advantages and limitations of the approaches in {t}.','Illustrate the differences in {t} with examples.','Explain when each approach in {t} would be suitable.','Analyse the trade-offs involved in {t}.','Describe the similarities and differences in {t}.','Evaluate the approaches covered by {t} for a practical application.'],
 numerical:['Explain the meaning of {t} and identify the information needed to calculate it.','Describe the method used for {t} without assuming input values.','Outline the steps required for {t} using values supplied in the question.','Explain how a result for {t} can be checked.','Discuss which parameters are needed for {t}.','Describe how a supplied expression for {t} is applied.','Explain how changing a supplied input affects {t}.','State the units and assumptions needed when working with {t}.'],
};
// Marks control answer scope independently of the learned topic family and difficulty.
const shortPatterns = [
  'Define {t}.', 'State the purpose of {t}.', 'List two characteristics of {t}.',
  'Give one example of {t}.', 'State one advantage of {t}.',
  'State one limitation of {t}.', 'What is meant by {t}?', 'State one application of {t}.',
];
function focusedTopic(topic) {
  // A syllabus heading followed by a list is an umbrella, not one short question.
  const heading=topic.split('=')[0].split(':')[0].replace(/\s+concepts?$/i, '').trim();
  return /\bbetween\b/i.test(heading)?heading:heading.split(/[,;]/)[0].trim();
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
    `(c) Analyse its benefits and limitations in a relevant application. (${c} marks)`;
}
function sourceQuestion(topic) {
  const value=topic.trim();
  if(authoredTask.test(value)) return value;
  if(taskVerb.test(value)) {
    const verb=value.match(taskVerb)[0].toLowerCase();
    const lead=/^(calculate|compute|solve|derive|integrate|differentiate|factor|expand)$/.test(verb)
      ? 'Calculate the following problem using the supplied information:'
      : 'Perform the following specified task:';
    return `${lead}\n${value}`;
  }
  if(/```|\b(function|class|return|printf|print|console\.)\b/i.test(value)) return `Trace the following code and state its output:\n${value}`;
  if(looksStructured(value)) return `Interpret the following supplied expression or notation:\n${value}`;
  return null;
}
function taskBloomLevel(text) {
  const verb=String(text).match(taskVerb)?.[0]?.toLowerCase();
  if(!verb)return null;
  if(/^(write|implement|design|create|build|compile|compose|formulate|modify|develop)$/.test(verb))return 'K6';
  if(verb==='debug')return 'K4';
  return 'K3';
}
function questionBloomLevel(question) {
  // A clear recall stem is stronger evidence than a stale stored/model label.
  // This keeps valid two-mark K1 questions available even when an old bank
  // classification incorrectly assigned a higher Bloom level.
  if(/^(?:define|list|name|recall|state|identify|label|spell|tell|what|when|where|which|who|why)\b/i.test(String(question.text||'').trim()))return 'K1';
  if(question.bloomSource==='assigned' && question.bloomLevel)return question.bloomLevel;
  return taskBloomLevel(question.text) || question.bloomLevel || classifyBloom(question.text);
}
export function classifySourceQuestionStyle(text) {
  const value=String(text || '');
  if(/```|\b(?:int|float|double|char|void|boolean|string|public\s+static|def|function)\s+\w+\s*\([^)]*\)\s*\{?|\bwrite\s+(?:language[- ]neutral\s+)?pseudocode\b|\b(?:write|implement|complete|debug|predict|trace|execute|compile)\s+(?:the\s+following\s+)?(?:(?:a|an)\s+)?(?:[a-z0-9+#.]+\s+)?(?:code|program|function|class|query|sql|pseudocode|algorithm)\b|\b(?:SELECT\s+.+\s+FROM|INSERT\s+INTO|UPDATE\s+\w+\s+SET|CREATE\s+TABLE|DELETE\s+FROM)\b/i.test(value))return 'PROGRAMMING_SQL';
  if(/\b(?:name|list|show|recall|find|choose)\b[^\n]{0,90}\b(?:formula|quantities required|units associated|quantities used|steps used|steps of|stopping condition|input and output|operations performed|order in which)\b|\b(?:explain how a formula|illustrate how to set up a calculation|interpret the role of each quantity|compare the input and result quantities|explain how units help check|summarize how a suitable formula)\b|\b(?:algorithm|pseudocode|dry run|complexity|flowchart|relational algebra|decompose (?:the )?(?:relation|schema)|derive|prove|differentiate|integrate|solve|calculate|compute|find (?:the )?(?:roots|determinant|inverse|network address)|evaluate .{0,20}(?:integral|determinant|expression)|simplify (?:the )?(?:expression|boolean)|trace (?:the )?(?:operations|execution|algorithm|insertion sort)|perform (?:the )?(?:operation|calculation)|push .+ (?:stack|queue)|pop .+ (?:stack|queue)|enqueue|dequeue|analy[sz]e (?:the )?(?:time )?complexity|normalize (?:the )?(?:following )?(?:table|relation)|design (?:a )?(?:circuit|system|component)|complete (?:the )?(?:truth table|derivation))\b/i.test(value) || /\b(?:calculate|compute|solve|find|determine|evaluate)\b[^\n]{0,180}\b\d+(?:\.\d+)?\s*(?:kg|g|m|cm|mm|s|sec|h|hz|khz|mhz|v|kv|a|ma|ohm|ω|n|j|w|pa|mol|°c|°f|%)\b/i.test(value) || /\b[a-z]\w*\s*(?:\^|=)\s*[^=\n]*[+*/-][^=\n]*/i.test(value))return 'PROBLEM_SOLVING';
  return 'THEORY';
}
function questionKind(question) {
  return question._fromBank || question._fromSource || question._topicGenerated ? classifySourceQuestionStyle(question.text) : 'THEORY';
}
function sectionRecallCandidates(topics,slots,style) {
  if(!['PROBLEM_SOLVING','MIXED'].includes(style))return [];
  if(!slots.some(s=>['K1','K2'].includes(s.bloomLevel) && s.marks>1))return [];
  const result=[];
  for(const {topic,unit} of topics){
    const normalized=topic.toLowerCase();
    let k1Prompts=[],k2Prompts=[];
    if(/\b(integral|integration|derivative|differentiation|calculus|equation|algebra|matrix|matrices|determinant|probability|statistics|formula|kinematic|mechanic|force|motion|voltage|current|resistance|circuit|stress|strain|thermodynamic|heat|pressure|beam|survey|fluid|electrical|engineering calculation)\b/.test(normalized)){
      k1Prompts=['Name the formula used for {t} and define each symbol.','Name the quantities required when applying the formula for {t}.','Show the units associated with the quantities used in {t}.','List the steps used to set up a calculation involving {t}.','Find the formula associated with {t} and state its purpose.','Recall the assumptions used with the formula for {t}.'];
      k2Prompts=['Explain how a formula for {t} relates its quantities to a result.','Illustrate how to set up a calculation involving {t} without supplying values.','Interpret the role of each quantity in a calculation for {t}.','Compare the input and result quantities used when calculating {t}.','Explain how units help check a calculation involving {t}.','Summarize how a suitable formula is selected and applied to {t}.'];
    }else if(/\b(algorithm|pseudocode|flowchart|complexity|sorting|searching|stack|queue|tree|graph|array|linked list|traversal|recursion|programming|data structure)\b/.test(normalized)){
      k1Prompts=['List the steps of {t} in order.','Recall the stopping condition used in {t}.','Name the input and output of {t}.','List the operations performed in {t}.','Name the data structure or method used in {t}.','Recall the order in which {t} processes its input.'];
      k2Prompts=['Explain the sequence of steps in the algorithm for {t}.','Illustrate how the procedure for {t} processes an input.','Interpret how the stopping condition affects the algorithm for {t}.','Compare the roles of input and output in the algorithm for {t}.','Summarize the state changes made during the algorithm for {t}.','Explain how to trace the algorithm for {t} step by step.'];
    }
    const cleanTopic=focusedTopic(topic).replace(/\\[nr]/gi,' ').replace(/\s+/g,' ').trim();
    for(const slot of slots.filter(s=>s.marks>1 && ['K1','K2'].includes(s.bloomLevel))){
      const prompts=slot.bloomLevel==='K1'?k1Prompts:k2Prompts;
      prompts.forEach((pattern,index)=>result.push({topic:cleanTopic.slice(0,200),unit,syllabusReference:topic,marks:slot.marks,difficulty:slot.difficulty,bloomLevel:slot.bloomLevel,bloomSource:'local-model',subtopic:classifyTopic(topic),text:pattern.replace('{t}',cleanTopic),pattern:index,questionType:'SHORT',options:[],answer:'',_topicGenerated:true}));
    }
  }
  return result;
}
function topicProblemCandidates(topics,slots) {
  const generated=[];
  const markCounts=new Map();
  for(const slot of slots){
    if(slot.marks<=1 || slot.bloomLevel==='K1' || slot.bloomLevel==='K2')continue;
    for(const {topic,unit} of topics){
      const normalized=topic.toLowerCase(), ordinalKey=`${unit}|${topic}|${slot.marks}|${slot.difficulty}`;
      const ordinal=markCounts.get(ordinalKey)||0;markCounts.set(ordinalKey,ordinal+1);
      const n=ordinal+1, easy=slot.difficulty==='EASY', hard=slot.difficulty==='HARD';
      let text=null, bloomLevel='K3';
      if(/\b(integral|integration|antiderivative)\b/.test(normalized)){
        const a=easy?1:hard?3:2, power=easy?1:hard?3:2;
        text=`Evaluate the definite integral ∫₀¹ (${a}x^${power} + ${n}x) dx. Show the integration steps and state the result.`;
      }else if(/\b(differentiat|derivative|differential calculus)\b/.test(normalized)){
        const a=n+1,b=n+2;
        text=`Differentiate f(x) = ${a}x² + ${b}x with respect to x. Show the derivative rule used.`;
      }else if(/\b(matrix|matrices|determinant|inverse matrix)\b/.test(normalized)){
        const a=n+1,b=2,c=3,d=n+4;
        text=`Calculate the determinant of the matrix [[${a}, ${b}], [${c}, ${d}]]. Show your calculation.`;
      }else if(/\b(probability|conditional probability)\b/.test(normalized)){
        const red=2+n,blue=3+(hard?2:0);
        text=`A bag contains ${red} red and ${blue} blue counters. One counter is drawn at random. Calculate the probability of drawing a red counter.`;
      }else if(/\b(boolean|digital logic|logic gate|truth table|boolean algebra)\b/.test(normalized)){
        text=n%2
          ? `Simplify the Boolean expression F(A,B) = AB + A'B using Boolean algebra. Show the equivalent expression.`
          : `Simplify the Boolean expression F(A,B) = A + A'B using Boolean algebra. Show the equivalent expression.`;
      }else if(/\b(circuit|ohm|resistive|electrical current|voltage|resistance|kirchhoff)\b/.test(normalized)){
        const voltage=12+2*n,resistance=4+2*(hard?n+1:n);
        text=`A ${voltage} V source is connected across a ${resistance} Ω resistor. Using the voltage, current and resistance relation, calculate the current in amperes.`;
      }else if(/\b(stress|strain|young.s modulus|material strength)\b/.test(normalized)){
        const force=(easy?2000:hard?12000:6000)+n*100,area=easy?100:hard?200:150;
        text=`A specimen with cross-sectional area ${area} mm² carries an axial force of ${force} N. Calculate the normal stress in N/mm².`;
      }else if(/\b(thermodynamic|specific heat|heat capacity|heat transfer)\b/.test(normalized)){
        const mass=easy?1:hard?3:2,delta=5+n;
        text=`A ${mass} kg material with specific heat capacity 4200 J/(kg·K) is heated by ${delta} K. Calculate the heat transferred using Q = mcΔT.`;
      }else if(/\b(force|newton|kinematic|mechanic|motion|acceleration)\b/.test(normalized)){
        const mass=easy?2:hard?8+n:4,acceleration=2+n;
        text=`A body of mass ${mass} kg accelerates at ${acceleration} m/s². Calculate the resultant force using F = ma.`;
      }else if(/\b(stack|queue)\b/.test(normalized)){
        const first=n,second=n+2;
        text=/queue/.test(normalized)
          ? `Trace the operations on an empty queue: enqueue ${first}, enqueue ${second}, then dequeue once. State the remaining contents in order.`
          : `Trace the operations on an empty stack: push ${first}, push ${second}, then pop once. State the remaining contents in order.`;
      }else if(/\b(sql|database|relational algebra|normalization|normalisation)\b/.test(normalized)){
        bloomLevel='K6';
        if(/\b(normalization|normalisation)\b/.test(normalized)){
          bloomLevel='K3';
          text='Solve this normalization problem: given Enrollment(student_id, student_name, course_id, course_name, instructor_id, instructor_name) and dependencies student_id → student_name, course_id → course_name and instructor_id, and instructor_id → instructor_name, decompose the relation into 3NF.';
        }else if(/\b(relational algebra)\b/.test(normalized)){
          bloomLevel='K3';
          text='Construct a relational algebra expression for Student(student_id, name, mark) that returns names of students with mark greater than 70.';
        }else text=`Given Student(student_id, name, mark), write an SQL query to return the name and mark of students with mark greater than ${60+5*n}, ordered by mark descending.`;
      }else if(/\b(subnet|ipv4|ip address|network address)\b/.test(normalized)){
        text=`Calculate the network address and usable host count for IPv4 address 192.168.${n}.130/26.`;
      }else if(/\b(scheduling|cpu scheduling|fcfs|first come first served)\b/.test(normalized)){
        text=`Using FCFS scheduling, processes P1, P2 and P3 arrive at time 0 with CPU burst times ${2+n}, ${1+n} and ${3+n} ms. Calculate each waiting time and the average waiting time.`;
      }else if(/\b(arrays?|programming|programs?|algorithms?|pseudocode|functions?)\b/.test(normalized)){
        bloomLevel='K6';
        text=`Write language-neutral pseudocode to find the maximum value in an array. For input [${n}, ${n+3}, ${n+1}], state the output and give the time complexity.`;
      }else if(/\b(sorting|sort algorithm|searching|search algorithm|time complexity|algorithm complexity)\b/.test(normalized)){
        text=`Trace insertion sort on the array [${n+3}, ${n}, ${n+2}, ${n+1}]. Show the array after the first two passes and state its time complexity in the average case.`;
      }else if(/\b(surveying|survey|right triangle|distance measurement)\b/.test(normalized)){
        text=`A survey line has perpendicular components of ${3+n} m east and 4 m north. Calculate its length and bearing angle from east.`;
      }else if(/\b(pressure|fluid mechanics|hydrostatic)\b/.test(normalized)){
        const force=(easy?100:hard?900:400)+50*n,area=easy?2:hard?3:2;
        text=`A force of ${force} N acts uniformly on an area of ${area} m². Calculate the pressure in pascals.`;
      }else if(/\b(beam|bending moment|structural analysis|simply supported)\b/.test(normalized)){
        const load=easy?4:hard?12:8,span=3+n;
        text=`A simply supported beam of span ${span} m carries a central point load of ${load} kN. Calculate the maximum bending moment using M = PL/4.`;
      }
      if(!text)continue;
      if(slot.bloomLevel && slot.bloomLevel!==bloomLevel)continue;
      if(slot.marks>=5 && classifySourceQuestionStyle(text)==='PROBLEM_SOLVING')text+=` Show the method, state the result, and include units where applicable.`;
      generated.push({topic:focusedTopic(topic).slice(0,200),subtopic:classifyTopic(topic),unit,syllabusReference:topic,text,marks:slot.marks,difficulty:slot.difficulty,bloomLevel,bloomSource:'local-model',pattern:ordinal,questionType:'SHORT',options:[],answer:'',_fromSource:true,_difficultyBound:true});
    }
  }
  return generated;
}
// Authored task grammars are constrained by marks and the requested cognitive level.
// The trained topic classifier selects topic families; the Bloom classifier audits task context.
const bloomTasks = {
 K1: ['Define {t}.','List two key terms associated with {t}.','Name one application of {t}.','Recall the main purpose of {t}.','List two characteristics of {t}.','Select the standard notation used for {t}.'],
 K2: ['Explain the purpose of {t}.','Summarize the central principle of {t}.','Describe the main stages of {t}.','Explain one benefit of {t}.','Outline the main idea of {t}.','Explain how {t} works.'],
 K3: ['Apply {t} to the supplied values and show each step.','Demonstrate the procedure for {t} using the given input.','Calculate the requested result using {t} and show the substitution.','Apply the steps of {t} to the specified data.','Determine the output of {t} for the stated input.','Solve the stated problem using {t} and show the method.'],
 K4: ['Analyze the relationship between two components of {t}.','Examine one cause and its effect within {t}.','Distinguish the roles of two elements within {t}.','Analyze one limitation of {t} and its underlying cause.','Inspect the structure of {t} and identify one dependency.','Analyze how changing one assumption affects {t}.'],
 K5: ['Justify whether {t} is suitable when simplicity is the primary criterion.','Evaluate one limitation of {t} against its intended purpose.','Assess {t} using reliability as an explicit criterion; justify your judgment.','Judge the suitability of {t} for the stated application.','Recommend whether to use {t} when resources are limited; justify the decision.','Defend one design choice in {t} using an explicit criterion.'],
 K6: ['Design one small modification to {t} that reduces complexity.','Create a simple alternative approach to {t}; specify its main change.','Propose one original improvement to {t} for a resource-constrained setting.','Develop a small design using {t} with one explicit constraint.','Formulate an implementation plan for {t} that meets the stated objective.','Design an adaptation of {t} for the specified application.'],
};
function bloomCandidates(topics, slots) {
 const levels=[...new Set(slots.filter(s=>s.bloomLevel).map(s=>s.bloomLevel))];
  return [...new Set(slots.map(s=>s.marks))].filter(m=>m>1).flatMap(marks=>topics.flatMap(({topic,unit})=>levels.flatMap(level=>
  bloomTasks[level].map((pattern,index)=>{
   let text=pattern.replace('{t}',focusedTopic(topic));
    return {topic:focusedTopic(topic).slice(0,200),unit,marks,bloomLevel:level,bloomSource:'local-model',subtopic:classifyTopic(topic),syllabusReference:topic,text,pattern:index,questionType:'SHORT',options:[],answer:''};
  })
 )));
}

export const reuseSignature=q=>questionHash(q.reuseKey || `${q.marks}|${q.text.toLowerCase().replace(/what is meant by/g,'define').replace(/\b(describe|discuss|explain|outline|illustrate)\b/g,'explain').replace(/[^\p{L}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim()}`);
function bankQuestionMatchesTopic(question, topic) {
  const words=value=>String(value || '').toLocaleLowerCase().normalize('NFKC')
    .replace(/[^\p{L}\p{N}]+/gu,' ').trim().split(/\s+/)
    .filter(word=>word && !/^(the|and|or|of|in|on|to|for|with|using|unit|chapter|topic)$/.test(word))
    .map(word=>word.endsWith('ies')?word.slice(0,-3)+'y':word.endsWith('s')&&!word.endsWith('ss')?word.slice(0,-1):word);
  const source=words(topic),sourceSet=new Set(source);
  return [question.topic,question.subtopic].some(label=>{
    const normalized=words(label),overlap=normalized.filter(word=>sourceSet.has(word)).length;
    return normalized.length>0 && (overlap>=2 || overlap===1 && Math.min(normalized.length,source.length)===1 && source.find(word=>normalized.includes(word))?.length>=4);
  });
}
export function generateLocalQuestions(text, slots, previousHashes=[], oneMarkType='MCQ', policy={}) {
  let topics=syllabusTopics(text);
  const topicKey=value=>String(value).toLocaleLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  if(policy.units?.length){const selectedUnits=new Set(policy.units);topics=topics.filter(t=>selectedUnits.has(t.unit));}
  if(policy.chapters?.length){
    const requested=new Set(policy.chapters.map(topicKey)),available=new Map(topics.map(t=>[topicKey(t.topic),t]));
    const missing=[...requested].filter(name=>!available.has(name));
    if(missing.length)throw new HttpError(400,`Selected chapter(s) not found in the chosen units: ${missing.join(', ')}.`);
    topics=topics.filter(t=>requested.has(topicKey(t.topic)));
  }
  if(!topics.length)throw new HttpError(409,'No syllabus chapters match the selected units. Choose different units or chapters.');
  const scopedReferences=new Set(topics.map(t=>`${t.unit}|${t.topic}`));
  const used=new Set(previousHashes), chosenHashes=new Set(), questions=[];
  const family=topic=>{const predicted=classifyTopic(topic);return predicted==='numerical'&&!/arithmetic|conversion|ratio|calculation|time|speedup|throughput|addition|subtraction|multiplication|division|performance|number system/i.test(topic)?'concept':predicted;};
  let candidates=[...new Set(slots.map(s=>s.marks))].filter(m=>m!==1).flatMap(marks=>topics.flatMap(({topic,unit})=>{
    const source=sourceQuestion(topic);
    if(source) return [{topic:topic.slice(0,200),subtopic:classifyTopic(topic),unit,syllabusReference:topic,text:source,pattern:0,marks,_fromSource:true,_sourceAuthored:true}];
    // Topic labels do not provide values or formulas. Require an authored
    // problem or a stored question instead of fabricating numerical inputs.
    return patterns[family(topic)].map((pattern,index)=>({topic:(marks<=5?focusedTopic(topic):topic).slice(0,200),subtopic:classifyTopic(topic),unit,syllabusReference:topic,text:markedText(topic,family(topic),marks,index),pattern:index,marks}));
  }));
  for(const question of policy.bankQuestions || []){
    const source=topics.find(t=>t.unit===question.unit && bankQuestionMatchesTopic(question,t.topic));
    if(!source || !slots.some(slot=>slot.marks===question.marks) || question.marks===1 && question.questionType!==oneMarkType)continue;
    candidates.push({...question,unit:source.unit,syllabusReference:source.topic,pattern:0,bloomLevel:questionBloomLevel(question),_fromBank:true});
  }
  candidates.push(...topicProblemCandidates(topics,slots).map(q=>({...q,_topicGenerated:true})));
  candidates.push(...sectionRecallCandidates(topics,slots,policy.questionStyle));
  if(slots.some(s=>s.marks===1)) candidates.push(...objectiveCandidates(topics,oneMarkType).map(q=>({...q,reuseKey:`objective:${q.topic.toLowerCase()}`})));
  if(slots.some(s=>s.bloomLevel)){
    const sourceQuestions=candidates.filter(q=>sourceQuestion(q.syllabusReference)===q.text).map(q=>({...q,bloomLevel:questionBloomLevel(q),bloomSource:'local-model',_fromSource:true}));
    const bankQuestions=candidates.filter(q=>q._fromBank);
    const topicProblems=candidates.filter(q=>q._topicGenerated);
    const objectives=candidates.filter(q=>q.marks===1).map(q=>({...q,bloomLevel:q.numericalVariant?'K3':'K1',bloomSource:'local-model',text:q.numericalVariant?'Apply the appropriate method: '+q.text:q.questionType==='FILL_BLANK'?'Recall the term: '+q.text:q.text.replace(/^Identify/, 'Name')}));
    const numerical=candidates.filter(q=>q.marks>1 && q.numericalVariant).map(q=>({...q,bloomLevel:'K3',bloomSource:'local-model',text:'Apply the appropriate method: '+q.text}));
    candidates=[...bloomCandidates(topics,slots,oneMarkType),...sourceQuestions,...bankQuestions,...topicProblems,...objectives,...numerical];
  }
  for(const q of policy.reviewedQuestions || []){
    const source=topics.find(t=>t.topic.toLowerCase().includes(q.topic.replaceAll('_',' ').toLowerCase()));
    if(source && slots.some(s=>s.marks===q.marks) && (q.marks!==1 || q.questionType===oneMarkType))candidates.push({...q,topic:q.topic,unit:source.unit,syllabusReference:source.topic,pattern:0,reviewed:true});
  }
  candidates=candidates.filter(q=>scopedReferences.has(`${q.unit}|${q.syllabusReference || ''}`) && typeof q.text==='string' && q.text.trim().length>0);
  if(policy.questionStyle && policy.questionStyle!=='MIXED')candidates=candidates.filter(q=>questionKind(q)===policy.questionStyle);
  const kindsPresent=new Set(candidates.map(questionKind));
  const mixedWeights={THEORY:1,PROBLEM_SOLVING:1,PROGRAMMING_SQL:1};
  if(policy.questionStyle==='MIXED' && kindsPresent.has('THEORY')){
    const mathTopics=topics.some(t=>/\b(calculus|integral|integration|differentiat|matrix|matrices|determinant|probability|algebra|equation|differential)\b/i.test(t.topic));
    if(mathTopics && kindsPresent.has('PROBLEM_SOLVING')){mixedWeights.THEORY=.3;mixedWeights.PROBLEM_SOLVING=.7;}
    else if(kindsPresent.has('PROGRAMMING_SQL') && kindsPresent.has('PROBLEM_SOLVING')){mixedWeights.THEORY=.4;mixedWeights.PROBLEM_SOLVING=.3;mixedWeights.PROGRAMMING_SQL=.3;}
    else if(kindsPresent.has('PROBLEM_SOLVING')){mixedWeights.THEORY=.4;mixedWeights.PROBLEM_SOLVING=.6;}
    else if(kindsPresent.has('PROGRAMMING_SQL')){mixedWeights.THEORY=.5;mixedWeights.PROGRAMMING_SQL=.5;}
  }
  const oldSignatures=new Set(policy.previousSignatures || []), currentSignatures=new Set();
  const repeatBudget=Math.floor(slots.length * Math.min(20,Math.max(0,policy.repeatPercent ?? 20))/100);
  let repeats=0;
  const isOld=q=>used.has(questionHash(q.text)) || oldSignatures.has(reuseSignature(q));
  for(let i=candidates.length-1;i>0;i--){const j=randomInt(i+1);[candidates[i],candidates[j]]=[candidates[j],candidates[i]];}
  const topicUse=new Map(), kindUse=new Map();
  for(const slot of slots){
    const available=candidates.filter(q=>q.marks===slot.marks && (!(q._fromBank || q._difficultyBound) || q.difficulty===slot.difficulty) && (!slot.bloomLevel || q.bloomLevel===slot.bloomLevel && (startsWithBloomVerb(q.text,slot.bloomLevel) || (q._fromBank || q._fromSource) && taskBloomLevel(q.text)===slot.bloomLevel)) && !chosenHashes.has(questionHash(q.text)) && !(q.numericalVariant && used.has(questionHash(q.text))) && !currentSignatures.has(reuseSignature(q)) && (!isOld(q) || repeats<repeatBudget));
    if(!available.length) throw new HttpError(409,`Insufficient fresh relevant questions for the selected units/chapters (${slot.marks}-mark${slot.bloomLevel?' '+slot.bloomLevel:''}): found ${questions.length} of ${slots.length} valid questions; shortage ${slots.length-questions.length}. Add relevant topics or bank questions, select more chapters, or request fewer questions.`);
    const desired=slot.difficulty==='EASY'?0:slot.difficulty==='MEDIUM'?2:5;
    available.sort((a,b)=>Number(isOld(a))-Number(isOld(b)) || Number(!(a._fromBank||a._sourceAuthored))-Number(!(b._fromBank||b._sourceAuthored)) || (policy.questionStyle==='MIXED'?(kindUse.get(questionKind(a))||0)/mixedWeights[questionKind(a)]-(kindUse.get(questionKind(b))||0)/mixedWeights[questionKind(b)]:0) || (topicUse.get(a.topic)||0)-(topicUse.get(b.topic)||0) || Number(!(a._fromBank||a._fromSource))-Number(!(b._fromBank||b._fromSource)) || Number(!!slot.bloomLevel && classifyBloom(a.text)!==slot.bloomLevel)-Number(!!slot.bloomLevel && classifyBloom(b.text)!==slot.bloomLevel) || Math.abs(a.pattern-desired)-Math.abs(b.pattern-desired));
    const chosen=available[0],reused=isOld(chosen);if(reused)repeats++;chosenHashes.add(questionHash(chosen.text));currentSignatures.add(reuseSignature(chosen));topicUse.set(chosen.topic,(topicUse.get(chosen.topic)||0)+1);
    const {_fromBank,_fromSource,_topicGenerated,_difficultyBound,_sourceAuthored,...paperQuestion}=chosen;
    questions.push({...paperQuestion,...slot,reused,reuseSignature:reuseSignature(chosen),id:`LOCAL${questions.length+1}`});
    const kind=questionKind(chosen);kindUse.set(kind,(kindUse.get(kind)||0)+1);
  }
  return questions;
}
