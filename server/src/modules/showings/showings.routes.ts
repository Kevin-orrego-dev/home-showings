import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { idParamSchema } from '../../lib/validation.js';
import { bookShowingSchema, listShowingsQuerySchema } from './showings.schemas.js';
import * as showingsService from './showings.service.js';

export const showingsRouter = Router();
showingsRouter.use(requireAuth);

showingsRouter.get('/', async (req, res) => {
  const { scope } = listShowingsQuerySchema.parse(req.query);
  res.json({ showings: await showingsService.listShowings(req.user!, scope) });
});

showingsRouter.post('/', requireRole('buyer'), async (req, res) => {
  const input = bookShowingSchema.parse(req.body);
  res.status(201).json({ showing: await showingsService.bookShowing(req.user!, input) });
});

// An action endpoint (POST /:id/cancel) instead of DELETE: the showing isn't removed,
// it changes state and keeps its history (who cancelled, when).
showingsRouter.post('/:id/cancel', async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json({ showing: await showingsService.cancelShowing(id, req.user!) });
});
