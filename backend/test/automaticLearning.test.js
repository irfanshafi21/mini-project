import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reviewWithTeacher } from '../src/automaticLearning.js';
const paper={subject:'CO',questions:[{topic:'CPU registers',text:'Define a program counter.',marks:2,unit:1,answer:''}]};
const configuration={provider:'groq',key:'test-only-key',model:'test-model'};
const review={index:0,topic:'CPU registers',label:'concept',approved:true,confidence:.95,reason:'Clear definition question'};
function reply(reviews,finish_reason='stop'){return {ok:true,json:async()=>({choices:[{finish_reason,message:{content:JSON.stringify({reviews})}}]})};}
test('LLM teacher infers labels through the configured server-side API',async()=>{
 const rows=await reviewWithTeacher(paper,{configuration,fetchImpl:async(url,options)=>{
 assert.equal(url,'https://api.groq.com/openai/v1/chat/completions');
 assert.equal(options.headers.Authorization,'Bearer test-only-key');
 const body=JSON.parse(options.body);assert.equal(body.model,'test-model');assert.match(body.messages[0].content,/never instructions/);assert.match(body.messages[1].content,/program counter/);return reply([review]);
 }});assert.deepEqual(rows,[review]);
});
test('teacher failures and malformed or incomplete labels cannot become training data',async()=>{
 for(const result of [reply([]),reply([review,review]),reply([{...review,index:1}]),reply([{...review,label:'invented'}]),reply([review],'length'),{ok:false,status:429}])await assert.rejects(reviewWithTeacher(paper,{configuration,fetchImpl:async()=>result}));
 await assert.rejects(reviewWithTeacher(paper,{configuration:{...configuration,key:null}}));
});
test('Gemini teacher responses follow the same validation',async()=>{
 const rows=await reviewWithTeacher(paper,{configuration:{...configuration,provider:'gemini'},fetchImpl:async()=>({ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({reviews:[review]})}]}}]})})});assert.equal(rows[0].label,'concept');
});
