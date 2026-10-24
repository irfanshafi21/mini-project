import { assignBloomSlots } from './blooms.js';
import { z } from 'zod';
import { HttpError } from './errors.js';
import { normalizeName, markCountsSchema, validMarkPattern, bloomCountsSchema, validBloomCounts } from './validation.js';
import { planPaper } from './javaCore.js';
import { classifySourceQuestionStyle, extractSyllabusText, generateLocalQuestions, syllabusTopics } from './localModel.js';
import { generateGeminiQuestions, generateGroqQuestions } from './groqQuestionGenerator.js';
import { MAX_SYLLABUS_UNITS } from './unitNumbers.js';
export { planPaper } from './javaCore.js';

export const syllabusBody = z.object({
  subject: z.string().trim().max(60).optional().transform(v => v ? normalizeName(v) : undefined),
  oneMarkType:z.enum(['MCQ','FILL_BLANK']).default('MCQ'),
  questionStyle:z.enum(['MIXED','THEORY','PROBLEM_SOLVING','PROGRAMMING_SQL']).default('MIXED'),
  questionStyles:z.object(Object.fromEntries([1,2,5,10,16].map(m=>[String(m),z.enum(['MIXED','THEORY','PROBLEM_SOLVING','PROGRAMMING_SQL']).optional()]))).optional(),
  unit: z.number().int().min(1).max(MAX_SYLLABUS_UNITS).default(1),
  units: z.array(z.number().int().min(1).max(MAX_SYLLABUS_UNITS)).min(1).max(MAX_SYLLABUS_UNITS).transform(values => [...new Set(values)]).optional(),
  chapters: z.array(z.string().trim().min(1).max(200)).min(1).max(50).optional(),
  fileName: z.string().min(1).max(200),
  mimeType: z.enum(['application/pdf', 'text/plain', 'image/jpeg', 'image/png', 'image/webp']),
  data: z.string().min(1).max(7_000_000).regex(/^[A-Za-z0-9+/]+={0,2}$/),
  totalMarks: z.number().int().min(1).max(1000),
  count: z.number().int().min(0).max(100),
  markCounts: markCountsSchema.optional(),
  bloomCounts:bloomCountsSchema.optional(),
  split: z.object({ easy: z.number().min(0).max(100), medium: z.number().min(0).max(100), hard: z.number().min(0).max(100) }),
}).refine(b => Math.abs(b.split.easy + b.split.medium + b.split.hard - 100) < 0.001,
  { message: 'Difficulty percentages must add up to 100', path: ['split'] })
  .refine(b => b.markCounts || (b.count > 0 && b.totalMarks >= b.count && b.totalMarks <= b.count * 100),
    { message: 'Total marks must allow 1–100 marks per question', path: ['totalMarks'] }).refine(validBloomCounts,{message:'K1-K6 counts must match each mark category.',path:['bloomCounts']}).refine(validMarkPattern, { message: 'Question counts must total the requested marks and match the question count (or use 0 for automatic).', path: ['markCounts'] });

export async function generateSyllabusPaper(body, { bankQuestions = [] } = {}) {
  const text=body.preparedText || await extractSyllabusText(body);
  const slots=assignBloomSlots(await planPaper(body.totalMarks,body.count,body.split,body.markCounts),body.bloomCounts)
    .map(slot=>({...slot,questionStyle:body.questionStyles?.[slot.marks] || body.questionStyle}));
  const provider=(process.env.AI_PROVIDER || 'gemini').toLowerCase();
  const localOptions={previousSignatures:body.previousSignatures,reviewedQuestions:body.reviewedQuestions,units:body.units,chapters:body.chapters,bankQuestions,questionStyle:body.questionStyle,questionStyles:body.questionStyles};
  const generateWith=selected => selected==='gemini'
    ? generateGeminiQuestions({body,text,slots,bankQuestions})
    : selected==='groq'
    ? generateGroqQuestions({body,text,slots,bankQuestions})
    : Promise.resolve(generateLocalQuestions(text,slots,body.previousQuestionHashes || [],body.oneMarkType,localOptions));
  let activeProvider=provider;
  let questions;
  try {
    questions=await generateWith(provider);
  } catch(primaryError) {
    const fallback=(process.env.AI_FALLBACK_PROVIDER || (provider==='groq'?'gemini':'')).toLowerCase();
    const keyNames=fallback==='gemini'
      ? ['GEMINI_API_KEY','GEMINI_API_KEY_FALLBACK_1','GEMINI_API_KEY_FALLBACK_2']
      : fallback==='groq'
      ? ['GROQ_API_KEY','GROQ_API_KEY_FALLBACK_1','GROQ_API_KEY_FALLBACK_2']
      : [];
    const hasFallbackKey=keyNames.some(name=>String(process.env[name]||'').trim());
    if(!fallback || fallback===provider || !hasFallbackKey || !(primaryError instanceof HttpError) || primaryError.status<500) throw primaryError;
    console.warn('[Question generation fallback]',JSON.stringify({from:provider,to:fallback,status:primaryError.status}));
    questions=await generateWith(fallback);
    activeProvider=fallback;
  }
  const questionStyleCoverage=questions.reduce((counts, question)=>{
    const style=classifySourceQuestionStyle(question.text);
    counts[style]=(counts[style]||0)+1;
    return counts;
  },{});
  const syllabusUnits=[...new Set(syllabusTopics(text).map(item=>item.unit))].sort((a,b)=>a-b);
  const selectedUnits=body.units || syllabusUnits;
  return {paper:{source:'syllabus',fileName:body.fileName,subject:body.subject,questionStyle:body.questionStyle,questionStyles:body.questionStyles,
    units:selectedUnits,questionStyleCoverage,requestedMarks:body.totalMarks,totalMarks:body.totalMarks,complete:true,requestedSplit:body.split,
    bloomCounts:body.bloomCounts,model:activeProvider==='gemini'?process.env.GEMINI_MODEL || 'gemini-3.8-flash':activeProvider==='groq'?process.env.GROQ_MODEL || 'groq':'college-local-classifier-grammar-v2',questions}};
}
