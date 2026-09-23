import { NavLink, Outlet, useNavigate } from 'react-router';
import { useAuth } from '../features/auth/AuthContext';
import { Button, cx } from './ui';

const NAV = {
  seller: [
    { to: '/seller/listings', label: 'My listings' },
    { to: '/seller/showings', label: 'Showings' },
  ],
  buyer: [
    { to: '/buyer/search', label: 'Find homes' },
    { to: '/buyer/showings', label: 'My showings' },
  ],
};

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
          <span className="text-lg font-semibold text-slate-900">🏡 Home Showings</span>
          {user && (
            <nav className="flex gap-1">
              {NAV[user.role].map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cx(
                      'rounded-lg px-3 py-2 text-sm font-medium',
                      isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100',
                    )
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          )}
          {user && (
            <div className="ml-auto flex items-center gap-3">
              <span className="hidden text-sm text-slate-500 sm:inline">
                {user.name} · <span className="capitalize">{user.role}</span>
              </span>
              <Button variant="ghost" onClick={handleLogout}>
                Log out
              </Button>
            </div>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
