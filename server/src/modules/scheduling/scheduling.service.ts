import { query } from '../../db/pool.js';
import { notFound } from '../../lib/errors.js';
import type { AuthUser } from '../auth/auth.types.js';
import { toListingDto } from '../listings/listings.service.js';
import { loadBuyerBusy, loadSchedules } from './schedule.repository.js';
import type { SearchInput } from './scheduling.schemas.js';
import { computeSlots, type TimeRange } from './slotEngine.js';

const MAX_SLOTS_PER_LISTING = 200;

const toSlotDto = (s: TimeRange) => ({ start: s.start.toISOString(), end: s.end.toISOString() });

function boundingRange(windows: TimeRange[]): TimeRange {
  return {
    start: new Date(Math.min(...windows.map((w) => w.start.getTime()))),
    end: new Date(Math.max(...windows.map((w) => w.end.getTime()))),
  };
}

// UTC date string with a +/- 1 day margin: a cheap SQL pre-filter on the listing date
// range that is always wide enough regardless of timezone. The engine does the exact check.
const utcDate = (d: Date, offsetDays: number) =>
  new Date(d.getTime() + offsetDays * 86_400_000).toISOString().slice(0, 10);

/**
 * Buyer search: "I'm free at these times, show me houses I can visit."
 *   1. SQL narrows down candidates with the cheap filters (city, price, beds, date range).
 *   2. The slot engine computes the real openings for each candidate.
 *   3. Houses with zero openings are dropped; the rest are sorted by earliest opening.
 */
export async function searchAvailableListings(user: AuthUser, input: SearchInput) {
  const range = boundingRange(input.windows);

  const { rows } = await query(
    `SELECT l.*, u.name AS seller_name
       FROM listings l JOIN users u ON u.id = l.seller_id
      WHERE l.status = 'active'
        AND ($1::text   IS NULL OR position(lower($1) IN lower(l.city)) > 0)
        AND ($2::bigint IS NULL OR l.price_cents >= $2)
        AND ($3::bigint IS NULL OR l.price_cents <= $3)
        AND ($4::int    IS NULL OR l.bedrooms >= $4)
        AND l.available_from <= $6::date
        AND (l.available_until IS NULL OR l.available_until >= $5::date)
        AND EXISTS (SELECT 1 FROM availability_rules r WHERE r.listing_id = l.id)`,
    [
      input.city || null,
      input.minPriceCents ?? null,
      input.maxPriceCents ?? null,
      input.minBedrooms ?? null,
      utcDate(range.start, -1),
      utcDate(range.end, 1),
    ],
  );

  const [schedules, buyerBusy] = await Promise.all([
    loadSchedules(rows, range),
    user.role === 'buyer' ? loadBuyerBusy(user.id, range) : Promise.resolve([]),
  ]);

  const now = new Date();
  const results = rows
    .map((row) => {
      const slots = computeSlots(schedules.get(row.id)!, { windows: input.windows, now, buyerBusy });
      return {
        listing: toListingDto(row),
        totalSlots: slots.length,
        slots: slots.slice(0, MAX_SLOTS_PER_LISTING).map(toSlotDto),
      };
    })
    .filter((r) => r.totalSlots > 0)
    .sort((a, b) => a.slots[0].start.localeCompare(b.slots[0].start));

  return results;
}

/** All openings of one listing in a date range (listing detail page). */
export async function getListingSlots(listingId: string, user: AuthUser, range: TimeRange) {
  const { rows } = await query(
    'SELECT * FROM listings WHERE id = $1 AND (status = $2 OR seller_id = $3)',
    [listingId, 'active', user.id],
  );
  if (!rows[0]) throw notFound('Listing not found');

  const [schedules, buyerBusy] = await Promise.all([
    loadSchedules(rows, range),
    user.role === 'buyer' ? loadBuyerBusy(user.id, range) : Promise.resolve([]),
  ]);

  const slots = computeSlots(schedules.get(listingId)!, { windows: [range], now: new Date(), buyerBusy });
  return slots.map(toSlotDto);
}
