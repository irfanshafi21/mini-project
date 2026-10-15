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


test('Q103 regression: marks constrain scope independently of difficulty', () => {
  const syllabus='Unit 4: Virtual memory concepts: pages, frames, page tables, translation lookaside buffer and page faults.';
  for (const difficulty of ['EASY','MEDIUM','HARD']) {
    const [short]=generateLocalQuestions(syllabus,[{marks:2,difficulty}]);
    assert.equal(short.topic,'Virtual memory');
    assert.ok(!/pages|frames|page tables|lookaside|and|diagram|analyse/i.test(short.text));
    assert.ok(short.text.split(/\s+/).length<=10);
  }
  for(const marks of [10,16]) {
    const [long]=generateLocalQuestions(syllabus,[{marks,difficulty:'EASY'}]);
    const allocated=[...long.text.matchAll(/\((\d+) marks\)/g)].reduce((n,m)=>n+Number(m[1]),0);
    assert.equal(allocated,marks);
    assert.match(long.text,/\(a\).*\n\(b\).*\n\(c\)/);
  }
});


test('syllabus formatting is removed and unit headings do not replace actual topics', () => {
  const text='# GATE Data Science syllabus\n## Unit 1: Probability and Statistics\n- **Conditional probability**\n- Bayes theorem\n## Unit 2: Linear Algebra\nEigenvalues and eigenvectors.';
  const topics=syllabusTopics(text);
  assert.deepEqual(topics.map(t=>t.topic),['Conditional probability','Bayes theorem','Eigenvalues and eigenvectors']);
  assert.deepEqual(topics.map(t=>t.unit),[1,1,2]);
  const questions=generateLocalQuestions(text,[{marks:2,difficulty:'EASY'}]);
  assert.ok(questions.every(q=>!/[#*`]/.test(q.text)));
});


test('PDF bullet headings and page numbers do not become question topics', () => {
  const extracted=syllabusTopics('Probability and Statistics • Bayes theorem • Conditional expectation and variance. Artificial Intelligence • Search. Cross-validation (LOO; k-fold). Singular value decomposition (SVD) 3');
  assert.deepEqual(extracted.map(t=>t.topic),['Bayes theorem','Conditional expectation and variance','Search','Cross-validation (LOO; k-fold)','Singular value decomposition (SVD)']);
});
