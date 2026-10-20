import { assignBloomSlots } from './blooms.js';
import { z } from 'zod';
import { HttpError } from './errors.js';
import { normalizeName, markCountsSchema, validMarkPattern, bloomCountsSchema, validBloomCounts } from './validation.js';
import { planPaper } from './javaCore.js';
import { extractSyllabusText, generateLocalQuestions } from './localModel.js';
import { generateGroqQuestions, generateOllamaQuestions } from './groqQuestionGenerator.js';
export { planPaper } from './javaCore.js';

export const syllabusBody = z.object({
  subject: z.string().trim().max(60).optional().transform(v => v ? normalizeName(v) : undefined),
  oneMarkType:z.enum(['MCQ','FILL_BLANK']).default('MCQ'),
  questionStyle:z.enum(['MIXED','THEORY','PROBLEM_SOLVING','PROGRAMMING_SQL']).default('MIXED'),
  unit: z.number().int().min(1).max(5).default(1),
  units: z.array(z.number().int().min(1).max(5)).min(1).max(5).transform(values => [...new Set(values)]).optional(),
  chapters: z.array(z.string().trim().min(1).max(200)).min(1).max(50).optional(),
  fileName: z.string().min(1).max(200),
  mimeType: z.enum(['application/pdf', 'text/plain']),
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
  const slots=assignBloomSlots(await planPaper(body.totalMarks,body.count,body.split,body.markCounts),body.bloomCounts);
  const provider=(process.env.AI_PROVIDER || 'ollama').toLowerCase();
  const questions=provider==='groq'
    ? await generateGroqQuestions({body,text,slots,bankQuestions})
    : provider==='ollama'
      ? await generateOllamaQuestions({body,text,slots,bankQuestions})
      : generateLocalQuestions(text,slots,body.previousQuestionHashes || [],body.oneMarkType,{
      previousSignatures:body.previousSignatures,reviewedQuestions:body.reviewedQuestions,units:body.units,chapters:body.chapters,bankQuestions,questionStyle:body.questionStyle,
    });
  return {paper:{source:'syllabus',fileName:body.fileName,subject:body.subject,
    requestedMarks:body.totalMarks,totalMarks:body.totalMarks,complete:true,requestedSplit:body.split,
    bloomCounts:body.bloomCounts,model:provider==='groq'?process.env.GROQ_MODEL || 'groq':provider==='ollama'?process.env.OLLAMA_MODEL || 'qwen3.5:9b':'college-local-classifier-grammar-v2',questions}};
}
