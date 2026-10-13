import { Router } from 'express';
import { generateSyllabusPaper, syllabusBody } from '../syllabusGenerator.js';

import { requireRegisteredSubject } from './subjects.js';

const router = Router();
router.post('/papers/from-syllabus', async (req, res) => {
  const body = syllabusBody.parse(req.body);
  await requireRegisteredSubject(body.subject);
  res.json(await generateSyllabusPaper(body));
});
export default router;
