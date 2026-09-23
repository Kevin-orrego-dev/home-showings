import { Button, cx, Input } from '../../components/ui';
import { addDaysYmd, BROWSER_TIMEZONE, dayOfWeekYmd, localToIso, todayYmd } from '../../lib/format';

export interface TimeWindow {
  id: number;
  date: string; // YYYY-MM-DD, buyer's local calendar
  start: string; // HH:MM, buyer's local time
  end: string;
}

let nextId = 1;
export const newWindow = (date: string, start: string, end: string): TimeWindow => ({ id: nextId++, date, start, end });

// Quick presets: most people think "this weekend" or "weekday evenings",
// not in individual date/time pairs.
function nextSaturday() {
  const today = todayYmd();
  return addDaysYmd(today, (6 - dayOfWeekYmd(today) + 7) % 7);
}

export const PRESETS: { label: string; build: () => TimeWindow[] }[] = [
  {
    label: 'This weekend',
    build: () => {
      const sat = nextSaturday();
      return [newWindow(sat, '09:00', '17:00'), newWindow(addDaysYmd(sat, 1), '10:00', '17:00')];
    },
  },
  {
    label: 'Weekday evenings',
    build: () => {
      const days: TimeWindow[] = [];
      for (let i = 1; days.length < 5; i++) {
        const d = addDaysYmd(todayYmd(), i);
        const dow = dayOfWeekYmd(d);
        if (dow >= 1 && dow <= 5) days.push(newWindow(d, '17:00', '20:00'));
      }
      return days;
    },
  },
  {
    label: 'Next 7 days, all day',
    build: () => Array.from({ length: 7 }, (_, i) => newWindow(addDaysYmd(todayYmd(), i + 1), '08:00', '20:00')),
  },
];

/** Same limits the API enforces (10 windows, 31-day span), checked up front. */
export function validateWindows(windows: TimeWindow[]): string | null {
  if (windows.length === 0) return 'Add at least one time when you are free.';
  if (windows.length > 10) return 'You can add up to 10 time windows.';
  for (const w of windows) {
    if (!w.date || !w.start || !w.end) return 'Complete the date and both times of every window.';
    if (w.end <= w.start) return 'Each window must end after it starts.';
  }
  const iso = windows.flatMap((w) => [localToIso(w.date, w.start), localToIso(w.date, w.end)]).sort();
  if (new Date(iso[iso.length - 1]).getTime() - new Date(iso[0]).getTime() > 31 * 86_400_000) {
    return 'Your availability can span at most 31 days.';
  }
  if (new Date(iso[iso.length - 1]) <= new Date()) return 'Pick times in the future.';
  return null;
}

export const toApiWindows = (windows: TimeWindow[]) =>
  windows.map((w) => ({ start: localToIso(w.date, w.start), end: localToIso(w.date, w.end) }));

interface Props {
  windows: TimeWindow[];
  onChange: (windows: TimeWindow[]) => void;
}

export function AvailabilityPicker({ windows, onChange }: Props) {
  const update = (id: number, patch: Partial<TimeWindow>) =>
    onChange(windows.map((w) => (w.id === id ? { ...w, ...patch } : w)));

  const addWindow = () => {
    const last = windows[windows.length - 1];
    const date = last ? addDaysYmd(last.date, 1) : addDaysYmd(todayYmd(), 1);
    onChange([...windows, newWindow(date, last?.start ?? '09:00', last?.end ?? '12:00')]);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => onChange(p.build())}
            className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:border-brand-500 hover:text-brand-700"
          >
            {p.label}
          </button>
        ))}
      </div>

      <ul className="space-y-2">
        {windows.map((w, i) => (
          <li key={w.id} className="flex items-center gap-2">
            <Input
              type="date"
              aria-label={`Window ${i + 1} date`}
              min={todayYmd()}
              value={w.date}
              onChange={(e) => update(w.id, { date: e.target.value })}
              className="w-40"
            />
            <Input
              type="time"
              step={900}
              aria-label={`Window ${i + 1} from`}
              value={w.start}
              onChange={(e) => update(w.id, { start: e.target.value })}
              className={cx('w-28', w.end <= w.start && 'border-red-400')}
            />
            <span className="text-slate-400">–</span>
            <Input
              type="time"
              step={900}
              aria-label={`Window ${i + 1} to`}
              value={w.end}
              onChange={(e) => update(w.id, { end: e.target.value })}
              className={cx('w-28', w.end <= w.start && 'border-red-400')}
            />
            <Button
              type="button"
              variant="ghost"
              aria-label={`Remove window ${i + 1}`}
              onClick={() => onChange(windows.filter((x) => x.id !== w.id))}
            >
              ✕
            </Button>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between">
        <button type="button" onClick={addWindow} className="text-sm font-medium text-brand-600 hover:underline" disabled={windows.length >= 10}>
          + Add another time
        </button>
        <span className="text-xs text-slate-400">Times in your timezone ({BROWSER_TIMEZONE})</span>
      </div>
    </div>
  );
}
