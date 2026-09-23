import { Navigate, Route, Routes } from 'react-router';
import { AppLayout } from './components/AppLayout';
import { Spinner } from './components/ui';
import { homePathFor, useAuth } from './features/auth/AuthContext';
import { LoginPage } from './features/auth/LoginPage';
import { RegisterPage } from './features/auth/RegisterPage';
import { ListingFormPage } from './features/seller/ListingFormPage';
import { SellerListingsPage } from './features/seller/SellerListingsPage';
import { SellerShowingsPage } from './features/seller/SellerShowingsPage';
import { RequireAuth } from './routes/RequireAuth';

// Temporary placeholders, replaced in the next parts.
const Placeholder = ({ title }: { title: string }) => (
  <h1 className="text-2xl font-semibold text-slate-900">{title} — coming next</h1>
);

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner fullPage />;
  return <Navigate to={user ? homePathFor(user.role) : '/login'} replace />;
}

// The whole route map in one place: easy to read, easy to explain.
export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomeRedirect />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />

        <Route path="seller" element={<RequireAuth role="seller" />}>
          <Route path="listings" element={<SellerListingsPage />} />
          <Route path="listings/new" element={<ListingFormPage />} />
          <Route path="listings/:id/edit" element={<ListingFormPage />} />
          <Route path="showings" element={<SellerShowingsPage />} />
        </Route>

        <Route path="buyer" element={<RequireAuth role="buyer" />}>
          <Route path="search" element={<Placeholder title="Find homes" />} />
          <Route path="showings" element={<Placeholder title="My showings" />} />
        </Route>

        <Route path="*" element={<HomeRedirect />} />
      </Route>
    </Routes>
  );
}
