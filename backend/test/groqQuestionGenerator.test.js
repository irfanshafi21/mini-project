import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateGroqQuestions, generateOllamaQuestions } from '../src/groqQuestionGenerator.js';

const body = {
  subject: 'Physics', questionStyle: 'PROBLEM_SOLVING', oneMarkType: 'MCQ',
  units: [1], chapters: undefined, split: { easy: 100, medium: 0, hard: 0 },
  fileName: 'physics.txt', mimeType: 'text/plain', data: Buffer.from('Unit 1: Ohm law relates voltage, current and resistance.').toString('base64'),
};
const slots = [{ marks: 5, difficulty: 'EASY', bloomLevel: 'K3' }];
const topic = 'Ohm law relates voltage, current and resistance';
const valid = { questions: [{
  topic,
  subtopic: 'current', syllabusReference: topic,
  unit: 1,
  openingVerb: 'Calculate',
  questionCore: 'the current through a 6 Ω resistor connected to a 12 V source using Ohm’s law. Show your calculation.',
  marks: 5, difficulty: 'EASY', bloomLevel: 'K3', bloomSource: 'groq',
  questionType: 'SHORT', options: [], answer: '2 A', solution: 'I = V/R = 12/6 = 2 A.',
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
    assert.equal(result[0].bloomSource, 'groq');
    assert.equal(request.response_format.type, 'json_schema');
    assert.equal(request.model, 'openai/gpt-oss-20b');
    assert.ok(request.messages[1].content.includes('Never write phrases'));
    assert.ok(request.response_format.json_schema.schema.properties.questions.items.properties.openingVerb.enum.includes('Assess'));
    assert.ok(request.response_format.json_schema.schema.properties.questions.items.properties.topic.enum.includes(topic));
    assert.match(result[0].text, /^Calculate the current/);
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
    invalid.questions[0].questionCore = 'Ohm’s law and explain its purpose.';
    invalid.questions[0].answer = 'Current';
    invalid.questions[0].solution = 'Use the formula.';
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

test('Groq rejects template filler and requires a real worked numerical problem', async () => {
  const oldFetch = globalThis.fetch, oldKey = process.env.GROQ_API_KEY, oldModel = process.env.GROQ_MODEL;
  process.env.GROQ_API_KEY = 'unit-test-key'; process.env.GROQ_MODEL = 'openai/gpt-oss-20b';
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    const invalid = structuredClone(valid);
    invalid.questions[0].questionCore = 'Develop your response with a relevant example and clear reasoning.';
    invalid.questions[0].solution = 'The answer is 2.';
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

test('Ollama uses local structured outputs and applies the same syllabus and math checks', async () => {
  const oldFetch = globalThis.fetch, oldModel = process.env.OLLAMA_MODEL, oldUrl = process.env.OLLAMA_BASE_URL;
  process.env.OLLAMA_MODEL = 'qwen3.5:9b'; process.env.OLLAMA_BASE_URL = 'http://127.0.0.1:11434/';
  let requestUrl, request;
  globalThis.fetch = async (url, init) => {
    requestUrl = url;
    request = JSON.parse(init.body);
    return { ok: true, json: async () => ({ message: { content: JSON.stringify(valid) } }) };
  };
  try {
    const result = await generateOllamaQuestions({ body, text: `Unit 1: ${topic}.`, slots });
    assert.equal(requestUrl, 'http://127.0.0.1:11434/api/chat');
    assert.equal(request.model, 'qwen3.5:9b');
    assert.equal(request.stream, false);
    assert.equal(request.think, false);
    assert.equal(request.format.type, 'object');
    assert.equal(result[0].bloomSource, 'ollama');
    assert.match(result[0].text, /^Calculate the current/);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldModel === undefined) delete process.env.OLLAMA_MODEL; else process.env.OLLAMA_MODEL = oldModel;
    if (oldUrl === undefined) delete process.env.OLLAMA_BASE_URL; else process.env.OLLAMA_BASE_URL = oldUrl;
  }
});
