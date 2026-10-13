import assert from 'node:assert/strict';
import {test} from 'node:test';
import {generateSyllabusPaper} from '../src/syllabusGenerator.js';
const body={subject:'COMPUTER ORGANISATION',fileName:'s.txt',mimeType:'text/plain',data:Buffer.from('Unit 1 CPU registers and instruction cycles. Unit 2 Memory hierarchy.').toString('base64'),totalMarks:2,count:1,markCounts:{2:1,5:0,10:0,16:0},split:{easy:100,medium:0,hard:0}};
const question={topic:'CPU',subtopic:'Registers',text:'Define the program counter register.',syllabusReference:'Unit 1 CPU registers'};
const options=fetchImpl=>({provider:'groq',apiKey:'test',model:'openai/gpt-oss-20b',fetchImpl});
test('Groq request uses extracted source, strict JSON schema and Java slots',async()=>{
const r=await generateSyllabusPaper(body,options(async(url,req)=>{assert.equal(url,'https://api.groq.com/openai/v1/chat/completions');assert.equal(req.headers.Authorization,'Bearer test');const data=JSON.parse(req.body);assert.match(data.messages[1].content,/Memory hierarchy/);assert.equal(data.response_format.json_schema.strict,true);return {ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify({questions:[question]})}}]})};}));assert.equal(r.paper.questions[0].marks,2);assert.equal(r.paper.totalMarks,2);
});
test('Groq rejects wrong counts, truncated output, missing text and upstream failures',async()=>{
for(const choice of [{finish_reason:'length'},{finish_reason:'stop',message:{content:'{"questions":[]}'}}])await assert.rejects(generateSyllabusPaper(body,options(async()=>({ok:true,json:async()=>({choices:[choice]})}))),e=>e.status===502);
await assert.rejects(generateSyllabusPaper({...body,data:Buffer.from('short').toString('base64')},options(()=>assert.fail())),e=>e.status===400);
for(const status of [401,429,503])await assert.rejects(generateSyllabusPaper(body,options(async()=>({ok:false,status}))),e=>e.status===(status===401?502:status));
});
