import type { WeeklyRule } from '../../api/types';
import { Button, cx, Input } from '../../components/ui';
import { DAY_NAMES, WEEK_ORDER } from '../../lib/format';

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/**
 * Same rules the server enforces, run in the browser for instant feedback.
 * The server stays the source of truth: this only improves UX.
 * Returns an error message per day (dayOfWeek -> message).
 */
export function validateRules(rules: WeeklyRule[]): Record<number, string> {
  const errors: Record<number, string> = {};
  for (const day of WEEK_ORDER) {
    const ranges = rules
      .filter((r) => r.dayOfWeek === day)
      .map((r) => ({ start: toMinutes(r.startTime), end: toMinutes(r.endTime) }))
      .sort((a, b) => a.start - b.start);

    if (ranges.some((r) => Number.isNaN(r.start) || Number.isNaN(r.end))) errors[day] = 'Enter both times';
    else if (ranges.some((r) => r.end <= r.start)) errors[day] = 'End time must be after start time';
    else if (ranges.some((r, i) => i > 0 && r.start < ranges[i - 1].end)) errors[day] = 'Time ranges overlap';
  }
  return errors;
}

interface Props {
  rules: WeeklyRule[];
  onChange: (rules: WeeklyRule[]) => void;
  errors: Record<number, string>;
}

/**
 * Controlled component: the parent owns the rules array, this only renders it
 * and reports changes. Each rule keeps its index in the flat array so edits
 * don't need ids.
 */
export function WeeklyScheduleEditor({ rules, onChange, errors }: Props) {
  const indexed = rules.map((rule, index) => ({ rule, index }));

  const update = (index: number, patch: Partial<WeeklyRule>) =>
    onChange(rules.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  const remove = (index: number) => onChange(rules.filter((_, i) => i !== index));
  const add = (dayOfWeek: number, startTime = '09:00', endTime = '12:00') =>
    onChange([...rules, { dayOfWeek, startTime, endTime }]);
  const toggleDay = (day: number, enabled: boolean) =>
    enabled ? add(day, '09:00', '17:00') : onChange(rules.filter((r) => r.dayOfWeek !== day));

  const copyMondayToWeekdays = () => {
    const monday = rules.filter((r) => r.dayOfWeek === 1);
    const others = rules.filter((r) => ![2, 3, 4, 5].includes(r.dayOfWeek));
    const copies = [2, 3, 4, 5].flatMap((d) => monday.map((r) => ({ ...r, dayOfWeek: d })));
    onChange([...others, ...copies]);
  };

  return (
    <div>
      <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
        {WEEK_ORDER.map((day) => {
          const dayRules = indexed.filter(({ rule }) => rule.dayOfWeek === day);
          const enabled = dayRules.length > 0;
          const inputId = `day-${day}`;

          return (
            <div key={day} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start">
              <label htmlFor={inputId} className="flex w-36 shrink-0 cursor-pointer items-center gap-2 pt-2 text-sm font-medium">
                <input
                  id={inputId}
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => toggleDay(day, e.target.checked)}
                  className="size-4 accent-brand-600"
                />
                {DAY_NAMES[day]}
              </label>

              <div className="min-w-0 flex-1 space-y-2">
                {!enabled && <p className="pt-2 text-sm text-slate-400">No showings</p>}
                {dayRules.map(({ rule, index }) => (
                  <div key={index} className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] items-center gap-2 sm:max-w-md">
                    <Input
                      type="time"
                      step={900}
                      aria-label={`${DAY_NAMES[day]} start time`}
                      value={rule.startTime}
                      onChange={(e) => update(index, { startTime: e.target.value })}
                      className={cx('min-w-0', errors[day] && 'border-red-400')}
                    />
                    <span className="text-slate-400">–</span>
                    <Input
                      type="time"
                      step={900}
                      aria-label={`${DAY_NAMES[day]} end time`}
                      value={rule.endTime}
                      onChange={(e) => update(index, { endTime: e.target.value })}
                      className={cx('min-w-0', errors[day] && 'border-red-400')}
                    />
                    <Button variant="ghost" type="button" onClick={() => remove(index)} aria-label="Remove time range">
                      ✕
                    </Button>
                  </div>
                ))}
                {enabled && (
                  <button
                    type="button"
                    onClick={() => add(day, '14:00', '17:00')}
                    className="text-sm font-medium text-brand-600 hover:underline"
                  >
                    + Add hours
                  </button>
                )}
                {errors[day] && (
                  <p className="text-xs text-red-600" role="alert">
                    {errors[day]}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <Button type="button" variant="secondary" className="mt-3" onClick={copyMondayToWeekdays}>
        Copy Monday to Tue–Fri
      </Button>
    </div>
  );
}
