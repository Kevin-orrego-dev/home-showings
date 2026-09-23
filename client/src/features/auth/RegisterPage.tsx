import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { ApiError, errorMessage } from '../../api/client';
import type { Role } from '../../api/types';
import { Alert, Button, Card, Field, Input, cx } from '../../components/ui';
import { homePathFor, useAuth } from './AuthContext';

const ROLES: { value: Role; title: string; description: string }[] = [
  { value: 'buyer', title: "I'm buying", description: 'Find homes that fit my schedule' },
  { value: 'seller', title: "I'm selling", description: 'List my home and set showing hours' },
];

export function RegisterPage() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'buyer' as Role });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to={homePathFor(user.role)} replace />;

  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    try {
      const u = await register(form);
      navigate(homePathFor(u.role), { replace: true });
    } catch (err) {
      // The server's validation messages are shown next to each field.
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length) setFieldErrors(err.fieldErrors);
      else setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-md pt-8">
      <h1 className="mb-1 text-2xl font-semibold text-slate-900">Create your account</h1>
      <p className="mb-6 text-sm text-slate-500">It takes less than a minute.</p>

      <Card className="p-6">
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {error && <Alert>{error}</Alert>}

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-slate-700">I want to…</legend>
            <div className="grid grid-cols-2 gap-2">
              {ROLES.map((r) => (
                <label
                  key={r.value}
                  className={cx(
                    'cursor-pointer rounded-lg border p-3 text-sm',
                    form.role === r.value ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-100' : 'border-slate-300',
                  )}
                >
                  <input
                    type="radio"
                    name="role"
                    value={r.value}
                    checked={form.role === r.value}
                    onChange={() => set('role')(r.value)}
                    className="sr-only"
                  />
                  <span className="block font-medium text-slate-900">{r.title}</span>
                  <span className="text-slate-500">{r.description}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <Field label="Full name" htmlFor="name" error={fieldErrors.name?.[0]}>
            <Input id="name" autoComplete="name" value={form.name} onChange={(e) => set('name')(e.target.value)} aria-invalid={!!fieldErrors.name} />
          </Field>
          <Field label="Email" htmlFor="email" error={fieldErrors.email?.[0]}>
            <Input id="email" type="email" autoComplete="email" value={form.email} onChange={(e) => set('email')(e.target.value)} aria-invalid={!!fieldErrors.email} />
          </Field>
          <Field label="Password" htmlFor="password" error={fieldErrors.password?.[0]} hint="At least 8 characters">
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => set('password')(e.target.value)}
              aria-invalid={!!fieldErrors.password}
            />
          </Field>

          <Button type="submit" className="w-full" loading={submitting}>
            Create account
          </Button>
        </form>
      </Card>

      <p className="mt-4 text-center text-sm text-slate-500">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-brand-600 hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
