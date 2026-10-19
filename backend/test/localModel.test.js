import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifyTopic, generateLocalQuestions, syllabusTopics, questionHash, reuseSignature, retrieveSyllabusContext } from '../src/localModel.js';

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
  const all=generateLocalQuestions('Unit 1: CPU registers\nUnit 3: Virtual memory',Array.from({length:14},()=>slots[0]));
  assert.equal(new Set(all.map(q=>q.text)).size,14);
  assert.throws(()=>generateLocalQuestions('Unit 1: CPU registers\nUnit 3: Virtual memory',slots,all.map(q=>questionHash(q.text)),'MCQ',{previousSignatures:all.map(reuseSignature)}),e=>e.status===409);
});

test('easy questions rotate prompt templates instead of reusing one generic opener',()=>{
 const text='Unit 1: Unsupervised learning\nk-means clustering. PCA. Support in association-rule learning. Precision and recall. Cross-validation. Hierarchical clustering.';
 const questions=generateLocalQuestions(text,Array.from({length:6},()=>({marks:2,difficulty:'EASY'})));
 assert.ok(new Set(questions.map(q=>q.text.split(/\s+/)[0].toLowerCase())).size>=3);
});


test('Q103 regression: marks constrain scope independently of difficulty', () => {
  const syllabus='Unit 4: Virtual memory concepts: pages, frames, page tables, translation lookaside buffer and page faults.';
  for (const difficulty of ['EASY','MEDIUM','HARD']) {
    const [short]=generateLocalQuestions(syllabus,[{marks:2,difficulty}]);
    assert.match(short.topic,/^(pages|frames|page tables|translation lookaside buffer|page faults) in virtual memory$/i);
    assert.match(short.text,new RegExp(short.topic,'i'));
    assert.ok(!/diagram|analyse/i.test(short.text));
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

test('colon headings keep detailed syllabus items as question-generation targets',()=>{
 const source='Unit III: Clustering: k-means algorithm, initialization, convergence and selection of the number of clusters.';
 const topics=syllabusTopics(source);
 assert.ok(topics.some(t=>t.topic==='K-means clustering: k-means algorithm'));
 const [question]=generateLocalQuestions(source,[{marks:2,difficulty:'EASY'}]);
 assert.match(question.text,/k-means/i);
 assert.doesNotMatch(question.text,/Define Clustering\./i);
});


test('PDF bullet headings and page numbers do not become question topics', () => {
  const extracted=syllabusTopics('Probability and Statistics • Bayes theorem • Conditional expectation and variance. Artificial Intelligence • Search. Cross-validation (LOO; k-fold). Singular value decomposition (SVD) 3');
  assert.deepEqual(extracted.map(t=>t.topic),['Bayes theorem','Conditional expectation and variance','Search','Cross-validation (LOO; k-fold)','Singular value decomposition (SVD)']);
});

test('local BM25 retrieval grounds questions in the matching syllabus passage and unit',()=>{
 const syllabus='Unit 1: Probability and Statistics\nBayes theorem updates prior probabilities using evidence and a likelihood.\nUnit 2: Machine Learning\nK-means clustering assigns samples to the nearest centroid and updates centroids iteratively.';
 const result=retrieveSyllabusContext(syllabus,'k-means centroid clustering',2,2);
 assert.ok(result.length>0);
 assert.match(result[0].text,/nearest centroid/i);
 assert.equal(result[0].unit,2);
 const [question]=generateLocalQuestions(syllabus,[{marks:2,difficulty:'EASY'}]);
 assert.ok(question.syllabusReference);
 assert.ok(question.retrievalScore>0);
 assert.match(question.syllabusReference,/Bayes|probabilit|centroid|k-means/i);
 assert.equal(question.unit,/Bayes|probabilit/i.test(question.syllabusReference)?1:2);
});


test('checked objective facts produce one correct option and blanks without revealing answers', () => {
  const text='Unit 1: Data structures\nStacks. Queues. Binary search. Linear search.';
  const mcq=generateLocalQuestions(text,[{marks:1,difficulty:'EASY'}],[],'MCQ')[0];
  assert.equal(mcq.questionType,'MCQ');assert.equal(mcq.options.length,4);
  assert.equal(mcq.options.filter(o=>o===mcq.answer).length,1);
  assert.ok(mcq.options.every(o=>['Stack','Queue','Binary search','Linear search','Merge sort','Hash table'].includes(o)));
  const blank=generateLocalQuestions(text,[{marks:1,difficulty:'EASY'}],[],'FILL_BLANK')[0];
  assert.equal(blank.options.length,0);assert.match(blank.text,/____/);
  assert.ok(!blank.text.toLowerCase().includes(blank.answer.toLowerCase()));
  assert.throws(()=>generateLocalQuestions('Unit 1: Unsupported advanced topic',[{marks:1,difficulty:'EASY'}]),e=>e.status===409);
});

 test('numerical variants retain a repeat signature and the repeat budget is at most 20 percent',()=>{
 const source='Unit 1: Binary addition arithmetic';
 const slot={marks:2,difficulty:'EASY'};
 const first=generateLocalQuestions(source,[slot]);
 const next=generateLocalQuestions(source+'\nCPU registers. Cache memory.',Array(5).fill(slot),first.map(q=>questionHash(q.text)),'MCQ',{previousSignatures:first.map(reuseSignature)});
 assert.ok(next.filter(q=>q.reused).length<=1);
 assert.throws(()=>generateLocalQuestions(source,[slot],first.map(q=>questionHash(q.text)),'MCQ',{previousSignatures:first.map(reuseSignature)}),e=>e.status===409);
 });
