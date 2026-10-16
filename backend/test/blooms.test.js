import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BLOOM_LEVELS,classifyBloom,startsWithBloomVerb,assignBloomSlots,selectBloomBank } from '../src/blooms.js';
import { paperBody } from '../src/validation.js';
import { generateBloomQuestions } from '../src/bloomGenerator.js';

test('college K1-K6 verbs are enforced and allocation mismatches cannot be generated',()=>{
 assert.ok(startsWithBloomVerb('Define a cache.','K1'));
 assert.ok(startsWithBloomVerb('Make use of a stack to reverse the given input.','K3'));
 assert.ok(!startsWithBloomVerb('Define a cache.','K2'));
 assert.ok(startsWithBloomVerb('Compare methods against criteria and justify a choice.','K5'));
 const slots=Array(10).fill({marks:2,difficulty:'EASY'});
 assert.throws(()=>assignBloomSlots(slots,{2:{K1:2,K2:5,K3:4}}),e=>e.status===400);
 const result=assignBloomSlots(slots,{2:{K1:2,K2:5,K3:3}});
 assert.deepEqual(BLOOM_LEVELS.map(k=>result.filter(q=>q.bloomLevel===k).length),[2,5,3,0,0,0]);
 const b={totalMarks:20,count:10,markCounts:{2:10},bloomCounts:{2:{K1:2,K2:5,K3:4}}};
 assert.ok(!paperBody.safeParse(b).success);
 assert.ok(!paperBody.safeParse({...b,bloomCounts:{2:{K1:10,K7:2}}}).success);
});
test('Bloom classification uses task context for shared verbs',()=>{
 assert.equal(classifyBloom('Compare the features of cache memory to explain their differences.'),'K2');
 assert.equal(classifyBloom('Compare the internal structures of cache memory and explain their relationships.'),'K4');
 assert.equal(classifyBloom('Compare alternatives for cache memory and judge which best satisfies the constraints.'),'K5');
});
test('Bloom API rejects wrong opening verbs, levels and incomplete papers',async()=>{
 const previous={GROQ_API_KEY:process.env.GROQ_API_KEY,GROQ_MODEL:process.env.GROQ_MODEL,AUTO_LEARNING_PROVIDER:process.env.AUTO_LEARNING_PROVIDER};
 process.env.GROQ_API_KEY='test-key';process.env.GROQ_MODEL='test-model';process.env.AUTO_LEARNING_PROVIDER='groq';
 const q={topic:'Cache memory',subtopic:'concept',text:'Explain how a cache reduces memory access latency.',bloomLevel:'K2',questionType:'SHORT',options:[],answer:'It keeps recently used data closer to the CPU.',syllabusReference:'Cache memory'};
 const run=questions=>generateBloomQuestions('Unit 1: Cache memory',[{marks:2,difficulty:'EASY',bloomLevel:'K2'}],'MCQ',{reviewImpl:async paper=>paper.questions.map((q,index)=>({index,bloomLevel:q.bloomLevel,approved:true,confidence:.99})),fetchImpl:async()=>({ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify({questions})}}]})})});
 try{
 assert.equal((await run([q]))[0].bloomLevel,'K2');
 for(const items of [[],[{...q,text:'Define cache memory.'}],[{...q,bloomLevel:'K1'}]])await assert.rejects(run(items),e=>e.status===502);
 }finally{for(const [k,v] of Object.entries(previous)){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
});

test('a calculation disguised as K1 is rewritten before it can be returned',async()=>{
 const oldKey=process.env.GROQ_API_KEY,oldModel=process.env.GROQ_MODEL,oldProvider=process.env.AUTO_LEARNING_PROVIDER;
 process.env.GROQ_API_KEY='test-key';process.env.GROQ_MODEL='test-model';process.env.AUTO_LEARNING_PROVIDER='groq';
 let calls=0;
 try{
 const questions=await generateBloomQuestions('Cache memory and average access time',[{marks:2,difficulty:'EASY',bloomLevel:'K1'}],'MCQ',{
 fetchImpl:async()=>({ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify({questions:[{topic:'Cache memory',subtopic:'concept',bloomLevel:'K1',text:++calls===1?'Recall the average access time when hit time is 2 ns and miss penalty is 50 ns.':'Recall the formula for average memory access time.',syllabusReference:'Cache memory',questionType:'SHORT',options:[],answer:'Hit time plus miss rate times miss penalty'}]})}}]})}),
 reviewImpl:async()=>[{index:0,bloomLevel:'K1',approved:true,confidence:.99}]});
 assert.equal(calls,2);assert.match(questions[0].text,/formula/);
 }finally{for(const [k,v] of [['GROQ_API_KEY',oldKey],['GROQ_MODEL',oldModel],['AUTO_LEARNING_PROVIDER',oldProvider]]){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
});

test('bank matching keeps K level independent of difficulty',()=>{
 const pool=[{id:1,marks:2,bloomLevel:'K1',difficulty:'HARD',text:'Define a rare cache coherence state.'},{id:2,marks:2,bloomLevel:'K6',difficulty:'EASY',text:'Create a simple cache policy modification.'}];
 const result=selectBloomBank(pool,[{marks:2,difficulty:'EASY'},{marks:2,difficulty:'HARD'}],{2:{K1:1,K6:1}});
 assert.deepEqual(result.map(q=>q.id),[1,2]);assert.throws(()=>selectBloomBank(pool,[{marks:2,difficulty:'EASY'},{marks:2,difficulty:'EASY'}],{2:{K1:1,K6:1}}),e=>e.status===409);
});
