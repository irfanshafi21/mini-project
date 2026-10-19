import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BLOOM_LEVELS,classifyBloom,startsWithBloomVerb,assignBloomSlots,selectBloomBank } from '../src/blooms.js';
import { paperBody } from '../src/validation.js';
import { generateLocalQuestions as generateBloomQuestions } from '../src/localModel.js';

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
test('clear opening college verbs preserve the selected Bloom level',()=>{
 const examples={K1:'Define cache memory.',K2:'Summarize cache memory in your own words.',K3:'Apply cache memory to the supplied example.',K4:'Analyze the cache behaviour.',K5:'Evaluate the cache design against the criteria.',K6:'Create a cache design for the stated constraints.'};
 for(const [level,text] of Object.entries(examples))assert.equal(classifyBloom(text),level,text);
});
test('Bloom classifier recognizes clear task verbs after common prompt lead-ins',()=>{
 assert.equal(classifyBloom('Using the graph, Analyze the relationship between the two results.'),'K4');
 assert.equal(classifyBloom('Based on the example, Summarize how cache memory works.'),'K2');
 assert.equal(classifyBloom('Given the input values, Solve the problem using the stated method.'),'K3');
});
test('our own generator supports all K levels with approved opening words',async()=>{
 const slots=BLOOM_LEVELS.map(bloomLevel=>({marks:2,difficulty:'EASY',bloomLevel}));
 const questions=await generateBloomQuestions('Unit 1: Cache memory',slots,[],'MCQ');
 assert.deepEqual(questions.map(q=>q.bloomLevel),BLOOM_LEVELS);
 for(const q of questions){assert.ok(startsWithBloomVerb(q.text,q.bloomLevel));assert.ok(q.text.split(/\s+/).length<55);}
 assert.throws(()=>generateBloomQuestions('Unit 1: Cache memory',[{marks:1,difficulty:'EASY',bloomLevel:'K6'}],[],'MCQ'),e=>e.status===409);
});

test('bank matching keeps K level independent of difficulty',()=>{
 const pool=[{id:1,marks:2,bloomLevel:'K1',difficulty:'HARD',text:'Define a rare cache coherence state.'},{id:2,marks:2,bloomLevel:'K6',difficulty:'EASY',text:'Create a simple cache policy modification.'}];
 const result=selectBloomBank(pool,[{marks:2,difficulty:'EASY'},{marks:2,difficulty:'HARD'}],{2:{K1:1,K6:1}});
 assert.deepEqual(result.map(q=>q.id),[1,2]);assert.throws(()=>selectBloomBank(pool,[{marks:2,difficulty:'EASY'},{marks:2,difficulty:'EASY'}],{2:{K1:1,K6:1}}),e=>e.status===409);
});
