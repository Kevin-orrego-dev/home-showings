import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { idParamSchema } from '../../lib/validation.js';
import { availabilitySchema, createListingSchema, updateListingSchema } from './listings.schemas.js';
import * as listingsService from './listings.service.js';

export const listingsRouter = Router();

// Every listings route needs a logged-in user.
listingsRouter.use(requireAuth);

// --- Seller side -----------------------------------------------------

// Declared BEFORE "/:id" so "mine" isn't captured as an id.
listingsRouter.get('/mine', requireRole('seller'), async (req, res) => {
  res.json({ listings: await listingsService.listMyListings(req.user!) });
});

listingsRouter.post('/', requireRole('seller'), async (req, res) => {
  const input = createListingSchema.parse(req.body);
  const listing = await listingsService.createListing(req.user!, input);
  res.status(201).json({ listing });
});

listingsRouter.patch('/:id', requireRole('seller'), async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const input = updateListingSchema.parse(req.body);
  res.json({ listing: await listingsService.updateListing(id, req.user!, input) });
});

listingsRouter.put('/:id/availability', requireRole('seller'), async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const input = availabilitySchema.parse(req.body);
  res.json({ availability: await listingsService.setAvailability(id, req.user!, input) });
});

listingsRouter.delete('/:id', requireRole('seller'), async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  await listingsService.deleteListing(id, req.user!);
  res.status(204).end();
});

// --- Both sides ------------------------------------------------------

listingsRouter.get('/:id', async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json({ listing: await listingsService.getListingDetail(id, req.user!) });
});
