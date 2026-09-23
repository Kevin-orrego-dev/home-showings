import { useState } from 'react';
import type { BlackoutDate } from '../../api/types';
import { Button, Input } from '../../components/ui';
import { formatDate, todayYmd } from '../../lib/format';

interface Props {
  value: BlackoutDate[];
  onChange: (value: BlackoutDate[]) => void;
}

/** Specific days the house can't be shown (seller traveling, holiday...). */
export function BlackoutDatesEditor({ value, onChange }: Props) {
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');

  const add = () => {
    if (!date || value.some((b) => b.date === date)) return;
    onChange([...value, { date, reason: reason.trim() || undefined }].sort((a, b) => a.date.localeCompare(b.date)));
    setDate('');
    setReason('');
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-full sm:w-auto">
          <label htmlFor="blackout-date" className="mb-1 block text-xs text-slate-500">
            Date
          </label>
          <Input id="blackout-date" type="date" min={todayYmd()} value={date} onChange={(e) => setDate(e.target.value)} className="w-full sm:w-48" />
        </div>
        <div className="min-w-48 flex-1">
          <label htmlFor="blackout-reason" className="mb-1 block text-xs text-slate-500">
            Reason (optional, only you see it)
          </label>
          <Input id="blackout-reason" value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Out of town" />
        </div>
        <Button type="button" variant="secondary" onClick={add} disabled={!date}>
          Block date
        </Button>
      </div>

      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {value.map((b) => (
            <li key={b.date} className="flex items-center gap-2 rounded-full bg-slate-100 py-1 pl-3 pr-1 text-sm">
              <span>
                {formatDate(b.date)}
                {b.reason && <span className="text-slate-500"> · {b.reason}</span>}
              </span>
              <button
                type="button"
                onClick={() => onChange(value.filter((x) => x.date !== b.date))}
                className="rounded-full px-2 text-slate-500 hover:bg-slate-200"
                aria-label={`Unblock ${b.date}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
