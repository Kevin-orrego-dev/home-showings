import { z } from 'zod';

const DAY_MS = 86_400_000;
export const MAX_SEARCH_SPAN_DAYS = 31;

// ISO 8601 instant WITH offset or Z, e.g. "2026-09-26T09:00:00-05:00".
// Requiring the offset removes any ambiguity about which timezone the buyer meant.
const isoInstant = z
  .string()
  .datetime({ offset: true, message: 'Must be an ISO date-time with timezone, e.g. 2026-09-26T09:00:00-05:00' })
  .transform((s) => new Date(s));

export const timeWindowSchema = z
  .object({ start: isoInstant, end: isoInstant })
  .refine((w) => w.end > w.start, { message: 'end must be after start', path: ['end'] });

// Guard rails: without a cap, one request asking for "every slot for the next
// 10 years" would make the server generate millions of slots.
const spanWithinLimit = (windows: { start: Date; end: Date }[]) => {
  const min = Math.min(...windows.map((w) => w.start.getTime()));
  const max = Math.max(...windows.map((w) => w.end.getTime()));
  return max - min <= MAX_SEARCH_SPAN_DAYS * DAY_MS;
};

export const searchSchema = z
  .object({
    windows: z.array(timeWindowSchema).min(1, 'Add at least one availability window').max(10),
    city: z.string().trim().max(100).optional(),
    minPriceCents: z.number().int().positive().optional(),
    maxPriceCents: z.number().int().positive().optional(),
    minBedrooms: z.number().int().min(0).max(50).optional(),
  })
  .refine((v) => spanWithinLimit(v.windows), {
    message: `Availability can span at most ${MAX_SEARCH_SPAN_DAYS} days`,
    path: ['windows'],
  })
  .refine((v) => !v.minPriceCents || !v.maxPriceCents || v.minPriceCents <= v.maxPriceCents, {
    message: 'minPrice must be less than maxPrice',
    path: ['maxPriceCents'],
  });

// GET /listings/:id/slots?from=...&to=...  (defaults: now -> +14 days)
export const slotsQuerySchema = z
  .object({
    from: isoInstant.optional(),
    to: isoInstant.optional(),
  })
  .transform(({ from, to }) => {
    const start = from ?? new Date();
    return { start, end: to ?? new Date(start.getTime() + 14 * DAY_MS) };
  })
  .refine((r) => r.end > r.start && r.end.getTime() - r.start.getTime() <= MAX_SEARCH_SPAN_DAYS * DAY_MS, {
    message: `Range must be positive and at most ${MAX_SEARCH_SPAN_DAYS} days`,
  });

export type SearchInput = z.infer<typeof searchSchema>;
