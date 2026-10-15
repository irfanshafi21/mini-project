import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifyTopic, generateLocalQuestions, syllabusTopics, questionHash } from '../src/localModel.js';

test('local model predicts learned topic families and reads numeric/roman units', () => {
  assert.equal(classifyTopic('binary addition arithmetic'),'numerical');
  assert.equal(classifyTopic('RISC versus CISC processors'),'comparison');
  assert.deepEqual(syllabusTopics('Unit I: CPU registers\nUnit III: Cache memory').map(t=>t.unit),[1,3]);
  const extracted=syllabusTopics('Course objectives\nLearn concepts\nUnit 1: Memory organisation - 9 hours\nCache memory and\naddress fields.\nLearning outcomes: draw a diagram\nCompare registers\nUnit 2: CPU registers\nAssessment scope\nUnrelated excluded topics');
  assert.ok(extracted.some(t=>t.topic==='Cache memory and address fields'));
  assert.ok(extracted.every(t=>!/hours|diagram|excluded|Compare registers/.test(t.topic)));
});
test('local generation changes questions and reports finite-capacity exhaustion honestly', () => {
  const text='Unit 1: CPU registers\nUnit 3: Cache memory hierarchy';
  const slots=Array.from({length:2},()=>({marks:2,difficulty:'EASY'}));
  const first=generateLocalQuestions(text,slots), hashes=first.map(q=>questionHash(q.text));
  const second=generateLocalQuestions(text,slots,hashes);
  assert.ok(second.every(q=>!hashes.includes(questionHash(q.text))));
  assert.equal(new Set(first.map(q=>q.unit)).size,2);
  const all=generateLocalQuestions(text,Array.from({length:16},()=>slots[0]));
  assert.equal(new Set(all.map(q=>q.text)).size,16);
  assert.throws(()=>generateLocalQuestions(text,slots,all.map(q=>questionHash(q.text))),e=>e.status===409);
});
