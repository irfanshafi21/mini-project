import { Router } from 'express';
import { generateSyllabusPaper, syllabusBody } from '../syllabusGenerator.js';

import { requireRegisteredSubject, recordGeneratedPaper } from './subjects.js';

const router = Router();
router.post('/papers/from-syllabus', async (req, res) => {
  const body = syllabusBody.parse(req.body);
  await requireRegisteredSubject(body.subject);
  const result = await generateSyllabusPaper(body);
  await recordGeneratedPaper(body.subject, result.paper.questions.length, 'syllabus');
  res.json(result);
});
export default router;
