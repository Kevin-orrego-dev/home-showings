import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { searchSchema } from './scheduling.schemas.js';
import { searchAvailableListings } from './scheduling.service.js';

export const searchRouter = Router();

// POST (not GET) because the input is a structured list of time windows:
// cramming an array of objects into a query string is fragile and ugly.
// Same pattern as Elasticsearch's _search. It still has no side effects.
searchRouter.post('/', requireAuth, async (req, res) => {
  const input = searchSchema.parse(req.body);
  res.json({ results: await searchAvailableListings(req.user!, input) });
});
