import assert from 'node:assert/strict';
import { test } from 'node:test';
import { retrieveSyllabusEvidence } from '../src/syllabusRetrieval.js';

test('BM25 retrieves syllabus evidence for the matching topic and selected unit', () => {
  const syllabus = `Unit 1: Probability and Statistics\nBayes theorem and conditional probability.\nLinear regression and least squares.\nUnit 2: Linear Algebra\nEigenvalues and eigenvectors of a matrix.`;
  const result = retrieveSyllabusEvidence(syllabus, { unit: 1, topic: 'Bayes theorem and conditional probability' });
  assert.ok(result.some(text => /Bayes theorem and conditional probability/i.test(text)));
  assert.ok(result.every(text => !/Eigenvalues/i.test(text)));
});

test('BM25 falls back to the extracted syllabus topic if no passage matches', () => {
  assert.deepEqual(retrieveSyllabusEvidence('Unit 1: Other course concept', { unit: 1, topic: 'Expected topic' }), ['Expected topic']);
});
