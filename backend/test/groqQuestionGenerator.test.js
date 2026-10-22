import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateGeminiQuestions, generateGroqQuestions } from '../src/groqQuestionGenerator.js';

const body = {
  subject: 'Physics', questionStyle: 'PROBLEM_SOLVING', oneMarkType: 'MCQ',
  units: [1], chapters: undefined, split: { easy: 100, medium: 0, hard: 0 },
  fileName: 'physics.txt', mimeType: 'text/plain', data: Buffer.from('Unit 1: Ohm law relates voltage, current and resistance.').toString('base64'),
};
const slots = [{ marks: 5, difficulty: 'EASY', bloomLevel: 'K3' }];
const topic = 'Ohm law relates to voltage, current and resistance';
const valid = { questions: [{
  topic,
  subtopic: 'Ohm law', syllabusReference: topic,
  unit: 1,
  openingVerb: 'Apply',
  questionCore: 'Calculate the current through a 6 Î© resistor connected to a 12 V source using Ohm law. Show your calculation.',
  marks: 5, difficulty: 'EASY', bloomLevel: 'K3', bloomSource: 'groq',
  questionType: 'SHORT', options: [], answer: '',
}] };

test('Groq structured generation maps questions to the requested syllabus slot', async () => {
  const oldFetch = globalThis.fetch, oldKey = process.env.GROQ_API_KEY, oldModel = process.env.GROQ_MODEL;
  process.env.GROQ_API_KEY = 'unit-test-key'; process.env.GROQ_MODEL = 'openai/gpt-oss-20b';
  let request;
  globalThis.fetch = async (_url, init) => {
    request = JSON.parse(init.body);
    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(valid) } }] }) };
  };
  try {
    const result = await generateGroqQuestions({ body, text: `Unit 1: ${topic}.`, slots });
    assert.equal(result.length, 1);
    assert.equal(result[0].marks, 5);
    assert.equal(result[0].bloomLevel, 'K3');
    assert.equal(result[0].bloomSource, 'requested-llm');
    assert.equal(result[0].difficulty, 'MEDIUM');
    assert.equal(request.response_format.type, 'json_schema');
    assert.equal(request.model, 'openai/gpt-oss-20b');
    assert.ok(request.messages[1].content.includes('Never write phrases'));
    assert.match(request.messages[1].content, /small synthetic dataset/);
    assert.match(request.messages[1].content, /labelled ASCII diagram/);
    assert.equal(typeof request.response_format.json_schema.schema.properties.questions.items.properties.supportingMaterial, 'object');
    assert.ok(request.response_format.json_schema.schema.properties.questions.items.properties.openingVerb.enum.includes('Assess'));
    assert.equal('topic' in request.response_format.json_schema.schema.properties.questions.items.properties, false);
    assert.ok(request.messages[1].content.includes(`Unit 1: ${topic}`));
    assert.equal('solution' in request.response_format.json_schema.schema.properties.questions.items.properties, false);
    assert.match(request.messages[1].content, /Never include an explanation, answer, worked solution/);
    assert.equal(result[0].answer, '');
    assert.equal('solution' in result[0], false);
    assert.equal('questionType' in request.response_format.json_schema.schema.properties.questions.items.properties, false);
    assert.match(result[0].text, /^Apply calculate the current/);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.GROQ_API_KEY; else process.env.GROQ_API_KEY = oldKey;
    if (oldModel === undefined) delete process.env.GROQ_MODEL; else process.env.GROQ_MODEL = oldModel;
  }
});

test('optional printable ML dataset or diagram material is included with the stem', async () => {
  const oldFetch = globalThis.fetch, oldKey = process.env.GROQ_API_KEY, oldModel = process.env.GROQ_MODEL;
  process.env.GROQ_API_KEY = 'unit-test-key'; process.env.GROQ_MODEL = 'openai/gpt-oss-20b';
  const withDataset = structuredClone(valid);
  withDataset.questions[0].supportingMaterial = 'Dataset (hours studied | pass):\n1 | no\n3 | yes\n5 | yes';
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(withDataset) } }] }) });
  try {
    const result = await generateGroqQuestions({ body, text: `Unit 1: ${topic}.`, slots });
    assert.match(result[0].text, /calculate the current/i);
    assert.match(result[0].text, /Dataset \(hours studied \| pass\):\n1 \| no\n3 \| yes\n5 \| yes/);
    assert.equal('supportingMaterial' in result[0], false);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.GROQ_API_KEY; else process.env.GROQ_API_KEY = oldKey;
    if (oldModel === undefined) delete process.env.GROQ_MODEL; else process.env.GROQ_MODEL = oldModel;
  }
});

test('a question is kept when it is on-topic but does not repeat the exact subtopic wording', async () => {
  const oldFetch = globalThis.fetch, oldKey = process.env.GROQ_API_KEY, oldModel = process.env.GROQ_MODEL;
  process.env.GROQ_API_KEY = 'unit-test-key'; process.env.GROQ_MODEL = 'openai/gpt-oss-20b';
  const onTopic = structuredClone(valid);
  onTopic.questions[0].questionCore = 'a resistor of 10 Î© carrying a current of 2 A; calculate the voltage across it.';
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(onTopic) } }] }) });
  try {
    const result = await generateGroqQuestions({ body, text: `Unit 1: ${topic}.`, slots });
    assert.match(result[0].text, /resistor of 10 Î©/);
    assert.equal(result[0].subtopic, 'Ohm law');
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.GROQ_API_KEY; else process.env.GROQ_API_KEY = oldKey;
    if (oldModel === undefined) delete process.env.GROQ_MODEL; else process.env.GROQ_MODEL = oldModel;
  }
});

test('Groq retries invalid math once, then reports quality issues instead of accepting it', async () => {
  const oldFetch = globalThis.fetch, oldKey = process.env.GROQ_API_KEY, oldModel = process.env.GROQ_MODEL;
  process.env.GROQ_API_KEY = 'unit-test-key'; process.env.GROQ_MODEL = 'openai/gpt-oss-20b';
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    const invalid = structuredClone(valid);
    invalid.questions[0].questionCore = 'Ohmâ€™s law and explain its purpose.';
    invalid.questions[0].answer = '';
    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(invalid) } }] }) };
  };
  try {
    await assert.rejects(generateGroqQuestions({ body, text: `Unit 1: ${topic}.`, slots }), /failed quality checks/);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.GROQ_API_KEY; else process.env.GROQ_API_KEY = oldKey;
    if (oldModel === undefined) delete process.env.GROQ_MODEL; else process.env.GROQ_MODEL = oldModel;
  }
});

test('Groq rejects template filler and requires a concrete numerical problem without a solution', async () => {
  const oldFetch = globalThis.fetch, oldKey = process.env.GROQ_API_KEY, oldModel = process.env.GROQ_MODEL;
  process.env.GROQ_API_KEY = 'unit-test-key'; process.env.GROQ_MODEL = 'openai/gpt-oss-20b';
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    const invalid = structuredClone(valid);
    invalid.questions[0].questionCore = 'Develop your response with a relevant example and clear reasoning.';
    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(invalid) } }] }) };
  };
  try {
    await assert.rejects(generateGroqQuestions({ body, text: `Unit 1: ${topic}.`, slots }), /failed quality checks/);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.GROQ_API_KEY; else process.env.GROQ_API_KEY = oldKey;
    if (oldModel === undefined) delete process.env.GROQ_MODEL; else process.env.GROQ_MODEL = oldModel;
  }
});

test('Gemini sends a backend-held key and schema-constrained syllabus prompt', async () => {
  const oldFetch=globalThis.fetch,oldKey=process.env.GEMINI_API_KEY,oldModel=process.env.GEMINI_MODEL;
  process.env.GEMINI_API_KEY='unit-test-key';process.env.GEMINI_MODEL='gemini-3.8-flash';
  let url,request,headers;
  globalThis.fetch=async (u,init)=>{url=u;request=JSON.parse(init.body);headers=init.headers;return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify(valid)}]},finishReason:'STOP'}]})}};
  try {
    const result=await generateGeminiQuestions({body:{...body,questionStyle:'PROBLEM_SOLVING'},text:`Unit 1: ${topic}.`,slots});
    assert.equal(result.length,1);
    assert.match(url,/models\/gemini-3\.8-flash:generateContent$/);
    assert.equal(headers['x-goog-api-key'],'unit-test-key');
    assert.equal(request.generationConfig.responseMimeType,'application/json');
    const schema=request.generationConfig.responseJsonSchema.properties.questions;
    assert.equal(schema.minItems,1);
    assert.equal('enum' in schema.items.properties.subtopic,false);
    assert.equal('enum' in schema.items.properties.openingVerb,false);
    assert.equal('options' in schema.items.properties,false);
    assert.equal('answer' in schema.items.properties,false);
    assert.match(request.contents[0].parts[0].text,/K1 Remember/);
    assert.match(request.contents[0].parts[0].text,/K1\/K2 to EASY, K3\/K4 to MEDIUM, and K5\/K6 to HARD/);
    assert.match(request.contents[0].parts[0].text,/10 marks asks for a substantial/);
    assert.match(request.contents[0].parts[0].text,/authors, publishers, or books/);
    assert.match(request.contents[0].parts[0].text,/Use GATE as a reference for question quality only/);
    assert.match(request.contents[0].parts[0].text,/State all assumptions, definitions, input values, units, boundary conditions/);
    assert.match(request.contents[0].parts[0].text,/Do not copy or paraphrase past GATE questions/);
    assert.equal(result[0].bloomSource,'requested-llm');
  } finally {
    globalThis.fetch=oldFetch;
    if(oldKey===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=oldKey;
    if(oldModel===undefined)delete process.env.GEMINI_MODEL;else process.env.GEMINI_MODEL=oldModel;
  }
});

test('generation rewrites questions about document metadata instead of keeping them', async () => {
  const oldFetch=globalThis.fetch,oldKey=process.env.GROQ_API_KEY,oldModel=process.env.GROQ_MODEL;
  process.env.GROQ_API_KEY='unit-test-key';process.env.GROQ_MODEL='openai/gpt-oss-20b';
  let calls=0;const prompts=[];
  globalThis.fetch=async (_url,init)=>{
    prompts.push(JSON.parse(init.body).messages[1].content);
    calls++;
    const response=calls===1?structuredClone(valid):structuredClone(valid);
    if(calls===1)response.questions[0].questionCore='List the subjects included in the syllabus across academic years.';
    return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify(response)}}]})};
  };
  try{
    const result=await generateGroqQuestions({body,text:`Unit 1: ${topic}.`,slots});
    assert.equal(calls,2);
    assert.match(prompts[0],/Never ask students to describe the document or its organization/);
    assert.match(prompts[1],/document metadata or course coverage/);
    assert.doesNotMatch(result[0].text,/syllabus|academic years|subjects included/i);
  }finally{
    globalThis.fetch=oldFetch;
    if(oldKey===undefined)delete process.env.GROQ_API_KEY;else process.env.GROQ_API_KEY=oldKey;
    if(oldModel===undefined)delete process.env.GROQ_MODEL;else process.env.GROQ_MODEL=oldModel;
  }
});

test('Bloom level sets exact question difficulty from K1 through K6', async () => {
  const oldFetch=globalThis.fetch,oldKey=process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY='unit-test-key';
  const levels=[['K1','Define'],['K2','Explain'],['K3','Apply'],['K4','Analyze'],['K5','Evaluate'],['K6','Design']];
  const questions=levels.map(([bloomLevel,openingVerb])=>({...valid.questions[0],bloomLevel,openingVerb,questionCore:'the Ohm law relationship between voltage, current and resistance.'}));
  globalThis.fetch=async()=>({ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify({questions})}]},finishReason:'STOP'}]})});
  try {
    const result=await generateGeminiQuestions({body:{...body,questionStyle:'THEORY'},text:`Unit 1: ${topic}.`,slots:levels.map(([bloomLevel])=>({marks:5,difficulty:'HARD',bloomLevel}))});
    assert.deepEqual(result.map(q=>q.difficulty),['EASY','EASY','MEDIUM','MEDIUM','HARD','HARD']);
  } finally {globalThis.fetch=oldFetch;if(oldKey===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=oldKey;}
});
