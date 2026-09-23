import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { authRouter } from './modules/auth/auth.routes.js';

// app.ts builds the Express app but does NOT start listening.
// Keeping it separate from server.ts lets tests import the app
// (with supertest) without opening a real port.
export function createApp() {
  const app = express();

  app.use(helmet()); // sensible security headers
  // credentials: true lets the browser send our auth cookie cross-origin in dev.
  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/auth', authRouter);

  // Order matters: these two must be registered last.
  app.use('/api', notFoundHandler);
  app.use(errorHandler);

  return app;
}
