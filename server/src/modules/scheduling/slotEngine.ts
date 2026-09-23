import { DateTime } from 'luxon';

// =====================================================================
// Slot engine: the core of the app.
//
// PURE FUNCTIONS ONLY: no database, no Express, no Date.now().
// Everything comes in as arguments, so it's trivial to unit-test
// (including DST edge cases) and the same code is used to SEARCH
// slots and to VALIDATE a booking. One source of truth.
// =====================================================================

export interface TimeRange {
  start: Date;
  end: Date;
}

export interface WeeklyRule {
  dayOfWeek: number; // 0 = Sunday ... 6 = Saturday
  startTime: string; // "HH:MM", local to the house
  endTime: string;
}

export interface ListingSchedule {
  timezone: string; // IANA zone of the house
  durationMin: number;
  bufferMin: number; // minimum gap between two showings
  availableFrom: string; // YYYY-MM-DD, inclusive
  availableUntil: string | null; // YYYY-MM-DD, inclusive; null = open-ended
  rules: WeeklyRule[];
  blackoutDates: string[]; // YYYY-MM-DD
  booked: TimeRange[]; // confirmed showings of THIS listing
}

export interface SlotQuery {
  windows: TimeRange[]; // when the buyer is free (absolute instants)
  now: Date; // injected so tests control "the present"
  buyerBusy?: TimeRange[]; // the buyer's own showings (can't be in two houses at once)
}

const MINUTE = 60_000;

/** True if a and b overlap, treating `padMs` as extra required distance between them. */
export function overlaps(a: TimeRange, b: TimeRange, padMs = 0): boolean {
  return a.start.getTime() < b.end.getTime() + padMs && b.start.getTime() < a.end.getTime() + padMs;
}

/** "HH:MM" on a given local day -> absolute epoch millis (DST-aware thanks to Luxon). */
function atLocalTime(day: DateTime, hhmm: string): number {
  const [hour, minute] = hhmm.split(':').map(Number);
  return day.set({ hour, minute, second: 0, millisecond: 0 }).toMillis();
}

/**
 * Every bookable slot of a listing that fits entirely inside one of the buyer's windows.
 *
 * Steps:
 *  1. Walk each calendar day (in the HOUSE's timezone) touched by the buyer's windows.
 *  2. Skip days outside the listing's date range or on a blackout date.
 *  3. For each weekly rule of that weekday, cut the rule into fixed slots of `durationMin`.
 *  4. Keep a slot only if it: is in the future, fits a buyer window, doesn't collide with
 *     an existing showing (+ buffer), and doesn't collide with the buyer's own showings.
 */
export function computeSlots(schedule: ListingSchedule, query: SlotQuery): TimeRange[] {
  const zone = schedule.timezone;
  const durationMs = schedule.durationMin * MINUTE;
  const bufferMs = schedule.bufferMin * MINUTE;
  const blackouts = new Set(schedule.blackoutDates);
  const buyerBusy = query.buyerBusy ?? [];

  const rulesByDay = new Map<number, WeeklyRule[]>();
  for (const rule of schedule.rules) {
    rulesByDay.set(rule.dayOfWeek, [...(rulesByDay.get(rule.dayOfWeek) ?? []), rule]);
  }

  // Keyed by start time so overlapping buyer windows don't produce duplicates.
  const slots = new Map<number, TimeRange>();

  for (const window of query.windows) {
    let day = DateTime.fromJSDate(window.start, { zone }).startOf('day');
    const lastDay = DateTime.fromJSDate(window.end, { zone }).startOf('day');

    for (; day <= lastDay; day = day.plus({ days: 1 })) {
      const date = day.toISODate()!;
      if (date < schedule.availableFrom) continue;
      if (schedule.availableUntil && date > schedule.availableUntil) continue;
      if (blackouts.has(date)) continue;

      const dayOfWeek = day.weekday % 7; // Luxon: 1 = Monday ... 7 = Sunday -> 0 = Sunday

      for (const rule of rulesByDay.get(dayOfWeek) ?? []) {
        const ruleEnd = atLocalTime(day, rule.endTime);

        for (let start = atLocalTime(day, rule.startTime); start + durationMs <= ruleEnd; start += durationMs) {
          const slot: TimeRange = { start: new Date(start), end: new Date(start + durationMs) };

          const inFuture = start > query.now.getTime();
          const fitsWindow = start >= window.start.getTime() && start + durationMs <= window.end.getTime();
          const freeForHouse = !schedule.booked.some((b) => overlaps(slot, b, bufferMs));
          const freeForBuyer = !buyerBusy.some((b) => overlaps(slot, b));

          if (inFuture && fitsWindow && freeForHouse && freeForBuyer) slots.set(start, slot);
        }
      }
    }
  }

  return [...slots.values()].sort((a, b) => a.start.getTime() - b.start.getTime());
}

/**
 * Booking validation reuses the exact same logic: a start time is bookable
 * if and only if the engine would have offered it.
 */
export function isBookable(
  schedule: ListingSchedule,
  start: Date,
  ctx: { now: Date; buyerBusy?: TimeRange[] },
): boolean {
  const end = new Date(start.getTime() + schedule.durationMin * MINUTE);
  return computeSlots(schedule, { windows: [{ start, end }], ...ctx }).some(
    (s) => s.start.getTime() === start.getTime(),
  );
}
