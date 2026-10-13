import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateSyllabusPaper, planPaper, syllabusBody } from '../src/syllabusGenerator.js';

const body = { subject: 'GENERAL', fileName: 'syllabus.txt', mimeType: 'text/plain', data: Buffer.from('Unit 1: Arrays, stacks and queues.').toString('base64'), totalMarks: 25, count: 5, split: { easy: 40, medium: 40, hard: 20 } };
const questions = Array.from({ length: 5 }, (_, i) => ({ topic: 'Data structures', subtopic: 'Arrays', text: `Explain array operation number ${i + 1}.`, syllabusReference: 'Unit 1: Arrays' }));
const options = (fetchImpl) => ({ provider: 'gemini', apiKey: 'test-key', model: 'test-model', fetchImpl });
test('Java plans exact marks and rounded counts, including small papers', async () => {
  for (const count of [1, 2, 5, 17, 50]) {
    const plan = await planPaper(count * 3 + 1, count, body.split);
    assert.equal(plan.length, count);
    assert.equal(plan.reduce((sum, q) => sum + q.marks, 0), count * 3 + 1);
  }
  assert.deepEqual((await planPaper(25, 5, body.split)).map(q => q.difficulty), ['EASY', 'EASY', 'MEDIUM', 'MEDIUM', 'HARD']);
});
test('validates upload metadata, marks and split', () => {
  for (const change of [{ mimeType: 'application/exe' }, { totalMarks: 2 }, { count: 51 }, { split: { easy: 50, medium: 50, hard: 50 } }, { data: 'bad!' }]) {
    assert.equal(syllabusBody.safeParse({ ...body, ...change }).success, false);
  }
});
test('sends syllabus to Gemini and maps validated questions to exact slots', async () => {
  const result = await generateSyllabusPaper(body, options(async (url, request) => {
    assert.match(url, /test-model:generateContent$/);
    assert.equal(request.headers['x-goog-api-key'], 'test-key');
    const sent = JSON.parse(request.body);
    assert.match(sent.contents[0].parts[0].text, /Arrays, stacks/);
    return { ok: true, json: async () => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ questions }) }] } }] }) };
  }));
  assert.equal(result.paper.totalMarks, 25);
  assert.equal(result.paper.questions.length, 5);
  assert.equal(result.paper.questions[0].marks, 5);
});
test('missing key and invalid PDFs fail before calling Gemini', async () => {
  await assert.rejects(generateSyllabusPaper(body, { apiKey: '' }), e => e.status === 503);
  await assert.rejects(generateSyllabusPaper({ ...body, mimeType: 'application/pdf' }, options(() => assert.fail('Must not call Gemini'))), e => e.status === 400);
});
test('Gemini quota and network failures produce useful errors', async () => {
  await assert.rejects(generateSyllabusPaper(body, options(async () => ({ ok: false, status: 429 }))), e => e.status === 429);
  await assert.rejects(generateSyllabusPaper(body, options(async () => { throw new Error('network'); })), e => e.status === 502);
  await assert.rejects(generateSyllabusPaper(body, options(async () => ({ ok: false, status: 503 }))), e => e.status === 503 && /high demand/.test(e.message));
});
test('rejects truncated, duplicate and wrong-count papers', async () => {
  for (const candidate of [
    { finishReason: 'MAX_TOKENS' },
    { finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ questions: questions.slice(1) }) }] } },
    { finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ questions: Array(5).fill(questions[0]) }) }] } },
  ]) {
    await assert.rejects(generateSyllabusPaper(body, options(async () => ({ ok: true, json: async () => ({ candidates: [candidate] }) }))), e => e.status === 502);
  }
});

test('HTTP upload route validates JSON and returns generation results without a database', async () => {
  const { app } = await import('../src/app.js');
  const { pool } = await import('../src/db.js');
  const originalQuery = pool.query;
  pool.query = async () => ({ rows: [{ name: 'GENERAL', saved: 5 }] });
  const originalFetch = globalThis.fetch;
  const originalProvider = process.env.AI_PROVIDER;
  process.env.AI_PROVIDER = 'gemini';
  const originalKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'test-key';
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ questions }) }] } }] }) });
  const server = app.listen(0);
  try {
    const url = `http://127.0.0.1:${server.address().port}/api/papers/from-syllabus`;
    const request = payload => originalFetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    assert.equal((await request({ ...body, count: 0 })).status, 400);
    const response = await request(body);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).paper.totalMarks, 25);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalProvider === undefined) delete process.env.AI_PROVIDER; else process.env.AI_PROVIDER = originalProvider;
    pool.query = originalQuery;
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
    await new Promise(resolve => server.close(resolve));
    await pool.end();
  }
});
