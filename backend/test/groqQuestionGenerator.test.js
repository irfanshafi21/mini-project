import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateGroqQuestions, generateOllamaQuestions } from '../src/groqQuestionGenerator.js';

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
  questionCore: 'Calculate the current through a 6 Ω resistor connected to a 12 V source using Ohm law. Show your calculation.',
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
    assert.equal(result[0].bloomSource, 'groq');
    assert.equal(request.response_format.type, 'json_schema');
    assert.equal(request.model, 'openai/gpt-oss-20b');
    assert.ok(request.messages[1].content.includes('Never write phrases'));
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

test('a question is kept when it is on-topic but does not repeat the exact subtopic wording', async () => {
  const oldFetch = globalThis.fetch, oldKey = process.env.GROQ_API_KEY, oldModel = process.env.GROQ_MODEL;
  process.env.GROQ_API_KEY = 'unit-test-key'; process.env.GROQ_MODEL = 'openai/gpt-oss-20b';
  const onTopic = structuredClone(valid);
  onTopic.questions[0].questionCore = 'a resistor of 10 Ω carrying a current of 2 A; calculate the voltage across it.';
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(onTopic) } }] }) });
  try {
    const result = await generateGroqQuestions({ body, text: `Unit 1: ${topic}.`, slots });
    assert.match(result[0].text, /resistor of 10 Ω/);
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
    invalid.questions[0].questionCore = 'Ohm’s law and explain its purpose.';
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
    assert.equal(request.keep_alive, '30m');
    assert.ok(request.options.num_ctx >= 4096 && request.options.num_ctx <= 8192);
    assert.ok(request.options.num_predict <= 8000);
    assert.equal(request.format.type, 'object');
    assert.equal(result[0].bloomSource, 'ollama');
    assert.equal('questionType' in request.format.properties.questions.items.properties, false);
    assert.equal('solution' in request.format.properties.questions.items.properties, false);
    assert.match(result[0].text, /^Apply calculate the current/);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldModel === undefined) delete process.env.OLLAMA_MODEL; else process.env.OLLAMA_MODEL = oldModel;
    if (oldUrl === undefined) delete process.env.OLLAMA_BASE_URL; else process.env.OLLAMA_BASE_URL = oldUrl;
  }
});

test('Ollama recovers valid JSON wrapped in model chatter or a markdown fence', async () => {
  const oldFetch = globalThis.fetch, oldModel = process.env.OLLAMA_MODEL;
  process.env.OLLAMA_MODEL = 'qwen3.5:4b';
  globalThis.fetch = async () => ({ ok: true, json: async () => ({
    message: { content: `Here is the result:\n\`\`\`json\n${JSON.stringify(valid)}\n\`\`\`` },
  }) });
  try {
    const result = await generateOllamaQuestions({ body, text: `Unit 1: ${topic}.`, slots });
    assert.equal(result.length, 1);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldModel === undefined) delete process.env.OLLAMA_MODEL; else process.env.OLLAMA_MODEL = oldModel;
  }
});

test('Ollama explains when structured output was cut off at its token limit', async () => {
  const oldFetch = globalThis.fetch, oldModel = process.env.OLLAMA_MODEL;
  process.env.OLLAMA_MODEL = 'qwen3.5:4b';
  globalThis.fetch = async () => ({ ok: true, json: async () => ({
    message: { content: '{"questions":[' }, done_reason: 'length', eval_count: 920,
  }) });
  try {
    await assert.rejects(
      generateOllamaQuestions({ body, text: `Unit 1: ${topic}.`, slots }),
      /reached its output limit before the JSON was complete/,
    );
  } finally {
    globalThis.fetch = oldFetch;
    if (oldModel === undefined) delete process.env.OLLAMA_MODEL; else process.env.OLLAMA_MODEL = oldModel;
  }
});

test('Ollama keeps papers up to twenty questions in one batch and preserves larger-paper counts', async () => {
  const oldFetch = globalThis.fetch, oldModel = process.env.OLLAMA_MODEL;
  process.env.OLLAMA_MODEL = 'qwen3.5:4b';
  let calls = 0;
  globalThis.fetch = async () => {
    const size = calls++ === 0 ? 20 : 1;
    const question = { ...valid.questions[0], marks: 2, bloomLevel: 'K1', openingVerb: 'Define',
      questionCore: 'the Ohm law.', text: undefined, answer: '' };
    return { ok: true, json: async () => ({ message: { content: JSON.stringify({ questions: Array.from({ length: size }, () => question) }) } }) };
  };
  try {
    const result = await generateOllamaQuestions({
      body: { ...body, questionStyle: 'THEORY' }, text: `Unit 1: ${topic}.`,
      slots: Array.from({ length: 21 }, () => ({ marks: 2, difficulty: 'EASY', bloomLevel: 'K1' })),
    });
    assert.equal(calls, 2);
    assert.equal(result.length, 21);
    assert.equal(result[20].id, 'OLLAMA21');
  } finally {
    globalThis.fetch = oldFetch;
    if (oldModel === undefined) delete process.env.OLLAMA_MODEL; else process.env.OLLAMA_MODEL = oldModel;
  }
});

test('Ollama rejects problem-solving output when theory-only mode is selected', async () => {
  const oldFetch = globalThis.fetch, oldModel = process.env.OLLAMA_MODEL;
  process.env.OLLAMA_MODEL = 'qwen3.5:4b';
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ message: { content: JSON.stringify(valid) } }) });
  try {
    await assert.rejects(
      generateOllamaQuestions({ body: { ...body, questionStyle: 'THEORY' }, text: `Unit 1: ${topic}.`, slots }),
      /must be theory only/,
    );
  } finally {
    globalThis.fetch = oldFetch;
    if (oldModel === undefined) delete process.env.OLLAMA_MODEL; else process.env.OLLAMA_MODEL = oldModel;
  }
});

test('Ollama mixed mode allows conceptual K3 maths and still requires a numerical problem', async () => {
  const oldFetch = globalThis.fetch, oldModel = process.env.OLLAMA_MODEL;
  process.env.OLLAMA_MODEL = 'qwen3.5:4b';
  let request;
  const conceptualK3 = {
    ...valid.questions[0], openingVerb: 'Apply',
    questionCore: 'Ohm law to predict how current changes when resistance increases while voltage remains constant.',
    bloomLevel: 'K3', answer: '',
  };
  globalThis.fetch = async (_url, init) => {
    request = JSON.parse(init.body);
    return { ok: true, json: async () => ({ message: { content: JSON.stringify({ questions: [conceptualK3, valid.questions[0]] }) } }) };
  };
  try {
    const result = await generateOllamaQuestions({
      body: { ...body, questionStyle: 'MIXED' }, text: `Unit 1: ${topic}.`,
      slots: [slots[0], slots[0]],
    });
    assert.equal(result.length, 2);
    assert.match(result[0].text, /^Apply/);
    assert.ok(request.messages[1].content.includes('Mixed mode:'));
    assert.equal('questionType' in request.format.properties.questions.items.properties, false);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldModel === undefined) delete process.env.OLLAMA_MODEL; else process.env.OLLAMA_MODEL = oldModel;
  }
});
