import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateSyllabusPaper, planPaper, syllabusBody } from '../src/syllabusGenerator.js';
import { extractSyllabusText, transcribeSyllabusVisual } from '../src/localModel.js';
// Keep these broad syllabus tests deterministic and offline. Provider
// behavior is covered by groqQuestionGenerator.test.js with mocked requests.
process.env.AI_PROVIDER = 'local';
const body={fileName:'s.txt',mimeType:'text/plain',data:Buffer.from('Unit 1: Arrays, stacks and queues.').toString('base64'),totalMarks:25,count:5,split:{easy:40,medium:40,hard:20}};
test('Java plans exact marks and rounded counts, including small papers', async () => {
  for (const count of [1, 2, 5, 17, 50]) {
    const plan = await planPaper(count * 3 + 1, count, body.split);
    assert.equal(plan.length, count);
    assert.equal(plan.reduce((sum, q) => sum + q.marks, 0), count * 3 + 1);
  }
  assert.deepEqual((await planPaper(25, 5, body.split)).map(q => q.difficulty), ['EASY', 'EASY', 'MEDIUM', 'MEDIUM', 'HARD']);
});
test('validates upload metadata, marks and split', () => {
  assert.equal(syllabusBody.parse(body).questionStyle, 'MIXED');
  for (const questionStyle of ['THEORY', 'PROBLEM_SOLVING', 'MIXED']) {
    assert.equal(syllabusBody.safeParse({ ...body, questionStyle }).success, true);
  }
  for (const change of [{ mimeType: 'application/exe' }, { totalMarks: 2 }, { count: 51 }, { split: { easy: 50, medium: 50, hard: 50 } }, { data: 'bad!' }, {units:[]}, {units:[0]}, {questionStyle:'UNSUPPORTED'}]) {
    assert.equal(syllabusBody.safeParse({ ...body, ...change }).success, false);
  }
  for (const mimeType of ['image/jpeg', 'image/png', 'image/webp']) assert.equal(syllabusBody.safeParse({ ...body, mimeType }).success, true);
});

test('reads a syllabus photo through Gemini and validates its image bytes', async () => {
  const oldFetch=globalThis.fetch, oldKey=process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY='test-key';
  let request;
  globalThis.fetch=async(url,options)=>{request={url,body:JSON.parse(options.body)};return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:'Unit 1: Binary search trees, insertion and deletion operations.'}]}}]})}};
  try {
    const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),Buffer.from('photo-data')]);
    const text=await extractSyllabusText({mimeType:'image/png',data:png.toString('base64')});
    assert.match(text,/Binary search trees/);
    assert.equal(request.body.contents[0].parts[1].inlineData.mimeType,'image/png');
    await assert.rejects(extractSyllabusText({mimeType:'image/png',data:Buffer.from('not an image').toString('base64')}),e=>e.status===400);
  } finally {
    globalThis.fetch=oldFetch;
    if(oldKey===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=oldKey;
  }
});

test('Gemini can transcribe scanned PDF content as well as image uploads', async () => {
  const oldFetch=globalThis.fetch,oldKey=process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY='test-key';
  let mimeType;
  globalThis.fetch=async(_url,options)=>{mimeType=JSON.parse(options.body).contents[0].parts[1].inlineData.mimeType;return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:'Unit 1: Digital logic, Boolean algebra, logic gates and combinational circuits.'}]}}]})}};
  try {
    const text=await transcribeSyllabusVisual(Buffer.from('%PDF-scanned').toString('base64'),'application/pdf');
    assert.match(text,/Boolean algebra/);
    assert.equal(mimeType,'application/pdf');
  } finally {
    globalThis.fetch=oldFetch;
    if(oldKey===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=oldKey;
  }
});

test('reports actionable messages when syllabus extraction returns too little text', async () => {
  const oldFetch=globalThis.fetch,oldKey=process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY='unit-test-key';
  globalThis.fetch=async()=>({ok:true,json:async()=>({candidates:[{content:{parts:[{text:'Unit 1: AI'}]}}]})});
  try {
    const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),Buffer.from('photo-data')]);
    await assert.rejects(extractSyllabusText({mimeType:'image/png',data:png.toString('base64')}),/could not read enough syllabus text.*clear, well-lit image/i);
    await assert.rejects(extractSyllabusText({...body,data:Buffer.from('Unit 1: AI').toString('base64')}),/TXT file contains only 10 readable characters/i);
    await assert.rejects(extractSyllabusText({...body,mimeType:'application/pdf',data:Buffer.from('%PDF-1.7').toString('base64')}),/No readable syllabus text could be recovered from this PDF.*scanned-page reading/i);
  } finally {
    globalThis.fetch=oldFetch;
    if(oldKey===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=oldKey;
  }
});

test('syllabus generation is restricted to the selected units',async()=>{
 const syllabus='Unit 1: Binary search trees and AVL rotations.\nUnit 2: Bayes theorem and conditional probability.\nUnit 3: K-means clustering and centroid updates.';
 const input={...body,data:Buffer.from(syllabus).toString('base64'),units:[2],totalMarks:5,count:1,markCounts:{5:1}};
 const result=await generateSyllabusPaper(input);
 assert.ok(result.paper.questions.every(q=>q.unit===2));
 assert.ok(result.paper.questions.every(q=>/Bayes|probability/i.test(q.syllabusReference)));
 await assert.rejects(generateSyllabusPaper({...input,units:[5]}),/No syllabus chapters match/);
});

test('invalid PDFs fail locally and generation never uses fetch',async()=>{
 await assert.rejects(generateSyllabusPaper({...body,mimeType:'application/pdf'}),e=>e.status===400);
 const old=globalThis.fetch;globalThis.fetch=()=>assert.fail('Local generation must not call the network');
 try{const result=await generateSyllabusPaper({...body,totalMarks:4,count:2,markCounts:{2:2},bloomCounts:{2:{K1:1,K2:1}}});
 assert.deepEqual(result.paper.questions.map(q=>q.bloomLevel),['K1','K2']);assert.equal(result.paper.totalMarks,4);
 }finally{globalThis.fetch=old;}
});
