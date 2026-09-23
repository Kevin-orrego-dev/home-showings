import { pool, type Db } from '../../db/pool.js';
import type { ListingSchedule, TimeRange } from './slotEngine.js';

// Loads everything the slot engine needs for MANY listings at once.
//
// Avoiding the N+1 problem: instead of "for each listing, query its rules,
// then its blackouts, then its showings" (1 + 3N queries), we run 3 queries
// total using `listing_id = ANY($1)` and group the rows in memory.

export interface ScheduleSource {
  id: string;
  timezone: string;
  showing_duration_min: number;
  buffer_min: number;
  available_from: string;
  available_until: string | null;
}

export async function loadSchedules(
  listings: ScheduleSource[],
  range: TimeRange,
  db: Db = pool,
): Promise<Map<string, ListingSchedule>> {
  const ids = listings.map((l) => l.id);
  const schedules = new Map<string, ListingSchedule>();
  if (ids.length === 0) return schedules;

  // Pad by a day: bookings just outside the range can still affect edge slots through the buffer.
  const from = new Date(range.start.getTime() - 86_400_000);
  const to = new Date(range.end.getTime() + 86_400_000);

  // Three independent queries. On the shared pool they run in parallel (3 connections);
  // inside a transaction there is only ONE connection, so they must run one after another.
  const queries = [
    () =>
      db.query<{ listing_id: string; day_of_week: number; start_time: string; end_time: string }>(
        `SELECT listing_id, day_of_week,
                to_char(start_time, 'HH24:MI') AS start_time, to_char(end_time, 'HH24:MI') AS end_time
           FROM availability_rules WHERE listing_id = ANY($1)`,
        [ids],
      ),
    () =>
      db.query<{ listing_id: string; date: string }>(
        'SELECT listing_id, date FROM blackout_dates WHERE listing_id = ANY($1)',
        [ids],
      ),
    () =>
      db.query<{ listing_id: string; starts_at: Date; ends_at: Date }>(
        `SELECT listing_id, starts_at, ends_at FROM showings
          WHERE listing_id = ANY($1) AND status = 'confirmed'
            AND starts_at < $3 AND ends_at > $2`,
        [ids, from, to],
      ),
  ] as const;
  const inTransaction = db !== pool;
  const [rules, blackouts, booked] = inTransaction
    ? [await queries[0](), await queries[1](), await queries[2]()]
    : await Promise.all([queries[0](), queries[1](), queries[2]()]);

  for (const l of listings) {
    schedules.set(l.id, {
      timezone: l.timezone,
      durationMin: l.showing_duration_min,
      bufferMin: l.buffer_min,
      availableFrom: l.available_from,
      availableUntil: l.available_until,
      rules: [],
      blackoutDates: [],
      booked: [],
    });
  }
  for (const r of rules.rows) {
    schedules.get(r.listing_id)!.rules.push({ dayOfWeek: r.day_of_week, startTime: r.start_time, endTime: r.end_time });
  }
  for (const b of blackouts.rows) schedules.get(b.listing_id)!.blackoutDates.push(b.date);
  for (const s of booked.rows) schedules.get(s.listing_id)!.booked.push({ start: s.starts_at, end: s.ends_at });

  return schedules;
}

// The buyer's own confirmed showings that could clash with the range.
export async function loadBuyerBusy(buyerId: string, range: TimeRange, db: Db = pool): Promise<TimeRange[]> {
  const { rows } = await db.query<{ starts_at: Date; ends_at: Date }>(
    `SELECT starts_at, ends_at FROM showings
      WHERE buyer_id = $1 AND status = 'confirmed' AND starts_at < $3 AND ends_at > $2`,
    [buyerId, range.start, range.end],
  );
  return rows.map((r) => ({ start: r.starts_at, end: r.ends_at }));
}
