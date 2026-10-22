import assert from 'node:assert/strict';
import { test } from 'node:test';
import { planPaper, generatePaper } from '../src/javaCore.js';
import { paperBody } from '../src/validation.js';
import { syllabusBody, generateSyllabusPaper } from '../src/syllabusGenerator.js';
const split = { easy: 40, medium: 40, hard: 20 };
const auto = { 2: 0, 5: 0, 10: 0, 16: 0 };
test('Java plans exact manual marks and automatic standard denominations', async () => {
  const custom = await planPaper(50, 0, split, { 2: 2, 5: 2, 10: 2, 16: 1 });
  assert.deepEqual(custom.map(q => q.marks), [2,2,5,5,10,10,16]);
  for (const [total,count] of [[50,0],[50,10],[37,0]]) {
    const slots = await planPaper(total,count,split,auto);
    assert.equal(slots.reduce((n,q)=>n+q.marks,0),total);
    assert.ok(slots.every(q=>[1,2,5,10,16].includes(q.marks)));
    if (count) assert.equal(slots.length,count);
  }
  assert.equal((await planPaper(1,0,split,auto))[0].marks,1);
  await assert.rejects(planPaper(50,1,split,auto), e=>e.status===400);
});
test('bank patterns honor counts and bounded automatic selection never reuses ids', async () => {
  const pool = [2,2,5,5,10,10,16,3].map((marks,i)=>({id:i+1,marks,difficulty:['EASY','MEDIUM','HARD'][i%3]}));
  const manual = await generatePaper(pool,50,split,{2:2,5:2,10:2,16:1});
  assert.equal(manual.totalMarks,50);
  assert.equal(manual.questions.length,7);
  const result = await generatePaper(pool,20,split,auto,2);
  assert.deepEqual(result.questions.map(q=>q.marks),[10,10]);
  assert.equal(new Set(result.questions.map(q=>q.id)).size,2);
  await assert.rejects(generatePaper(pool,32,split,{2:0,5:0,10:0,16:2}),e=>e.status===400);
});
test('schemas reject inconsistent negative fractional and oversized custom counts',()=>{
  const base = {subject:'GENERAL',totalMarks:50,count:0,markCounts:auto};
  assert.ok(paperBody.safeParse(base).success);
  for(const markCounts of [{...auto,2:-1},{...auto,5:1.5},{...auto,2:51},{...auto,5:9}]) assert.equal(paperBody.safeParse({...base,markCounts}).success,false);
  assert.equal(paperBody.safeParse({...base,count:8,markCounts:{2:0,5:10,10:0,16:0}}).success,false);
});
test('syllabus output matches Java automatic slot count in template mode',async()=>{
 const body=syllabusBody.parse({subject:'GENERAL',fileName:'s.txt',mimeType:'text/plain',data:Buffer.from('Unit 1: CPU registers and memory hierarchy').toString('base64'),totalMarks:10,count:0,markCounts:auto,split});
 const previousProvider=process.env.AI_PROVIDER;process.env.AI_PROVIDER='local';
 try { const result=await generateSyllabusPaper(body,{provider:'templates'});assert.equal(result.paper.totalMarks,10);assert.equal(result.paper.questions.length,1); }
 finally { if(previousProvider===undefined)delete process.env.AI_PROVIDER;else process.env.AI_PROVIDER=previousProvider; }
});

test('Java plans mixed one-mark patterns exactly',async()=>{
  const slots=await planPaper(10,0,split,{1:3,2:1,5:1,10:0,16:0});
  assert.deepEqual(slots.map(q=>q.marks),[1,1,1,2,5]);
});
