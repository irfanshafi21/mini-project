import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const notFound = (what = 'Question') => new HttpError(404, `${what} not found`);

// one place that turns every error into a clean JSON response
export function errorHandler(err, req, res, _next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation failed',
      details: err.issues.map((i) => ({ field: i.path.join('.') || 'body', message: i.message })),
    });
  }
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body' });
  if (err.code === '23505') {
    return res.status(409).json({ error: 'A question with the same text already exists in this unit' });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
}
