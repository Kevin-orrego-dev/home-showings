import { Navigate, Outlet, useLocation } from 'react-router';
import type { Role } from '../api/types';
import { homePathFor, useAuth } from '../features/auth/AuthContext';
import { Spinner } from '../components/ui';

/**
 * Route guard. Wraps a group of routes:
 *   <Route element={<RequireAuth role="seller" />}> ...seller pages... </Route>
 *
 * - Still checking the session -> spinner (avoids a flash of the login page on refresh).
 * - Not logged in -> /login, remembering where they wanted to go.
 * - Wrong role -> their own home.
 *
 * This is UX only. The real security is on the server (requireAuth / requireRole):
 * anyone can bypass frontend checks with devtools.
 */
export function RequireAuth({ role }: { role?: Role }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner fullPage />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (role && user.role !== role) return <Navigate to={homePathFor(user.role)} replace />;
  return <Outlet />;
}
