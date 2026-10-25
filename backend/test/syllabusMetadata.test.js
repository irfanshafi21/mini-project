import assert from 'node:assert/strict';
import { test } from 'node:test';
import { syllabusTopics } from '../src/localModel.js';

test('syllabus topic extraction excludes textbook and bibliographic sections', () => {
  const text = `Course: Computer Organization
Author: A. N. Author
Unit 1: Number Systems
Binary representation and base conversion
Text Books / Reference Books:
Computer Organization and Design, David Patterson and John Hennessy, 6th Edition
ISBN: 978-0128201091
Publisher: Academic Press
Unit 2: CPU Organization
Instruction cycle and processor registers`;

  const topics = syllabusTopics(text);
  assert.deepEqual(topics.map(({ topic, unit }) => ({ topic, unit })), [
    { topic: 'Binary representation and base conversion', unit: 1 },
    { topic: 'Instruction cycle and processor registers', unit: 2 },
  ]);
  assert.ok(topics.every(({ topic }) => !/Patterson|Hennessy|ISBN|Academic Press|Author/i.test(topic)));
});

test('GATE cover notes, year comparisons, paper pattern and source footers are excluded from question topics', () => {
  const text = `GATE DA 2027 Syllabus | Page 1
GATE 2027: Data Science & Artificial Intelligence
Syllabus summary · Exam date: 8 February 2027
Paper pattern
Section Marks
Total (3 hours, 65 questions) 100
No fixed marks per technical subject. The DA syllabus has no separate Engineering Mathematics section; the 2027 syllabus is unchanged from 2026.
1. Probability and Statistics
• Counting (permutations and combinations); probability axioms, sample space, events
• Bayes theorem
Author: A. Example
Text Books / Reference Books:
Recommended reading by Example Author
Compiled from the official GATE syllabus as reproduced by prep sites.
Always verify against the official PDF before exam registration.`;
  const topics = syllabusTopics(text);
  assert.deepEqual(topics.map(({ topic }) => topic), [
    'Counting (permutations and combinations)',
    'probability axioms, sample space, events',
    'Bayes theorem',
  ]);
});
