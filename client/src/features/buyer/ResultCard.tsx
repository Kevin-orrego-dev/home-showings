import { useState } from 'react';
import type { SearchResult, Slot } from '../../api/types';
import { ListingPhoto } from '../../components/ListingPhoto';
import { Card } from '../../components/ui';
import { formatDay, formatPrice, formatTime, tzAbbreviation } from '../../lib/format';

const DAYS_COLLAPSED = 2;

/** One home + its open slots grouped by day (in the HOUSE's timezone). */
export function ResultCard({ result, onPick }: { result: SearchResult; onPick: (slot: Slot) => void }) {
  const { listing, slots, totalSlots } = result;
  const [expanded, setExpanded] = useState(false);

  const byDay = new Map<string, Slot[]>();
  for (const s of slots) {
    const day = formatDay(s.start, listing.timezone);
    byDay.set(day, [...(byDay.get(day) ?? []), s]);
  }
  const days = [...byDay.entries()];
  const visibleDays = expanded ? days : days.slice(0, DAYS_COLLAPSED);
  const tz = tzAbbreviation(new Date(slots[0].start), listing.timezone);

  return (
    <Card className="flex flex-col overflow-hidden md:flex-row">
      <ListingPhoto url={listing.photoUrl} title={listing.title} className="h-40 w-full md:h-auto md:w-56 md:shrink-0" />
      <div className="min-w-0 flex-1 space-y-3 p-4 sm:p-5">
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold text-slate-900">{listing.title}</h2>
            <p className="text-lg font-semibold text-slate-900">{formatPrice(listing.priceCents)}</p>
          </div>
          <p className="text-sm text-slate-500">
            {listing.address}, {listing.city} · {listing.bedrooms} bd · {listing.bathrooms} ba
            {listing.sqft ? ` · ${listing.sqft.toLocaleString('en-US')} sqft` : ''}
          </p>
          {listing.description && <p className="mt-2 line-clamp-2 text-sm text-slate-600">{listing.description}</p>}
        </div>

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
            {totalSlots} open {totalSlots === 1 ? 'time' : 'times'} · {listing.showingDurationMin} min · times in {tz}
          </p>
          <div className="space-y-2">
            {visibleDays.map(([day, daySlots]) => (
              <div key={day} className="flex flex-col gap-2 sm:flex-row sm:items-start">
                <span className="shrink-0 pt-1 text-sm font-medium whitespace-nowrap text-slate-700 sm:w-24">{day}</span>
                <div className="flex flex-wrap gap-1.5">
                  {daySlots.map((s) => (
                    <button
                      key={s.start}
                      type="button"
                      onClick={() => onPick(s)}
                      className="rounded-md border border-brand-100 bg-brand-50 px-2.5 py-1 text-sm font-medium text-brand-700 hover:border-brand-500 hover:bg-brand-100"
                    >
                      {formatTime(s.start, listing.timezone)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {days.length > DAYS_COLLAPSED && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-2 text-sm font-medium text-brand-600 hover:underline"
            >
              {expanded ? 'Show fewer days' : `Show ${days.length - DAYS_COLLAPSED} more day${days.length - DAYS_COLLAPSED > 1 ? 's' : ''}`}
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}
