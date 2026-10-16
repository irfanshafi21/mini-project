import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateSyllabusPaper, planPaper, syllabusBody } from '../src/syllabusGenerator.js';
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
  for (const change of [{ mimeType: 'application/exe' }, { totalMarks: 2 }, { count: 51 }, { split: { easy: 50, medium: 50, hard: 50 } }, { data: 'bad!' }]) {
    assert.equal(syllabusBody.safeParse({ ...body, ...change }).success, false);
  }
});

test('invalid PDFs fail locally and generation never uses fetch',async()=>{
 await assert.rejects(generateSyllabusPaper({...body,mimeType:'application/pdf'}),e=>e.status===400);
 const old=globalThis.fetch;globalThis.fetch=()=>assert.fail('Local generation must not call the network');
 try{const result=await generateSyllabusPaper({...body,totalMarks:4,count:2,markCounts:{2:2},bloomCounts:{2:{K1:1,K2:1}}});
 assert.deepEqual(result.paper.questions.map(q=>q.bloomLevel),['K1','K2']);assert.equal(result.paper.totalMarks,4);
 }finally{globalThis.fetch=old;}
});
