import { Router } from 'express';
import { generateSyllabusPaper, syllabusBody } from '../syllabusGenerator.js';

const router = Router();
router.post('/papers/from-syllabus', async (req, res) => {
  const body = syllabusBody.parse(req.body);
  res.json(await generateSyllabusPaper(body));
});
export default router;
