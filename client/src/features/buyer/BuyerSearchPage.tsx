import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { errorMessage } from '../../api/client';
import { searchApi, type SearchInput } from '../../api/endpoints';
import type { Listing, SearchResult, Showing, Slot } from '../../api/types';
import { Alert, Button, Card, EmptyState, Field, Input, Select, Spinner } from '../../components/ui';
import { formatSlotRange } from '../../lib/format';
import { AvailabilityPicker, PRESETS, toApiWindows, validateWindows, type TimeWindow } from './AvailabilityPicker';
import { BookingDialog } from './BookingDialog';
import { ResultCard } from './ResultCard';

const PRICE_OPTIONS = [300_000, 400_000, 500_000, 600_000, 750_000, 1_000_000];

export function BuyerSearchPage() {
  // Start with "This weekend" so the page shows real results immediately.
  const [windows, setWindows] = useState<TimeWindow[]>(() => PRESETS[0].build());
  const [city, setCity] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minBeds, setMinBeds] = useState('');

  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastQuery, setLastQuery] = useState<SearchInput | null>(null);

  const [picked, setPicked] = useState<{ listing: Listing; slot: Slot } | null>(null);
  const [booked, setBooked] = useState<Showing | null>(null);

  const runSearch = useCallback(async (query: SearchInput) => {
    setLoading(true);
    setError(null);
    try {
      setResults(await searchApi.search(query));
      setLastQuery(query);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const buildQuery = (): SearchInput => ({
    windows: toApiWindows(windows),
    city: city.trim() || undefined,
    maxPriceCents: maxPrice ? Number(maxPrice) * 100 : undefined,
    minBedrooms: minBeds ? Number(minBeds) : undefined,
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setBooked(null);
    const problem = validateWindows(windows);
    if (problem) {
      setError(problem);
      return;
    }
    runSearch(buildQuery());
  };

  // First search on page load with the default preset.
  useEffect(() => {
    runSearch(buildQuery());
  }, []); // intentionally once, on mount

  // After booking (or a 409), search again with the SAME query so the taken slot disappears.
  const refresh = () => lastQuery && runSearch(lastQuery);

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <aside>
        <Card className="p-5 lg:sticky lg:top-6">
          <form onSubmit={onSubmit} className="space-y-5" noValidate>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">When are you free?</h1>
              <p className="mt-1 text-sm text-slate-500">We'll only show homes you can actually visit.</p>
            </div>

            <AvailabilityPicker windows={windows} onChange={setWindows} />

            <div className="space-y-3 border-t border-slate-100 pt-4">
              <Field label="City" htmlFor="city">
                <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Any city" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Max price" htmlFor="maxPrice">
                  <Select id="maxPrice" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)}>
                    <option value="">No max</option>
                    {PRICE_OPTIONS.map((p) => (
                      <option key={p} value={p}>
                        ${p.toLocaleString()}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Bedrooms" htmlFor="minBeds">
                  <Select id="minBeds" value={minBeds} onChange={(e) => setMinBeds(e.target.value)}>
                    <option value="">Any</option>
                    {[1, 2, 3, 4].map((n) => (
                      <option key={n} value={n}>
                        {n}+
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            </div>

            <Button type="submit" className="w-full" loading={loading}>
              Find homes
            </Button>
          </form>
        </Card>
      </aside>

      <section className="space-y-4" aria-live="polite">
        {booked && (
          <Alert tone="success">
            Booked! {booked.listing.title} on{' '}
            <strong>{formatSlotRange(booked.startsAt, booked.endsAt, booked.listing.timezone)}</strong>.{' '}
            <Link to="/buyer/showings" className="font-medium underline">
              See my showings
            </Link>
          </Alert>
        )}
        {error && <Alert>{error}</Alert>}

        {results === null && loading ? (
          <Spinner fullPage />
        ) : results?.length === 0 ? (
          <EmptyState title="No homes have open showings at those times">
            Try adding more times, a different day, or removing some filters.
          </EmptyState>
        ) : (
          results && (
            <>
              <p className="text-sm text-slate-500">
                {results.length} {results.length === 1 ? 'home' : 'homes'} with openings that fit your schedule
              </p>
              {results.map((r) => (
                <ResultCard key={r.listing.id} result={r} onPick={(slot) => setPicked({ listing: r.listing, slot })} />
              ))}
            </>
          )
        )}
      </section>

      {picked && (
        <BookingDialog
          listing={picked.listing}
          slot={picked.slot}
          onClose={() => setPicked(null)}
          onBooked={(showing) => {
            setPicked(null);
            setBooked(showing);
            refresh();
          }}
          onSlotGone={refresh}
        />
      )}
    </div>
  );
}
