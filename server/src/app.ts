import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';

// app.ts builds the Express app but does NOT start listening.
// Keeping it separate from server.ts lets tests import the app
// (with supertest) without opening a real port.
export function createApp() {
  const app = express();

  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  return app;
}
