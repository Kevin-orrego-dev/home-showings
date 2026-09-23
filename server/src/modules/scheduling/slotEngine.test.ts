import { describe, expect, it } from 'vitest';
import { computeSlots, isBookable, type ListingSchedule, type TimeRange } from './slotEngine.js';

// Helpers ---------------------------------------------------------------
const range = (start: string, end: string): TimeRange => ({ start: new Date(start), end: new Date(end) });
const starts = (slots: TimeRange[]) => slots.map((s) => s.start.toISOString());

// 2026-09-26 is a Saturday. Austin (America/Chicago) is UTC-5 in September (CDT).
const NOW = new Date('2026-09-20T12:00:00Z');

const base: ListingSchedule = {
  timezone: 'America/Chicago',
  durationMin: 30,
  bufferMin: 0,
  availableFrom: '2026-09-01',
  availableUntil: null,
  rules: [{ dayOfWeek: 6, startTime: '10:00', endTime: '12:00' }], // Saturdays 10-12 local
  blackoutDates: [],
  booked: [],
};

// Buyer free all Saturday (UTC day covers 10-12 CDT = 15:00-17:00 UTC).
const SATURDAY = range('2026-09-26T00:00:00Z', '2026-09-27T00:00:00Z');

describe('computeSlots', () => {
  it('cuts a weekly rule into fixed slots, in the house timezone', () => {
    const slots = computeSlots(base, { windows: [SATURDAY], now: NOW });
    expect(starts(slots)).toEqual([
      '2026-09-26T15:00:00.000Z', // 10:00 CDT
      '2026-09-26T15:30:00.000Z',
      '2026-09-26T16:00:00.000Z',
      '2026-09-26T16:30:00.000Z', // 11:30 CDT, ends exactly at 12:00
    ]);
  });

  it('only returns slots that fit entirely inside the buyer window', () => {
    // Buyer free 10:15-11:30 local -> only 10:30 and 11:00 fit completely.
    const slots = computeSlots(base, { windows: [range('2026-09-26T15:15:00Z', '2026-09-26T16:30:00Z')], now: NOW });
    expect(starts(slots)).toEqual(['2026-09-26T15:30:00.000Z', '2026-09-26T16:00:00.000Z']);
  });

  it('does not duplicate slots when buyer windows overlap', () => {
    const slots = computeSlots(base, { windows: [SATURDAY, range('2026-09-26T15:00:00Z', '2026-09-26T16:00:00Z')], now: NOW });
    expect(slots).toHaveLength(4);
  });

  it('skips blackout dates', () => {
    const slots = computeSlots({ ...base, blackoutDates: ['2026-09-26'] }, { windows: [SATURDAY], now: NOW });
    expect(slots).toHaveLength(0);
  });

  it('respects the listing date range', () => {
    expect(computeSlots({ ...base, availableFrom: '2026-09-27' }, { windows: [SATURDAY], now: NOW })).toHaveLength(0);
    expect(computeSlots({ ...base, availableUntil: '2026-09-25' }, { windows: [SATURDAY], now: NOW })).toHaveLength(0);
    expect(computeSlots({ ...base, availableUntil: '2026-09-26' }, { windows: [SATURDAY], now: NOW })).toHaveLength(4);
  });

  it('never offers slots in the past', () => {
    const slots = computeSlots(base, { windows: [SATURDAY], now: new Date('2026-09-26T15:45:00Z') });
    expect(starts(slots)).toEqual(['2026-09-26T16:00:00.000Z', '2026-09-26T16:30:00.000Z']);
  });

  it('removes slots that collide with an existing showing', () => {
    const booked = [range('2026-09-26T15:30:00Z', '2026-09-26T16:00:00Z')]; // 10:30-11:00 taken
    const slots = computeSlots({ ...base, booked }, { windows: [SATURDAY], now: NOW });
    expect(starts(slots)).toEqual(['2026-09-26T15:00:00.000Z', '2026-09-26T16:00:00.000Z', '2026-09-26T16:30:00.000Z']);
  });

  it('keeps the seller buffer free around existing showings', () => {
    // 10:30-11:00 taken + 15 min buffer -> 10:00 (ends 10:30, gap 0) and 11:00 (gap 0) are gone too.
    const booked = [range('2026-09-26T15:30:00Z', '2026-09-26T16:00:00Z')];
    const slots = computeSlots({ ...base, booked, bufferMin: 15 }, { windows: [SATURDAY], now: NOW });
    expect(starts(slots)).toEqual(['2026-09-26T16:30:00.000Z']);
  });

  it("excludes times when the buyer already has another showing", () => {
    const buyerBusy = [range('2026-09-26T15:00:00Z', '2026-09-26T15:45:00Z')];
    const slots = computeSlots(base, { windows: [SATURDAY], now: NOW, buyerBusy });
    expect(starts(slots)).toEqual(['2026-09-26T16:00:00.000Z', '2026-09-26T16:30:00.000Z']);
  });

  it('handles daylight saving time changes', () => {
    // DST ends in the US on Sunday 2026-11-01: Chicago goes from UTC-5 to UTC-6.
    // "10:00 local" must be 15:00Z on Saturday but 16:00Z on Sunday.
    const schedule: ListingSchedule = {
      ...base,
      rules: [
        { dayOfWeek: 6, startTime: '10:00', endTime: '10:30' },
        { dayOfWeek: 0, startTime: '10:00', endTime: '10:30' },
      ],
    };
    const slots = computeSlots(schedule, { windows: [range('2026-10-31T00:00:00Z', '2026-11-02T00:00:00Z')], now: NOW });
    expect(starts(slots)).toEqual(['2026-10-31T15:00:00.000Z', '2026-11-01T16:00:00.000Z']);
  });

  it('works when the buyer is in a different timezone than the house', () => {
    // Buyer in Bogotá (UTC-5 all year) free Saturday 09:00-11:00 their time = 14:00-16:00Z
    // = 09:00-11:00 in Austin during CDT -> slots 10:00, 10:30 house time.
    const slots = computeSlots(base, { windows: [range('2026-09-26T09:00:00-05:00', '2026-09-26T11:00:00-05:00')], now: NOW });
    expect(starts(slots)).toEqual(['2026-09-26T15:00:00.000Z', '2026-09-26T15:30:00.000Z']);
  });
});

describe('isBookable', () => {
  it('accepts a start time the engine would offer', () => {
    expect(isBookable(base, new Date('2026-09-26T15:30:00Z'), { now: NOW })).toBe(true);
  });

  it('rejects times not aligned to the slot grid, outside the rules, or taken', () => {
    expect(isBookable(base, new Date('2026-09-26T15:10:00Z'), { now: NOW })).toBe(false); // 10:10, off-grid
    expect(isBookable(base, new Date('2026-09-26T18:00:00Z'), { now: NOW })).toBe(false); // 13:00, outside rule
    const booked = [range('2026-09-26T15:30:00Z', '2026-09-26T16:00:00Z')];
    expect(isBookable({ ...base, booked }, new Date('2026-09-26T15:30:00Z'), { now: NOW })).toBe(false);
  });
});
