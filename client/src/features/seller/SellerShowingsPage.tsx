import { ShowingsList } from '../showings/ShowingsList';

export function SellerShowingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Showings</h1>
        <p className="text-sm text-slate-500">Everyone who booked a visit to your homes.</p>
      </div>
      <ShowingsList role="seller" />
    </div>
  );
}
