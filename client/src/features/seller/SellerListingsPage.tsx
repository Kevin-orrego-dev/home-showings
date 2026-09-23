import { useState } from 'react';
import { Link } from 'react-router';
import { errorMessage } from '../../api/client';
import { listingsApi } from '../../api/endpoints';
import type { MyListing } from '../../api/types';
import { ListingPhoto } from '../../components/ListingPhoto';
import { Alert, Badge, Button, Card, EmptyState, Spinner } from '../../components/ui';
import { useApi } from '../../hooks/useApi';
import { formatPrice } from '../../lib/format';

export function SellerListingsPage() {
  const { data: listings, loading, error, refetch } = useApi(() => listingsApi.mine(), []);
  const [actionError, setActionError] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">My listings</h1>
          <p className="text-sm text-slate-500">Manage your homes and when buyers can visit them.</p>
        </div>
        <Link to="/seller/listings/new">
          <Button>+ New listing</Button>
        </Link>
      </div>

      {(error || actionError) && <Alert>{error ?? actionError}</Alert>}

      {loading && !listings ? (
        <Spinner fullPage />
      ) : listings?.length === 0 ? (
        <EmptyState title="You haven't listed a home yet">
          <Link to="/seller/listings/new" className="font-medium text-brand-600 hover:underline">
            Create your first listing
          </Link>{' '}
          and set the hours buyers can visit.
        </EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {listings?.map((l) => (
            <ListingCard key={l.id} listing={l} onChanged={refetch} onError={setActionError} />
          ))}
        </div>
      )}
    </div>
  );
}

function ListingCard({
  listing,
  onChanged,
  onError,
}: {
  listing: MyListing;
  onChanged: () => void;
  onError: (msg: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  // Two-step delete (click, then confirm) instead of window.confirm: no blocking browser dialog.
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    onError(null);
    try {
      await action();
      onChanged();
    } catch (err) {
      onError(errorMessage(err));
    } finally {
      setBusy(false);
      setConfirmingDelete(false);
    }
  };

  const active = listing.status === 'active';

  return (
    <Card className="flex flex-col overflow-hidden">
      <ListingPhoto url={listing.photoUrl} title={listing.title} className="h-36 w-full" />
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-semibold leading-snug text-slate-900">{listing.title}</h2>
          <Badge tone={active ? 'green' : 'slate'}>{active ? 'Active' : 'Inactive'}</Badge>
        </div>
        <p className="text-sm text-slate-500">
          {listing.address}, {listing.city}
        </p>
        <p className="text-sm text-slate-700">
          <span className="font-semibold">{formatPrice(listing.priceCents)}</span> · {listing.bedrooms} bd ·{' '}
          {listing.bathrooms} ba
        </p>
        <Link
          to="/seller/showings"
          className="text-sm font-medium text-brand-700 hover:underline"
        >
          {listing.upcomingShowings === 0
            ? 'No upcoming showings'
            : `${listing.upcomingShowings} upcoming showing${listing.upcomingShowings > 1 ? 's' : ''} →`}
        </Link>

        <div className="mt-auto flex flex-wrap gap-2 pt-2">
          <Link to={`/seller/listings/${listing.id}/edit`}>
            <Button variant="secondary">Edit</Button>
          </Link>
          <Button
            variant="secondary"
            loading={busy && !confirmingDelete}
            onClick={() => run(() => listingsApi.update(listing.id, { status: active ? 'inactive' : 'active' }))}
          >
            {active ? 'Deactivate' : 'Activate'}
          </Button>
          {confirmingDelete ? (
            <>
              <Button variant="danger" loading={busy} onClick={() => run(() => listingsApi.remove(listing.id))}>
                Confirm delete
              </Button>
              <Button variant="ghost" onClick={() => setConfirmingDelete(false)}>
                Keep
              </Button>
            </>
          ) : (
            <Button variant="danger" onClick={() => setConfirmingDelete(true)}>
              Delete
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
