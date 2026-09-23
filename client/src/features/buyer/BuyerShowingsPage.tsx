import { Link } from 'react-router';
import { Button } from '../../components/ui';
import { ShowingsList } from '../showings/ShowingsList';

export function BuyerShowingsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">My showings</h1>
          <p className="text-sm text-slate-500">Your booked home visits.</p>
        </div>
        <Link to="/buyer/search">
          <Button>Find more homes</Button>
        </Link>
      </div>
      <ShowingsList role="buyer" />
    </div>
  );
}
