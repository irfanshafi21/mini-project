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
