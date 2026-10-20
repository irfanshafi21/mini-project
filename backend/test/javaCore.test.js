import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generatePaper, planPaper } from '../src/javaCore.js';

const split = { easy: 40, medium: 40, hard: 20 };
test('Node calls Java to select stored questions, preserving API metadata', async () => {
  const pool = [[101, 'EASY', 2], [102, 'EASY', 2], [103, 'MEDIUM', 5], [104, 'MEDIUM', 5], [105, 'HARD', 10]]
    .map(([id, difficulty, marks]) => ({ id, difficulty, marks, text: `Question ${id}` }));
  const result = await generatePaper(pool, 24, split);
  assert.equal(result.totalMarks, 24);
  assert.deepEqual(result.questions.map(q => q.id), [101, 102, 103, 104, 105]);
  assert.equal(result.questions[0].text, 'Question 101');
  assert.deepEqual(result.targets, { EASY: 10, MEDIUM: 10, HARD: 4 });
  assert.equal((await generatePaper(pool, 40, split)).totalMarks, 24);
});
test('Java validates paper parameters and Node reports an unavailable runtime', async () => {
  await assert.rejects(planPaper(1, 5, split), e => e.status === 503);
  const original = process.env.JAVA_COMMAND;
  process.env.JAVA_COMMAND = 'missing-java-runtime-for-test';
  try { await assert.rejects(planPaper(25, 5, split), e => e.status === 503 && /Install JDK/.test(e.message)); }
  finally { if (original === undefined) delete process.env.JAVA_COMMAND; else process.env.JAVA_COMMAND = original; }
});

test('Java plans a 100-question paper without exceeding marks or difficulty totals', async () => {
  const plan = await planPaper(100, 100, { easy: 50, medium: 30, hard: 20 }, { 1: 100 });
  assert.equal(plan.length, 100);
  assert.equal(plan.reduce((sum, item) => sum + item.marks, 0), 100);
  assert.deepEqual(
    Object.fromEntries(['EASY', 'MEDIUM', 'HARD'].map(level => [level, plan.filter(item => item.difficulty === level).length])),
    { EASY: 50, MEDIUM: 30, HARD: 20 },
  );
});
