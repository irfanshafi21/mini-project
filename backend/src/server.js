import { app } from './app.js';

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Question Bank API running at http://localhost:${port}/api/health`));
