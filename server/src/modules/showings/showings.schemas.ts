import { z } from 'zod';

export const bookShowingSchema = z.object({
  listingId: z.string().uuid('Invalid listing id'),
  // Only the START comes from the client. The end is computed on the server from the
  // listing's duration: never trust the client to decide how long it may occupy the house.
  startsAt: z
    .string()
    .datetime({ offset: true, message: 'startsAt must be an ISO date-time with timezone' })
    .transform((s) => new Date(s)),
  notes: z.string().trim().max(500).optional(),
});

export const listShowingsQuerySchema = z.object({
  scope: z.enum(['upcoming', 'past', 'all']).default('upcoming'),
});

export type BookShowingInput = z.infer<typeof bookShowingSchema>;
