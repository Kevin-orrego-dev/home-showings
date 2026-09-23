import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { errorMessage } from '../../api/client';
import { Alert, Button, Card, Field, Input } from '../../components/ui';
import { homePathFor, useAuth } from './AuthContext';

const DEMO_ACCOUNTS = [
  { label: 'Demo seller', email: 'seller@demo.com' },
  { label: 'Demo buyer', email: 'buyer@demo.com' },
];

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to={homePathFor(user.role)} replace />;

  const signIn = async (e: string, p: string) => {
    setSubmitting(true);
    setError(null);
    try {
      const u = await login(e, p);
      // Go back to the page they originally wanted, if it belongs to their role.
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from?.startsWith(`/${u.role}`) ? from : homePathFor(u.role), { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    signIn(email, password);
  };

  return (
    <div className="mx-auto max-w-sm pt-8">
      <h1 className="mb-1 text-2xl font-semibold text-slate-900">Welcome back</h1>
      <p className="mb-6 text-sm text-slate-500">Log in to manage your listings or book showings.</p>

      <Card className="p-6">
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {error && <Alert>{error}</Alert>}
          <Field label="Email" htmlFor="email">
            <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Password" htmlFor="password">
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Button type="submit" className="w-full" loading={submitting}>
            Log in
          </Button>
        </form>

        {/* One-click demo login: reviewers can try both sides without typing anything. */}
        <div className="mt-6 border-t border-slate-100 pt-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Try it with a demo account</p>
          <div className="grid grid-cols-2 gap-2">
            {DEMO_ACCOUNTS.map((a) => (
              <Button key={a.email} variant="secondary" disabled={submitting} onClick={() => signIn(a.email, 'password123')}>
                {a.label}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      <p className="mt-4 text-center text-sm text-slate-500">
        No account?{' '}
        <Link to="/register" className="font-medium text-brand-600 hover:underline">
          Create one
        </Link>
      </p>
    </div>
  );
}
