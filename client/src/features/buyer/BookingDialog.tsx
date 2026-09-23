import { useEffect, useRef, useState } from 'react';
import { ApiError, errorMessage } from '../../api/client';
import { showingsApi } from '../../api/endpoints';
import type { Listing, Showing, Slot } from '../../api/types';
import { Alert, Button } from '../../components/ui';
import { formatSlotRange, localTimeHint } from '../../lib/format';

interface Props {
  listing: Listing;
  slot: Slot;
  onClose: () => void;
  onBooked: (showing: Showing) => void;
  onSlotGone: () => void; // someone else took it: parent refreshes the results
}

/** Confirmation step before booking: a mis-click on a time chip must not create a booking. */
export function BookingDialog({ listing, slot, onClose, onBooked, onSlotGone }: Props) {
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);

  // Accessibility: focus the main action once when the dialog opens...
  useEffect(() => {
    confirmRef.current?.focus();
  }, []);

  // ...and close on Escape. The latest onClose is kept in a ref so the listener
  // doesn't need re-attaching every time the parent re-renders.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCloseRef.current();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const hint = localTimeHint(slot.start, listing.timezone);

  const confirm = async () => {
    setBooking(true);
    setError(null);
    try {
      onBooked(await showingsApi.book(listing.id, slot.start, notes.trim() || undefined));
    } catch (err) {
      setError(errorMessage(err));
      // 409 = the slot was taken between loading results and clicking "confirm".
      if (err instanceof ApiError && err.status === 409) onSlotGone();
    } finally {
      setBooking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-title"
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="booking-title" className="text-lg font-semibold text-slate-900">
          Confirm your showing
        </h2>
        <div className="mt-4 space-y-1 rounded-lg bg-slate-50 p-4 text-sm">
          <p className="font-medium text-slate-900">{listing.title}</p>
          <p className="text-slate-500">
            {listing.address}, {listing.city}
          </p>
          <p className="pt-2 font-semibold text-brand-700">{formatSlotRange(slot.start, slot.end, listing.timezone)}</p>
          {hint && <p className="text-xs text-slate-500">That's {hint}.</p>}
          <p className="text-xs text-slate-500">
            {listing.showingDurationMin}-minute visit hosted by {listing.sellerName}
          </p>
        </div>

        <label htmlFor="notes" className="mt-4 mb-1 block text-sm font-medium text-slate-700">
          Note for the seller <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <textarea
          id="notes"
          rows={2}
          maxLength={500}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. We'll bring our inspector"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />

        {error && (
          <div className="mt-3">
            <Alert>{error}</Alert>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {error ? 'Close' : 'Back'}
          </Button>
          {!error && (
            <Button ref={confirmRef} loading={booking} onClick={confirm}>
              Book showing
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
