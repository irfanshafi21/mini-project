// Run with: npm test   (uses its own database "questionbank_test", so your real data is never touched)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
process.env.MODEL_RUNTIME_DIR=fs.mkdtempSync(path.join(os.tmpdir(),'paper-model-test-'));
import { after, before, test } from 'node:test';

process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/questionbank_test';

const { app } = await import('../src/app.js');
const { pool, query } = await import('../src/db.js');

let server;
let base;

before(async () => {
  await query(fs.readFileSync(new URL('../sql/schema.sql', import.meta.url), 'utf8'));
  await query('TRUNCATE automatic_learning_jobs, reviewed_examples, model_training_runs, questions, syllabus_history, saved_papers RESTART IDENTITY');
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
  assert.equal(r.body.aiProvider, (process.env.AI_PROVIDER || 'ollama').toLowerCase());
  assert.equal(r.body.model, r.body.aiProvider === 'groq' ? process.env.GROQ_MODEL || null : r.body.aiProvider === 'ollama' ? process.env.OLLAMA_MODEL || 'qwen3.5:9b' : 'college-local-classifier-grammar-v2');
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

test('subject overview excludes deleted questions and tracks only successful complete papers', async () => {
  const subject = 'OVERVIEW_TEST';
  await call('POST', '/api/subjects', { name: subject });
  const ids = [];
  for (const marks of [2,5,10,16,3]) {
    const added = await call('POST', '/api/questions', { ...q(1, 'CPU', 'Registers', 'EASY', marks, `Explain the ${marks} mark CPU topic.`), subject });
    assert.equal(added.status, 201); ids.push(added.body.id);
  }
  await call('DELETE', `/api/questions/${ids[4]}`);
  let overview = (await call('GET', `/api/subjects/${subject}/overview`)).body;
  assert.equal(overview.totalQuestions, 4);
  assert.deepEqual(overview.byMarks, {1:0,2:1,5:1,10:1,16:1});
  assert.equal(overview.otherMarks, 0);
  assert.equal(overview.generatedQuestions, 0);
  const pattern = {subject,totalMarks:2,count:1,markCounts:{2:1,5:0,10:0,16:0},split:{easy:100,medium:0,hard:0}};
  assert.equal((await call('POST','/api/papers/generate',pattern)).status,200);
  assert.equal((await call('POST','/api/papers/generate',{...pattern,totalMarks:32,count:2,markCounts:{2:0,5:0,10:0,16:2}})).status,400);
  const originalFetch = globalThis.fetch, originalProvider = process.env.AI_PROVIDER, originalKey = process.env.GROQ_API_KEY;
  process.env.AI_PROVIDER = 'templates'; process.env.GROQ_API_KEY = 'test';
  try {
    const upload = {...pattern,unit:2,fileName:'s.txt',mimeType:'text/plain',data:Buffer.from('Unit 2: CPU registers and instruction processing.').toString('base64')};
    const generated = await call('POST','/api/papers/from-syllabus',upload);
    assert.equal(generated.status,200);
    // Generating a paper never implicitly inserts bank questions.
    assert.equal((await call('GET',`/api/questions?subject=${subject}&unit=2`)).body.total,0);
    const save = {subject, unit:2, questions:generated.body.paper.questions};
    assert.equal((await call('POST','/api/papers/save-syllabus',{...save,subject:'UNKNOWN'})).status,400);
    assert.equal((await call('POST','/api/papers/save-syllabus',{...save,unit:8})).status,400);
    const added = await call('POST','/api/papers/save-syllabus',save);
    assert.equal(added.status,200); assert.equal(added.body.savedToBank,1);
    const repeat = await call('POST','/api/papers/save-syllabus',save);
    assert.equal(repeat.status,200); assert.equal(repeat.body.savedToBank,0); assert.equal(repeat.body.alreadyInBank,1);
    const stored = await call('GET',`/api/questions?subject=${subject}&unit=2`);
    assert.equal(stored.body.total,1); assert.equal(stored.body.items[0].text,generated.body.paper.questions[0].text);
  } finally {
    globalThis.fetch = originalFetch;
    if(originalProvider === undefined) delete process.env.AI_PROVIDER; else process.env.AI_PROVIDER = originalProvider;
    if(originalKey === undefined) delete process.env.GROQ_API_KEY; else process.env.GROQ_API_KEY = originalKey;
  }
  overview = (await call('GET', `/api/subjects/${subject}/overview`)).body;
  assert.equal(overview.generatedQuestions, 2);
  assert.equal(overview.generatedPapers, 2);
  assert.equal(overview.bankQuestions, 1);
  assert.equal(overview.syllabusQuestions, 1);
  assert.equal(overview.totalQuestions, 5);
  assert.equal((await call('GET','/api/subjects/UNKNOWN_SUBJECT/overview')).status,404);
  await call('DELETE', `/api/questions/${ids[0]}`);
  assert.equal((await call('GET', `/api/subjects/${subject}/overview`)).body.byMarks[2],1);
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
  await assert.rejects(query("INSERT INTO questions(subject,unit,topic,subtopic,difficulty,marks) VALUES($1,1,'T','S','EASY',5)", [unknown]), e => ['23503','23514'].includes(e.code));
});

test('bank paper selects two or three units and never selects an excluded unit', async () => {
  const subject='MULTI_UNIT';await call('POST','/api/subjects',{name:subject});
  for(const [unit,marks] of [[1,2],[3,5],[5,10],[2,16]]) await call('POST','/api/questions',{...q(unit,'CPU','Registers','EASY',marks,`Unit ${unit} CPU question.`),subject});
  const pattern={subject,totalMarks:7,count:2,units:[1,3],markCounts:{2:1,5:1,10:0,16:0},split:{easy:100,medium:0,hard:0}};
  const two=await call('POST','/api/papers/generate',pattern);
  assert.equal(two.status,200);assert.deepEqual(two.body.paper.questions.map(q=>q.unit).sort(),[1,3]);
  const three=await call('POST','/api/papers/generate',{...pattern,totalMarks:17,count:3,units:[1,3,5],markCounts:{2:1,5:1,10:1,16:0}});
  assert.equal(three.status,200);assert.deepEqual(three.body.paper.questions.map(q=>q.unit).sort(),[1,3,5]);
  assert.equal((await call('POST','/api/papers/generate',{...pattern,units:[0]})).status,400);
});

test('local syllabus repeats do not reuse text, and saving follows detected units without a unit selector', async () => {
  const original=process.env.AI_PROVIDER;process.env.AI_PROVIDER='templates';
  const subject='LOCAL_REPEAT';await call('POST','/api/subjects',{name:subject});
  const body={subject,fileName:'local.txt',mimeType:'text/plain',data:Buffer.from('Unit 1: CPU registers\nUnit 3: Cache memory hierarchy').toString('base64'),totalMarks:4,count:2,markCounts:{2:2,5:0,10:0,16:0},split:{easy:100,medium:0,hard:0}};
  try {
    const first=await call('POST','/api/papers/from-syllabus',body);
    const second=await call('POST','/api/papers/from-syllabus',body);
    assert.equal(first.status,200);assert.equal(second.status,200);
    assert.ok(second.body.paper.questions.every(q=>!first.body.paper.questions.some(p=>p.text===q.text)));
    assert.equal((await call('GET',`/api/questions?subject=${subject}`)).body.total,0);
    const saved=await call('POST','/api/papers/save-syllabus',{subject,questions:first.body.paper.questions});
    assert.equal(saved.status,200);assert.equal(saved.body.savedToBank,2);
    const stored=(await call('GET',`/api/questions?subject=${subject}`)).body.items;
    assert.deepEqual(stored.map(q=>q.unit).sort(),[1,3]);
  } finally {if(original===undefined)delete process.env.AI_PROVIDER;else process.env.AI_PROVIDER=original;}
});


test('manual selection saves exact subject questions and retrieves immutable paper snapshots', async () => {
  const name='MANUAL_TEST';
  await call('POST','/api/subjects',{name});
  const a=(await call('POST','/api/questions',{...q(1,'CPU','Registers','EASY',2,'Name two registers.'),subject:name})).body;
  const b=(await call('POST','/api/questions',{...q(3,'Memory','Cache','MEDIUM',5,'Explain cache mapping.'),subject:name})).body;
  const c=(await call('POST','/api/questions',q(2,'CPU','Other','EASY',2,'Other subject question.'))).body;
  const created=await call('POST','/api/papers/manual',{subject:name,title:'Unit test paper',questionIds:[b.id,a.id]});
  assert.equal(created.status,201);
  assert.equal(created.body.paper.totalMarks,7);
  assert.deepEqual(created.body.paper.questions.map(q=>q.id),[b.id,a.id]);
  for(const ids of [[a.id,a.id],[a.id,c.id],[999999],[]]) assert.equal((await call('POST','/api/papers/manual',{subject:name,title:'Invalid',questionIds:ids})).status,400);
  await call('PUT',`/api/questions/${a.id}`,{...a,text:'Changed bank text.'});
  await call('DELETE',`/api/questions/${b.id}`);
  assert.equal((await call('POST','/api/papers/manual',{subject:name,title:'Deleted',questionIds:[b.id]})).status,400);
  const loaded=await call('GET',`/api/papers/saved/${created.body.id}`);
  assert.equal(loaded.body.paper.questions[1].text,'Name two registers.');
  assert.equal((await call('GET',`/api/papers/saved?subject=${name}`)).body.items.length,1);
  assert.ok((await call('GET','/api/papers/saved?subject=GENERAL')).body.items.every(p=>p.subject==='GENERAL'));
  assert.equal((await call('GET','/api/papers/saved/999999')).status,404);
  const snapshot=await call('POST','/api/papers/saved',{subject:name,title:'Syllabus preview',questions:created.body.paper.questions});
  assert.equal(snapshot.status,201);
  assert.equal(snapshot.body.paper.totalMarks,7);
});


test('each subject receives its own physical table and schema migration is repeatable', async () => {
  await call('POST','/api/subjects',{name:'Partition check'});
  const r=await call('POST','/api/questions',{...q(1,'CPU','Control','EASY',2,'What is a control unit?'),subject:'PARTITION_CHECK'});
  assert.equal(r.status,201);
  const table=(await query('SELECT table_name FROM subject_storage WHERE subject=$1',['PARTITION_CHECK'])).rows[0].table_name;
  const physical=await query('SELECT tableoid::regclass::text AS storage FROM questions WHERE id=$1',[r.body.id]);
  assert.equal(physical.rows[0].storage,table);
  const count=(await query('SELECT count(*)::int AS n FROM questions')).rows[0].n;
  await query(fs.readFileSync(new URL('../sql/schema.sql', import.meta.url),'utf8'));
  assert.equal((await query('SELECT count(*)::int AS n FROM questions')).rows[0].n,count);
  assert.equal((await call('GET',`/api/questions/${r.body.id}`)).body.text,'What is a control unit?');
});


test('stored papers list all subjects, search titles, and exclude removed papers', async () => {
  const all=await call('GET','/api/papers/saved');
  assert.equal(all.status,200);
  assert.ok(all.body.total>=3);
  assert.ok(all.body.items.some(p=>p.source==='bank'));
  assert.ok(all.body.items.some(p=>p.source==='syllabus'));
  const found=await call('GET','/api/papers/saved?q=Unit%20test%20paper');
  assert.equal(found.body.items.length,1);
  const id=found.body.items[0].id;
  await query('UPDATE saved_papers SET is_deleted=TRUE WHERE id=$1',[id]);
  assert.equal((await call('GET',`/api/papers/saved/${id}`)).status,404);
  assert.equal((await call('GET','/api/papers/saved?q=Unit%20test%20paper')).body.total,0);
  const archived=all.body.items.find(p=>p.source==='syllabus');
  const saved=await call('GET',`/api/papers/saved/${archived.id}`);
  assert.equal(saved.status,200);
  assert.equal(saved.body.paper.questions.length,archived.count);
  assert.equal((await call('GET','/api/papers/saved?page=0')).status,400);
});


test('editing a stored paper updates its snapshot and totals without changing bank entries', async () => {
  const existing=await call('GET','/api/papers/saved?subject=MANUAL_TEST');
  const id=existing.body.items[0].id;
  const original=(await call('GET',`/api/papers/saved/${id}`)).body;
  const bankBefore=(await query('SELECT id,text,marks FROM questions ORDER BY id')).rows;
  const questions=original.paper.questions.map((q,i)=>({...q,text:i===0?'Define cache memory.':q.text,marks:i===0?2:q.marks}));
  questions[0].bloomSource='Generated locally with legacy explanatory provenance '.repeat(8);
  questions[0].reuseKey='legacy '.repeat(80);
  questions[0].syllabusReference='legacy syllabus notes '.repeat(80);
  const updated=await call('PUT',`/api/papers/saved/${id}`,{subject:'MANUAL_TEST',title:'Reviewed question paper',questions});
  assert.equal(updated.status,200);
  assert.equal(updated.body.paper.title,'Reviewed question paper');
  assert.equal(updated.body.paper.totalMarks,questions.reduce((n,q)=>n+q.marks,0));
  assert.equal((await call('GET',`/api/papers/saved/${id}`)).body.paper.questions[0].text,'Define cache memory.');
  assert.deepEqual((await query('SELECT id,text,marks FROM questions ORDER BY id')).rows,bankBefore);
  assert.equal((await call('PUT',`/api/papers/saved/${id}`,{subject:'GENERAL',title:'Wrong subject',questions})).status,400);
  assert.equal((await call('PUT',`/api/papers/saved/${id}`,{subject:'MANUAL_TEST',title:'Invalid marks',questions:[{...questions[0],marks:0}]})).status,400);
  assert.equal((await call('PUT','/api/papers/saved/999999',{subject:'MANUAL_TEST',title:'Missing',questions})).status,404);
});


test('only Add subject creates names; blank and mixed papers remain unassigned', async () => {
  const previous=process.env.AI_PROVIDER;process.env.AI_PROVIDER='templates';
  try {
    const before=(await query('SELECT name FROM subjects ORDER BY name')).rows;
    const body={fileName:'topics.txt',mimeType:'text/plain',data:Buffer.from('Unit 1: Memory\nCache memory. CPU registers.').toString('base64'),totalMarks:2,count:1,split:{easy:100,medium:0,hard:0}};
    const blank=await call('POST','/api/papers/from-syllabus',body);
    assert.equal(blank.status,200);assert.equal(blank.body.paper.subject,'UNASSIGNED');
    const again=await call('POST','/api/papers/from-syllabus',body);
    assert.equal(again.status,200);
    assert.notEqual(again.body.paper.questions[0].text,blank.body.paper.questions[0].text);
    assert.equal((await call('POST','/api/papers/from-syllabus',{...body,subject:'Do not create this subject'})).status,400);
    assert.deepEqual((await query('SELECT name FROM subjects ORDER BY name')).rows,before);
    assert.equal((await call('POST','/api/papers/save-syllabus',{subject:'Do not create this subject',questions:blank.body.paper.questions})).status,400);
    const edited=await call('PUT',`/api/papers/saved/${blank.body.id}`,{title:'Unassigned edited paper',questions:blank.body.paper.questions});
    assert.equal(edited.status,200);assert.equal(edited.body.paper.subject,'UNASSIGNED');
    await call('POST','/api/subjects',{name:'Created using Add subject'});
    assert.equal((await call('POST','/api/papers/from-syllabus',{...body,subject:'Created using Add subject'})).status,200);
    const q1=(await call('POST','/api/questions',q(1,'CPU','Registers','EASY',2,'Subject separation test.'))).body;
    const q2=(await call('POST','/api/questions',{...q(1,'CPU','Registers','EASY',2,'Second subject test.'),subject:'CREATED_USING_ADD_SUBJECT'})).body;
    const mixed=await call('POST','/api/papers/manual',{title:'Mixed paper',questionIds:[q1.id,q2.id]});
    assert.equal(mixed.status,201);assert.equal(mixed.body.paper.subject,'UNASSIGNED');
    assert.equal((await query('SELECT subject FROM saved_papers WHERE id=$1',[mixed.body.id])).rows[0].subject,null);
    assert.equal((await call('POST','/api/papers/generate',{totalMarks:2,split:{easy:100,medium:0,hard:0}})).status,200);
    const after=(await query('SELECT name FROM subjects ORDER BY name')).rows;
    assert.equal(after.length,before.length+1);
  } finally {if(previous===undefined)delete process.env.AI_PROVIDER;else process.env.AI_PROVIDER=previous;}
});

test('one-mark MCQs and blanks survive generation, bank storage, selection and paper editing', async () => {
  const previous=process.env.AI_PROVIDER;process.env.AI_PROVIDER='templates';
  try {
    await call('POST','/api/subjects',{name:'OBJECTIVE_TEST'});
    const body={subject:'OBJECTIVE_TEST',fileName:'topics.txt',mimeType:'text/plain',data:Buffer.from('Unit 1: Data structures\nStacks. Queues. Binary search. Linear search.').toString('base64'),totalMarks:3,count:3,markCounts:{1:3,2:0,5:0,10:0,16:0},split:{easy:100,medium:0,hard:0},oneMarkType:'MCQ'};
    const mcq=await call('POST','/api/papers/from-syllabus',body);
    assert.equal(mcq.status,200);
    for(const item of mcq.body.paper.questions) {
      assert.equal(item.marks,1);assert.equal(item.questionType,'MCQ');
      assert.equal(item.options.length,4);assert.equal(new Set(item.options).size,4);
      assert.equal(item.options.filter(o=>o===item.answer).length,1);
    }
    const saved=await call('POST','/api/papers/save-syllabus',{subject:body.subject,questions:mcq.body.paper.questions});
    assert.equal(saved.status,200);assert.equal(saved.body.savedToBank,3);
    const bank=await call('POST','/api/papers/generate',{subject:body.subject,totalMarks:1,count:1,markCounts:{1:1,2:0,5:0,10:0,16:0},oneMarkType:'MCQ',split:{easy:100,medium:0,hard:0}});
    assert.equal(bank.status,200);assert.equal(bank.body.paper.questions[0].questionType,'MCQ');
    const loaded=await call('GET',`/api/papers/saved/${bank.body.id}`);
    assert.deepEqual(loaded.body.paper.questions[0].options,bank.body.paper.questions[0].options);
    const changed={...loaded.body.paper.questions[0],options:['One','Two','Three','Four'],answer:'Two'};
    assert.equal((await call('PUT',`/api/papers/saved/${bank.body.id}`,{subject:body.subject,title:'Edited MCQ',questions:[changed]})).status,200);
    assert.equal((await call('POST','/api/papers/from-syllabus',{...body,oneMarkType:'FILL_BLANK'})).status,409);
    await call('POST','/api/subjects',{name:'BLANK_TEST'});
    const blanks=await call('POST','/api/papers/from-syllabus',{...body,subject:'BLANK_TEST',oneMarkType:'FILL_BLANK'});
    assert.equal(blanks.status,200);
    assert.ok(blanks.body.paper.questions.every(q=>q.questionType==='FILL_BLANK' && q.text.includes('____') && q.answer && !q.options.length));
    const invalid={...mcq.body.paper.questions[0],subject:body.subject};
    for(const options of [['Same','Same','Two','Three'],['One','Two','Three']])assert.equal((await call('POST','/api/questions',{...invalid,options})).status,400);
    assert.equal((await call('POST','/api/questions',{...invalid,answer:'Not an option'})).status,400);
  } finally {if(previous===undefined)delete process.env.AI_PROVIDER;else process.env.AI_PROVIDER=previous;}
});

test('review approval checks saved snapshots and retraining uses the frozen classification holdout',async()=>{
 const list=await call('GET','/api/papers/saved');
 const id=list.body.items[0].id;
 const loaded=await call('GET',`/api/papers/saved/${id}`),q=loaded.body.paper.questions[0];
 const review={index:0,label:'concept',text:q.text,marks:q.marks,options:q.options || [],answer:q.answer || ''};
 assert.equal((await call('POST','/api/model/reviews',{paperId:id,reviews:[{...review,text:'stale text'}]})).status,409);
 assert.equal((await call('POST','/api/model/reviews',{paperId:id,reviews:[review]})).status,201);
 assert.equal((await call('POST','/api/model/reviews',{paperId:id,reviews:[review]})).status,201);
 const status=await call('GET','/api/model/status');assert.equal(status.body.approvedExamples,1);
 const trained=await call('POST','/api/model/train',{});assert.equal(trained.status,200);
 assert.equal(trained.body.report.testExamples,16);assert.equal(trained.body.report.topicOverlap,0);
 assert.ok(!trained.body.report.promoted || trained.body.report.accuracy>=trained.body.report.previousAccuracy);
});

test('automatic learning consumes a queued paper without manual labels and records training outcome',async()=>{
 const {storePaper}=await import('../src/routes/savedPapers.js');
 const {processAutomaticLearning}=await import('../src/automaticLearning.js');
 await query('DELETE FROM automatic_learning_jobs');
 const paper=await storePaper('GENERAL','Automatic learning test',[
 {topic:'CPU registers',subtopic:'concept',text:'Define the program counter.',marks:2,unit:1,difficulty:'EASY'},
 {topic:'CPU registers',subtopic:'concept',text:'Describe everything about all processors.',marks:2,unit:1,difficulty:'EASY'}]);
 const oldKey=process.env.GROQ_API_KEY,oldProvider=process.env.AUTO_LEARNING_PROVIDER,oldModel=process.env.GROQ_MODEL;
 process.env.GROQ_API_KEY='test-key';process.env.AUTO_LEARNING_PROVIDER='groq';process.env.GROQ_MODEL='test-model';
 try{
 let trained=false;
 await processAutomaticLearning({review:async()=>[
 {index:0,topic:'Processor registers',label:'concept',bloomLevel:'K1',approved:true,confidence:1,reason:'Local checks pass'},
 {index:1,topic:'Processor registers',label:'concept',bloomLevel:'K1',approved:false,confidence:0,reason:'Too broad'}],train:async()=>{trained=true;return {status:'kept_previous',report:{accuracy:.7}}}});
 assert.ok(trained);
 const job=await call('GET',`/api/model/papers/${paper.id}`);assert.equal(job.body.job.status,'completed');assert.equal(job.body.job.report.accepted,1);assert.equal(job.body.job.report.rejected,1);
 const rows=(await query('SELECT topic,label,review_source FROM reviewed_examples WHERE paper_id=$1',[paper.id])).rows;
 assert.deepEqual(rows,[{topic:'Processor registers',label:'concept',review_source:'local'}]);
 await processAutomaticLearning({fetchImpl:async()=>{throw new Error('Completed jobs must not run again');}});
 }finally{for(const [key,value] of [['GROQ_API_KEY',oldKey],['AUTO_LEARNING_PROVIDER',oldProvider],['GROQ_MODEL',oldModel]]){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});

test('Bloom levels survive syllabus generation, bank storage, selection and retrieval',async()=>{
 const oldFetch=globalThis.fetch,oldProvider=process.env.AI_PROVIDER,oldKey=process.env.GROQ_API_KEY,oldModel=process.env.GROQ_MODEL,oldTeacher=process.env.AUTO_LEARNING_PROVIDER;
 process.env.AI_PROVIDER='templates';process.env.GROQ_API_KEY='test-key';process.env.GROQ_MODEL='test-model';process.env.AUTO_LEARNING_PROVIDER='groq';
 const texts=['Define cache memory.','Explain how cache memory reduces average access latency.','Solve the cache access time for hit time 2 ns, miss rate 0.1 and additional penalty 50 ns.','Analyze how cache locality and miss rate are related.','Evaluate two cache replacement policies against latency and complexity criteria; justify your choice.','Design a new cache replacement policy for a workload with alternating scans and repeated accesses.'];

 try{
 await call('POST','/api/subjects',{name:'BLOOM_TEST'});
 const b={subject:'BLOOM_TEST',fileName:'bloom.txt',mimeType:'text/plain',data:Buffer.from('Unit 1: Cache memory\nCache organization, locality, hit rate, miss penalty and replacement policies.').toString('base64'),totalMarks:12,count:6,markCounts:{2:6},bloomCounts:{2:{K1:1,K2:1,K3:1,K4:1,K5:1,K6:1}},split:{easy:100,medium:0,hard:0}};
 assert.equal((await call('POST','/api/papers/from-syllabus',{...b,bloomCounts:{2:{K1:7}}})).status,400);
 const generated=await call('POST','/api/papers/from-syllabus',b);assert.equal(generated.status,200,JSON.stringify(generated.body));
 assert.deepEqual(generated.body.paper.questions.map(q=>q.bloomLevel),['K1','K2','K3','K4','K5','K6']);
 assert.equal((await call('POST','/api/papers/save-syllabus',{subject:'BLOOM_TEST',questions:generated.body.paper.questions})).body.savedToBank,6);
 const found=await call('GET','/api/questions?subject=BLOOM_TEST&bloomLevel=K4');assert.equal(found.body.total,1);assert.equal(found.body.items[0].bloomLevel,'K4');
 const selected=await call('POST','/api/papers/generate',{subject:'BLOOM_TEST',totalMarks:12,count:6,markCounts:{2:6},bloomCounts:b.bloomCounts,split:b.split});assert.equal(selected.status,200);
 const restored=await call('GET',`/api/papers/saved/${selected.body.id}`);assert.deepEqual(restored.body.paper.questions.map(q=>q.bloomLevel),['K1','K2','K3','K4','K5','K6']);
 assert.equal((await call('POST','/api/papers/generate',{subject:'BLOOM_TEST',totalMarks:4,count:2,markCounts:{2:2},bloomCounts:{2:{K6:2}},split:b.split})).status,409);
 }finally{globalThis.fetch=oldFetch;for(const [k,v] of [['AI_PROVIDER',oldProvider],['GROQ_API_KEY',oldKey],['GROQ_MODEL',oldModel],['AUTO_LEARNING_PROVIDER',oldTeacher]]){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
});
