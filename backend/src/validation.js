import { z } from 'zod';

export const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'];
export const TOTAL_UNITS = 5;

// "data structures" -> "DATA_STRUCTURES"  (same rule as the Java CLI)
export const normalizeName = (s) => s.trim().toUpperCase().replace(/\s+/g, '_');

const name = z.string().trim().min(1, 'cannot be empty').max(60).transform(normalizeName);
const unit = z.coerce.number().int().min(1).max(TOTAL_UNITS);
const marks = z.coerce.number().int().min(1).max(100);
const difficulty = z.preprocess(
  (v) => (typeof v === 'string' ? v.trim().toUpperCase() : v),
  z.enum(DIFFICULTIES, { error: 'difficulty must be EASY, MEDIUM or HARD' }),
);

export const markCountsSchema = z.object(Object.fromEntries([2, 5, 10, 16].map(m => [String(m), z.number().int().min(0).max(50)])));
export function validMarkPattern(b) {
  if (!b.markCounts) return true;
  const entries = Object.entries(b.markCounts), count = entries.reduce((n, [, c]) => n + c, 0);
  return count === 0 || (count <= 50 && entries.reduce((n, [m, c]) => n + Number(m) * c, 0) === b.totalMarks && (!b.count || b.count === count));
}

export const questionBody = z.object({
  subject: name,
  unit,
  topic: name,
  subtopic: name,
  difficulty,
  marks,
  text: z.string().trim().max(2000).default(''),
});

export const listQuery = z.object({
  subject: name.optional(),
  unit: unit.optional(),
  topic: name.optional(),
  subtopic: name.optional(),
  difficulty: difficulty.optional(),
  marks: marks.optional(),
  q: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const paperBody = z
  .object({
    subject: z.preprocess(v => typeof v === "string" && !v.trim() ? undefined : v, name.optional()),
    unit: z.coerce.number().int().min(0).max(TOTAL_UNITS).default(0), // 0 = all units
    units: z.array(z.number().int().min(1).max(TOTAL_UNITS)).min(1).max(5).transform(values => [...new Set(values)]).optional(),
    topic: name.optional(),
    subtopic: name.optional(),
    totalMarks: z.coerce.number().int().min(1).max(1000),
    count: z.number().int().min(0).max(50).default(0),
    markCounts: markCountsSchema.optional(),
    split: z
      .object({
        easy: z.coerce.number().min(0).max(100),
        medium: z.coerce.number().min(0).max(100),
        hard: z.coerce.number().min(0).max(100),
      })
      .default({ easy: 40, medium: 40, hard: 20 }),
  })
  .refine((b) => Math.abs(b.split.easy + b.split.medium + b.split.hard - 100) < 0.001, {
    message: 'split percentages must add up to 100',
    path: ['split'],
  }).refine(validMarkPattern, { message: 'Question counts must total the requested marks and match the question count (or use 0 for automatic).', path: ['markCounts'] });

export const autoBody = z.object({
  subject: name,
  unit: unit.optional(),
  topic: name,
  subtopic: name.optional(),
  marks,
  difficulty,
  count: z.coerce.number().int().min(1).max(50).default(5),
});

// accepts 101 or "Q101"
export function parseId(raw) {
  const m = /^q?(\d+)$/i.exec(String(raw).trim());
  return m ? Number(m[1]) : null;
}
