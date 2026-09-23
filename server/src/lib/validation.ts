import { z } from 'zod';

// Reusable zod building blocks shared by several modules.

// Validating route params stops junk like /listings/abc from reaching Postgres
// (which would throw "invalid input syntax for type uuid" -> a 500 instead of a 400).
export const idParamSchema = z.object({ id: z.string().uuid('Invalid id') });

// "HH:MM", 24h clock.
export const timeString = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be HH:MM (24h)');

// "YYYY-MM-DD" that is also a real calendar date (rejects 2026-02-30).
export const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s);
  }, 'Invalid calendar date');

// IANA timezone like "America/Chicago". Intl throws on unknown zones.
export const timezoneString = z.string().refine((tz) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}, 'Unknown timezone');

// "09:30" -> 570. Lets us compare times as plain numbers.
export const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
