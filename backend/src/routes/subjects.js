import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { HttpError } from '../errors.js';
import { normalizeName } from '../validation.js';

const router = Router();
const subjectBody = z.object({ name: z.string().trim().min(1).max(60).transform(normalizeName) });

export async function ensureSubject(name) {
  await query('INSERT INTO subjects(name) VALUES($1) ON CONFLICT(name) DO NOTHING',[name]);
}

export async function requireRegisteredSubject(name) {
  const { rows } = await query('SELECT name FROM subjects WHERE name = $1', [name]);
  if (!rows.length) throw new HttpError(400, 'Register this subject in Subjects before using it.');
}

export async function recordGeneratedPaper(subject, count, source) {
  await query(`UPDATE subjects SET
    syllabus_questions = syllabus_questions + $2,
    bank_questions = bank_questions + $3,
    generated_papers = generated_papers + 1 WHERE name = $1`,
  [subject, source === 'syllabus' ? count : 0, source === 'bank' ? count : 0]);
}

router.get('/:name/overview', async (req, res) => {
  const name = subjectBody.parse({ name: req.params.name }).name;
  const { rows } = await query(`SELECT s.name, s.syllabus_questions, s.bank_questions, s.generated_papers,
    count(q.id)::int AS total_questions,
    count(q.id) FILTER (WHERE q.marks = 2)::int AS marks_2,
    count(q.id) FILTER (WHERE q.marks = 5)::int AS marks_5,
    count(q.id) FILTER (WHERE q.marks = 10)::int AS marks_10,
    count(q.id) FILTER (WHERE q.marks = 16)::int AS marks_16,
    count(q.id) FILTER (WHERE q.marks NOT IN (2,5,10,16))::int AS other_marks
    FROM subjects s LEFT JOIN questions q ON q.subject = s.name AND NOT q.is_deleted
    WHERE s.name = $1 GROUP BY s.name`, [name]);
  if (!rows.length) throw new HttpError(404, 'Subject not found');
  const row = rows[0];
  const syllabusQuestions = Number(row.syllabus_questions), bankQuestions = Number(row.bank_questions);
  const storage = await query('SELECT table_name FROM subject_storage WHERE subject=$1',[name]);
  res.json({ subject: row.name, storageTable: storage.rows[0]?.table_name, totalQuestions: row.total_questions,
    byMarks: { 2: row.marks_2, 5: row.marks_5, 10: row.marks_10, 16: row.marks_16 }, otherMarks: row.other_marks,
    generatedQuestions: syllabusQuestions + bankQuestions, syllabusQuestions, bankQuestions,
    generatedPapers: Number(row.generated_papers) });
});

router.post('/', async (req, res) => {
  const { name } = subjectBody.parse(req.body);
  const { rows } = await query('INSERT INTO subjects (name) VALUES ($1) ON CONFLICT (name) DO NOTHING RETURNING name', [name]);
  if (!rows.length) return res.status(409).json({ error: 'This subject already exists' });
  res.status(201).json({ name: rows[0].name });
});

export default router;
