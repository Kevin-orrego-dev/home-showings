import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors.js';

// Postgres error codes we translate into meaningful HTTP responses.
// https://www.postgresql.org/docs/current/errcodes-appendix.html
const PG_UNIQUE_VIOLATION = '23505';
const PG_EXCLUSION_VIOLATION = '23P01'; // our "no overlapping showings" constraint

// Every error in the app ends up here, so the response shape is always:
//   { error: { code, message, details? } }
// The frontend can rely on that single format.
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: err.flatten().fieldErrors,
      },
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }

  if (err?.code === PG_UNIQUE_VIOLATION) {
    res.status(409).json({ error: { code: 'CONFLICT', message: 'That record already exists' } });
    return;
  }

  if (err?.code === PG_EXCLUSION_VIOLATION) {
    res.status(409).json({
      error: { code: 'SLOT_TAKEN', message: 'That time slot was just booked. Please pick another one.' },
    });
    return;
  }

  // Unknown error = bug. Log the details, but never leak them to the client.
  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
};

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
};
