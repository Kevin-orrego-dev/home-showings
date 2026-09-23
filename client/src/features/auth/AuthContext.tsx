import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, ApiError } from '../../api/client';
import { authApi } from '../../api/endpoints';
import type { Role, User } from '../../api/types';

interface AuthContextValue {
  user: User | null;
  loading: boolean; // true only while we check the session on first load
  login: (email: string, password: string) => Promise<User>;
  register: (data: { name: string; email: string; password: string; role: Role }) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Why Context and not Redux/Zustand: the only truly global state is "who is logged in".
// Everything else is server data fetched per page. Context is built in and enough.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // On page load/refresh: the JWT lives in an httpOnly cookie that JS can't read,
  // so we ask the server "who am I?". 401 simply means "not logged in".
  useEffect(() => {
    authApi
      .me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  // If any request comes back 401 (e.g. the token expired mid-session), drop the user
  // so the router sends them to /login instead of showing broken pages.
  useEffect(() => {
    const id = api.interceptors.response.use(undefined, (err) => {
      if (err instanceof ApiError && err.status === 401) setUser(null);
      return Promise.reject(err);
    });
    return () => api.interceptors.response.eject(id);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const u = await authApi.login(email, password);
    setUser(u);
    return u;
  }, []);

  const register = useCallback(async (data: Parameters<AuthContextValue['register']>[0]) => {
    const u = await authApi.register(data);
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout().catch(() => undefined);
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, loading, login, register, logout }), [user, loading, login, register, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** Where each role lands after logging in. */
export const homePathFor = (role: Role) => (role === 'seller' ? '/seller/listings' : '/buyer/search');
