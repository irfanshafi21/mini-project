import { Router } from 'express';
import { query } from '../db.js';

const router = Router();

const toMap = (rows, key) => Object.fromEntries(rows.map((r) => [r[key], r.n]));

// GET /api/stats
router.get('/', async (_req, res) => {
  const [totals, diff, marks, unit, topic, subject] = await Promise.all([
    query('SELECT count(*)::int AS n, coalesce(sum(marks), 0)::int AS marks FROM questions WHERE NOT is_deleted'),
    query('SELECT difficulty AS k, count(*)::int AS n FROM questions WHERE NOT is_deleted GROUP BY 1'),
    query('SELECT marks AS k, count(*)::int AS n FROM questions WHERE NOT is_deleted GROUP BY 1 ORDER BY 1'),
    query('SELECT unit AS k, count(*)::int AS n FROM questions WHERE NOT is_deleted GROUP BY 1 ORDER BY 1'),
    query('SELECT topic AS k, count(*)::int AS n FROM questions WHERE NOT is_deleted GROUP BY 1 ORDER BY 1'),
    query(`SELECT s.name AS k, count(q.id)::int AS n
      FROM (SELECT name FROM subjects UNION SELECT subject AS name FROM questions) s
      LEFT JOIN questions q ON q.subject = s.name AND NOT q.is_deleted
      GROUP BY s.name ORDER BY s.name`),
  ]);
  res.json({
    totalQuestions: totals.rows[0].n,
    totalMarks: totals.rows[0].marks,
    byDifficulty: { EASY: 0, MEDIUM: 0, HARD: 0, ...toMap(diff.rows, 'k') },
    byMarks: toMap(marks.rows, 'k'),
    byUnit: toMap(unit.rows, 'k'),
    byTopic: toMap(topic.rows, 'k'),
    bySubject: toMap(subject.rows, 'k'),
  });
});

export default router;
