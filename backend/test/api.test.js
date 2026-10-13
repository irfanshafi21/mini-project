// Run with: npm test   (uses its own database "questionbank_test", so your real data is never touched)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { after, before, test } from 'node:test';

process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/questionbank_test';

const { app } = await import('../src/app.js');
const { pool, query } = await import('../src/db.js');

let server;
let base;

before(async () => {
  await query(fs.readFileSync(new URL('../sql/schema.sql', import.meta.url), 'utf8'));
  await query('TRUNCATE questions RESTART IDENTITY');
  await query('DELETE FROM subjects');
  for (const name of ['GENERAL','DATA_STRUCTURES','PROGRAMMING','ALGORITHMS']) await query('INSERT INTO subjects(name) VALUES($1)', [name]);
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server.close();
  await pool.end();
});

async function call(method, path, body) {
  const res = await fetch(base + path, {
    method,
    headers: body ? { 'content-type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
}

const q = (unit, topic, subtopic, difficulty, marks, text) => ({ subject: 'GENERAL', unit, topic, subtopic, difficulty, marks, text });

test('health check', async () => {
  const r = await call('GET', '/api/health');
  assert.equal(r.status, 200);
  assert.equal(r.body.status, 'ok');
});

test('adding questions assigns numbers automatically (Q101, Q102, ...) and normalizes names', async () => {
  const first = await call('POST', '/api/questions', q(1, 'java', 'stack', 'easy', 2, 'What is a stack?'));
  assert.equal(first.status, 201);
  assert.equal(first.body.code, 'Q101');
  assert.equal(first.body.topic, 'JAVA');
  assert.equal(first.body.difficulty, 'EASY');

  const rest = [
    q(1, 'Java', 'Queue', 'EASY', 2, 'Define a queue.'),
    q(1, 'Java', 'HashMap', 'MEDIUM', 5, 'Explain how HashMap stores key-value pairs.'),
    q(1, 'Java', 'ArrayList', 'MEDIUM', 5, 'Differentiate ArrayList and LinkedList.'),
    q(1, 'Java', 'PriorityQueue', 'HARD', 10, 'Explain PriorityQueue with a task scheduling program.'),
    q(2, 'Data Structures', 'Bubble Sort', 'EASY', 2, 'What is bubble sort?'),
  ];
  const codes = [];
  for (const body of rest) codes.push((await call('POST', '/api/questions', body)).body.code);
  assert.deepEqual(codes, ['Q102', 'Q103', 'Q104', 'Q105', 'Q106']);

  const last = await call('GET', '/api/questions/106');
  assert.equal(last.body.topic, 'DATA_STRUCTURES');
  assert.equal(last.body.subtopic, 'BUBBLE_SORT');
});

test('validation: unit must be 1-5, difficulty must be valid', async () => {
  const badUnit = await call('POST', '/api/questions', q(7, 'Java', 'Stack', 'EASY', 2, 'x'));
  assert.equal(badUnit.status, 400);
  assert.equal(badUnit.body.details[0].field, 'unit');

  const badLevel = await call('POST', '/api/questions', q(1, 'Java', 'Stack', 'SUPER', 2, 'y'));
  assert.equal(badLevel.status, 400);
  assert.equal(badLevel.body.details[0].field, 'difficulty');
});

test('the same question text cannot be added twice in one unit', async () => {
  const r = await call('POST', '/api/questions', q(1, 'Java', 'Stack', 'EASY', 2, 'what is a STACK?'));
  assert.equal(r.status, 409);
});

test('list, filter and search', async () => {
  const all = await call('GET', '/api/questions');
  assert.equal(all.body.total, 6);
  assert.equal((await call('GET', '/api/questions?topic=java')).body.total, 5);
  assert.equal((await call('GET', '/api/questions?unit=2')).body.total, 1);
  assert.equal((await call('GET', '/api/questions?difficulty=medium')).body.total, 2);
  assert.equal((await call('GET', '/api/questions?q=hashmap')).body.items[0].code, 'Q103');
  assert.equal((await call('GET', '/api/questions?limit=2&page=3')).body.items.length, 2);
});

test('update and not-found handling', async () => {
  const ok = await call('PUT', '/api/questions/Q102', q(1, 'Java', 'Queue', 'EASY', 2, 'Define a queue and name its types.'));
  assert.equal(ok.status, 200);
  assert.equal(ok.body.text, 'Define a queue and name its types.');
  assert.equal((await call('PUT', '/api/questions/999', q(1, 'Java', 'Queue', 'EASY', 2, 'z'))).status, 404);
  assert.equal((await call('GET', '/api/questions/abc')).status, 400);
});

test('delete is a soft delete and undo restores the last deleted question', async () => {
  assert.equal((await call('DELETE', '/api/questions/103')).status, 200);
  assert.equal((await call('GET', '/api/questions')).body.total, 5);
  assert.equal((await call('GET', '/api/questions/103')).status, 404);
  assert.equal((await call('GET', '/api/questions/deleted')).body.items[0].code, 'Q103');

  const undo = await call('POST', '/api/questions/undo');
  assert.equal(undo.body.code, 'Q103');
  assert.equal((await call('GET', '/api/questions')).body.total, 6);
  assert.equal((await call('POST', '/api/questions/undo')).status, 404);
  assert.equal((await call('POST', '/api/questions/103/restore')).status, 404);
});

test('statistics', async () => {
  const s = (await call('GET', '/api/stats')).body;
  assert.equal(s.totalQuestions, 6);
  assert.equal(s.totalMarks, 26);
  assert.deepEqual(s.byDifficulty, { EASY: 3, MEDIUM: 2, HARD: 1 });
  assert.deepEqual(s.byUnit, { 1: 5, 2: 1 });
});

test('paper generation: 24 marks for unit 1, topic JAVA', async () => {
  const r = await call('POST', '/api/papers/generate', { subject: 'GENERAL', unit: 1, topic: 'java', totalMarks: 24 });
  assert.equal(r.status, 200);
  assert.equal(r.body.paper.totalMarks, 24);
  assert.equal(r.body.paper.complete, true);
  assert.deepEqual(r.body.paper.targets, { EASY: 10, MEDIUM: 10, HARD: 4 });
  assert.deepEqual(r.body.paper.questions.map((x) => x.code), ['Q101', 'Q102', 'Q103', 'Q104', 'Q105']);
});

test('paper generation reports when the bank is too small, and validates the split', async () => {
  const short = await call('POST', '/api/papers/generate', { subject: 'GENERAL', unit: 1, topic: 'java', totalMarks: 40 });
  assert.equal(short.body.paper.complete, false);
  assert.equal(short.body.paper.totalMarks, 24);
  assert.match(short.body.warning, /Only 24 of 40/);

  const bad = await call('POST', '/api/papers/generate', { subject: 'GENERAL', totalMarks: 20, split: { easy: 50, medium: 50, hard: 50 } });
  assert.equal(bad.status, 400);

  assert.equal((await call('POST', '/api/papers/generate', { subject: 'GENERAL', unit: 5, totalMarks: 10 })).status, 404);
});

test('automatic selection by topic, marks and difficulty reports any shortfall', async () => {
  const r = await call('POST', '/api/generate/questions', { subject: 'GENERAL', topic: 'java', marks: 5, difficulty: 'medium', count: 5 });
  assert.equal(r.status, 200);
  assert.equal(r.body.found, 2);
  assert.equal(r.body.shortfall, 3);
  assert.ok(r.body.note);
});

test('subjects are stored, searchable, editable and isolate generated papers', async () => {
  const first = await call('POST', '/api/questions', { ...q(1, 'Arrays', 'Searching', 'EASY', 5, 'Explain the process of linear search.'), subject: 'Data Structures' });
  assert.equal(first.status, 201);
  assert.equal(first.body.subject, 'DATA_STRUCTURES');
  const other = await call('POST', '/api/questions', { ...q(1, 'Arrays', 'Searching', 'EASY', 5, 'Explain the process of linear search.'), subject: 'Programming' });
  assert.equal(other.status, 201);
  const duplicate = await call('POST', '/api/questions', { ...q(1, 'Arrays', 'Searching', 'EASY', 5, 'Explain the process of linear search.'), subject: 'Data Structures' });
  assert.equal(duplicate.status, 409);
  const list = await call('GET', '/api/questions?subject=data%20structures');
  assert.equal(list.body.total, 1);
  assert.equal(list.body.items[0].id, first.body.id);
  const paper = await call('POST', '/api/papers/generate', { subject: 'Data Structures', totalMarks: 5 });
  assert.equal(paper.body.paper.subject, 'DATA_STRUCTURES');
  assert.deepEqual(paper.body.paper.questions.map(item => item.id), [first.body.id]);
  const stats = await call('GET', '/api/stats');
  assert.equal(stats.body.bySubject.DATA_STRUCTURES, 1);
  assert.equal(stats.body.bySubject.PROGRAMMING, 1);
  const changed = await call('PUT', `/api/questions/${first.body.id}`, { ...q(1, 'Arrays', 'Searching', 'EASY', 5, 'Explain linear search with an example.'), subject: 'Algorithms' });
  assert.equal(changed.body.subject, 'ALGORITHMS');
  assert.equal((await call('GET', '/api/questions?subject=data%20structures')).body.total, 0);
});

test('a subject can be created before questions and persists with a zero count', async () => {
  const created = await call('POST', '/api/subjects', { name: 'Software Engineering' });
  assert.equal(created.status, 201);
  assert.equal(created.body.name, 'SOFTWARE_ENGINEERING');
  assert.equal((await call('GET', '/api/stats')).body.bySubject.SOFTWARE_ENGINEERING, 0);
  assert.equal((await call('GET', '/api/questions?subject=software%20engineering')).body.total, 0);
  assert.equal((await call('POST', '/api/subjects', { name: 'software engineering' })).status, 409);
  assert.equal((await call('POST', '/api/subjects', { name: '   ' })).status, 400);
  const added = await call('POST', '/api/questions', { ...q(1, 'Testing', 'Unit Tests', 'EASY', 2, 'Define a unit test.'), subject: 'Software Engineering' });
  assert.equal(added.status, 201);
  assert.equal((await call('GET', '/api/stats')).body.bySubject.SOFTWARE_ENGINEERING, 1);
  await call('DELETE', `/api/questions/${added.body.id}`);
  assert.equal((await call('GET', '/api/stats')).body.bySubject.SOFTWARE_ENGINEERING, 0);
});

test('unregistered subjects are rejected without creating records or invoking generation', async () => {
  const unknown = 'NOT_REGISTERED';
  const question = { ...q(1, 'Trees', 'Traversal', 'EASY', 5, 'Explain tree traversal.'), subject: unknown };
  assert.equal((await call('POST', '/api/questions', question)).status, 400);
  assert.equal((await call('PUT', '/api/questions/101', question)).status, 400);
  assert.equal((await call('GET', '/api/questions?subject=' + unknown)).status, 400);
  assert.equal((await call('POST', '/api/papers/generate', { subject: unknown, totalMarks: 10 })).status, 400);
  assert.equal((await call('POST', '/api/generate/questions', { subject: unknown, topic: 'Trees', marks: 5, difficulty: 'EASY' })).status, 400);
  assert.equal((await call('POST', '/api/papers/from-syllabus', { subject: unknown, fileName: 's.txt', mimeType: 'text/plain', data: Buffer.from('Trees').toString('base64'), totalMarks: 10, count: 2, split: { easy: 40, medium: 40, hard: 20 } })).status, 400);
  assert.equal((await call('GET', '/api/stats')).body.bySubject[unknown], undefined);
  const missing = { ...question }; delete missing.subject;
  assert.equal((await call('POST', '/api/questions', missing)).status, 400);
  await assert.rejects(query("INSERT INTO questions(subject,unit,topic,subtopic,difficulty,marks) VALUES($1,1,'T','S','EASY',5)", [unknown]), e => e.code === '23503');
});
