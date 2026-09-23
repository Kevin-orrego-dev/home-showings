import { z } from 'zod';
import { dateString, timeString, timezoneString, toMinutes } from '../../lib/validation.js';

// ---------------------------------------------------------------------
// Availability
// ---------------------------------------------------------------------

export const ruleSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6), // 0 = Sunday
    startTime: timeString,
    endTime: timeString,
  })
  .refine((r) => toMinutes(r.endTime) > toMinutes(r.startTime), {
    message: 'End time must be after start time',
    path: ['endTime'],
  });

export const blackoutSchema = z.object({
  date: dateString,
  reason: z.string().trim().max(200).optional(),
});

// The whole weekly schedule is sent and replaced at once (see service for why).
export const availabilitySchema = z
  .object({
    rules: z.array(ruleSchema).max(50),
    blackoutDates: z.array(blackoutSchema).max(365).default([]),
  })
  .superRefine((value, ctx) => {
    // Overlapping rules on the same day (Mon 9-12 and Mon 11-14) would generate
    // duplicate slots. Reject them instead of guessing how to merge them.
    const byDay = new Map<number, { start: number; end: number }[]>();
    for (const r of value.rules) {
      const list = byDay.get(r.dayOfWeek) ?? [];
      list.push({ start: toMinutes(r.startTime), end: toMinutes(r.endTime) });
      byDay.set(r.dayOfWeek, list);
    }
    for (const [day, ranges] of byDay) {
      ranges.sort((a, b) => a.start - b.start);
      for (let i = 1; i < ranges.length; i++) {
        if (ranges[i].start < ranges[i - 1].end) {
          ctx.addIssue({ code: 'custom', path: ['rules'], message: `Rules overlap on day ${day}` });
          return;
        }
      }
    }

    const dates = value.blackoutDates.map((b) => b.date);
    if (new Set(dates).size !== dates.length) {
      ctx.addIssue({ code: 'custom', path: ['blackoutDates'], message: 'Duplicate blackout dates' });
    }
  });

// ---------------------------------------------------------------------
// Listing
// ---------------------------------------------------------------------

const listingFields = {
  title: z.string().trim().min(1, 'Title is required').max(120),
  description: z.string().trim().max(2000).default(''),
  address: z.string().trim().min(1, 'Address is required').max(200),
  city: z.string().trim().min(1, 'City is required').max(100),
  // The API speaks integer cents; the UI converts from dollars.
  priceCents: z.number().int().positive('Price must be greater than 0').max(1_000_000_000_00),
  bedrooms: z.number().int().min(0).max(50),
  bathrooms: z.number().min(0).max(50).multipleOf(0.5),
  sqft: z.number().int().positive().max(100_000).nullable().optional(),
  photoUrl: z.string().url().max(500).nullable().optional(),
  timezone: timezoneString.default('America/Chicago'),
  showingDurationMin: z.number().int().min(15).max(240).default(30),
  bufferMin: z.number().int().min(0).max(120).default(0),
  availableFrom: dateString.optional(), // defaults to today in the DB
  availableUntil: dateString.nullable().optional(),
  status: z.enum(['active', 'inactive']).default('active'),
};

const datesInOrder = (v: { availableFrom?: string; availableUntil?: string | null }) =>
  !v.availableFrom || !v.availableUntil || v.availableUntil >= v.availableFrom;

const datesMessage = { message: 'availableUntil must be on or after availableFrom', path: ['availableUntil'] };

// Create: listing + (optionally) its availability in one request, so the
// seller's form can save everything with a single "Publish" click.
export const createListingSchema = z
  .object({ ...listingFields, availability: availabilitySchema.optional() })
  .refine(datesInOrder, datesMessage);

// Update: every field optional (PATCH semantics). Defaults are removed so that
// omitting a field means "don't touch it", not "reset it to the default".
export const updateListingSchema = z
  .object({
    title: listingFields.title,
    description: z.string().trim().max(2000),
    address: listingFields.address,
    city: listingFields.city,
    priceCents: listingFields.priceCents,
    bedrooms: listingFields.bedrooms,
    bathrooms: listingFields.bathrooms,
    sqft: listingFields.sqft,
    photoUrl: listingFields.photoUrl,
    timezone: timezoneString,
    showingDurationMin: z.number().int().min(15).max(240),
    bufferMin: z.number().int().min(0).max(120),
    availableFrom: dateString,
    availableUntil: dateString.nullable(),
    status: z.enum(['active', 'inactive']),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update')
  .refine(datesInOrder, datesMessage);

export type AvailabilityInput = z.infer<typeof availabilitySchema>;
export type CreateListingInput = z.infer<typeof createListingSchema>;
export type UpdateListingInput = z.infer<typeof updateListingSchema>;
