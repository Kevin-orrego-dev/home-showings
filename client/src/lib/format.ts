// Formatting helpers. All built on Intl (native, zero dependencies, handles
// timezones and DST correctly), so the UI doesn't need a date library.

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Week order shown in the UI: Monday first (common for schedules). */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export const BROWSER_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

export function formatPrice(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
    cents / 100,
  );
}

/** "2026-09-26" -> "Sat, Sep 26, 2026". Parsed as UTC so the day never shifts. */
export function formatDate(ymd: string) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${ymd}T00:00:00Z`));
}

/** Short timezone name for an instant in a zone, e.g. "CDT", "GMT-5". */
function tzAbbreviation(date: Date, timeZone: string) {
  return (
    new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'short' })
      .formatToParts(date)
      .find((p) => p.type === 'timeZoneName')?.value ?? ''
  );
}

export function formatTime(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone }).format(new Date(iso));
}

/** "Sat, Sep 26" in the given zone. */
export function formatDay(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone }).format(
    new Date(iso),
  );
}

/** "Sat, Sep 26 · 10:00 AM – 10:30 AM CDT" — always in the HOUSE's timezone. */
export function formatSlotRange(startIso: string, endIso: string, timeZone: string) {
  return `${formatDay(startIso, timeZone)} · ${formatTime(startIso, timeZone)} – ${formatTime(endIso, timeZone)} ${tzAbbreviation(new Date(startIso), timeZone)}`;
}

/**
 * If the viewer is in another timezone than the house, a hint in THEIR time:
 * "9:00 AM your time". Returns null when both zones show the same clock time.
 */
export function localTimeHint(iso: string, houseTimeZone: string) {
  const house = formatTime(iso, houseTimeZone);
  const local = formatTime(iso, BROWSER_TIMEZONE);
  return house === local ? null : `${local} your time`;
}

/** Today's date in the browser's timezone as YYYY-MM-DD. */
export function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern (New York)' },
  { value: 'America/Chicago', label: 'Central (Chicago / Austin)' },
  { value: 'America/Denver', label: 'Mountain (Denver)' },
  { value: 'America/Phoenix', label: 'Arizona (Phoenix)' },
  { value: 'America/Los_Angeles', label: 'Pacific (Los Angeles)' },
  { value: 'America/Anchorage', label: 'Alaska (Anchorage)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii (Honolulu)' },
  { value: 'America/Bogota', label: 'Colombia (Bogotá)' },
];
