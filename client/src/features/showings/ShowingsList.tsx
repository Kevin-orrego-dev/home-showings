import { useState } from 'react';
import { errorMessage } from '../../api/client';
import { showingsApi } from '../../api/endpoints';
import type { Role, Showing } from '../../api/types';
import { Alert, Badge, Button, Card, cx, EmptyState, Spinner } from '../../components/ui';
import { useApi } from '../../hooks/useApi';
import { formatSlotRange, localTimeHint } from '../../lib/format';

type Scope = 'upcoming' | 'past';

/**
 * Shared by both sides. The API already returns only what each user may see
 * (buyer: their bookings, seller: bookings on their homes); the component only
 * changes what it highlights: the seller sees WHO is coming, the buyer sees WHERE.
 */
export function ShowingsList({ role }: { role: Role }) {
  const [scope, setScope] = useState<Scope>('upcoming');
  const { data: showings, loading, error, refetch } = useApi(() => showingsApi.list(scope), [scope]);
  const [actionError, setActionError] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div role="tablist" className="inline-flex rounded-lg bg-slate-100 p-1">
        {(['upcoming', 'past'] as const).map((s) => (
          <button
            key={s}
            role="tab"
            aria-selected={scope === s}
            onClick={() => setScope(s)}
            className={cx(
              'rounded-md px-4 py-1.5 text-sm font-medium capitalize',
              scope === s ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700',
            )}
          >
            {s}
          </button>
        ))}
      </div>

      {(error || actionError) && <Alert>{error ?? actionError}</Alert>}

      {loading && !showings ? (
        <Spinner fullPage />
      ) : showings?.length === 0 ? (
        <EmptyState title={scope === 'upcoming' ? 'No upcoming showings' : 'No past showings'}>
          {role === 'buyer' && scope === 'upcoming' && 'Search for homes and book a visit that fits your schedule.'}
          {role === 'seller' && scope === 'upcoming' && 'When buyers book a visit, it will show up here.'}
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {showings?.map((s) => (
            <ShowingItem
              key={s.id}
              showing={s}
              role={role}
              canCancel={scope === 'upcoming'}
              onCancelled={refetch}
              onError={setActionError}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function ShowingItem({
  showing,
  role,
  canCancel,
  onCancelled,
  onError,
}: {
  showing: Showing;
  role: Role;
  canCancel: boolean;
  onCancelled: () => void;
  onError: (msg: string | null) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const cancelled = showing.status === 'cancelled';
  const hint = localTimeHint(showing.startsAt, showing.listing.timezone);

  const cancel = async () => {
    setBusy(true);
    onError(null);
    try {
      await showingsApi.cancel(showing.id);
      onCancelled();
    } catch (err) {
      onError(errorMessage(err));
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <li>
      <Card className={cx('flex flex-col gap-3 p-4 sm:flex-row sm:items-center', cancelled && 'opacity-60')}>
        <div className="flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className={cx('font-semibold text-slate-900', cancelled && 'line-through')}>
              {formatSlotRange(showing.startsAt, showing.endsAt, showing.listing.timezone)}
            </p>
            {cancelled ? (
              <Badge tone="red">Cancelled{showing.cancelledBy ? ` by ${showing.cancelledBy === role ? 'you' : showing.cancelledBy}` : ''}</Badge>
            ) : (
              <Badge tone="green">Confirmed</Badge>
            )}
          </div>
          {hint && <p className="text-xs text-slate-500">{hint}</p>}
          <p className="text-sm text-slate-700">
            {showing.listing.title} · <span className="text-slate-500">{showing.listing.address}, {showing.listing.city}</span>
          </p>
          {role === 'seller' ? (
            <p className="text-sm text-slate-600">
              Buyer: <span className="font-medium">{showing.buyer.name}</span> ·{' '}
              <a href={`mailto:${showing.buyer.email}`} className="text-brand-600 hover:underline">
                {showing.buyer.email}
              </a>
            </p>
          ) : (
            <p className="text-sm text-slate-600">Hosted by {showing.listing.sellerName}</p>
          )}
          {showing.notes && <p className="text-sm italic text-slate-500">“{showing.notes}”</p>}
        </div>

        {canCancel && !cancelled && (
          <div className="flex gap-2">
            {confirming ? (
              <>
                <Button variant="danger" loading={busy} onClick={cancel}>
                  Yes, cancel
                </Button>
                <Button variant="ghost" onClick={() => setConfirming(false)}>
                  Keep
                </Button>
              </>
            ) : (
              <Button variant="secondary" onClick={() => setConfirming(true)}>
                Cancel showing
              </Button>
            )}
          </div>
        )}
      </Card>
    </li>
  );
}
