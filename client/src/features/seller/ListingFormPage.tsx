import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ApiError, errorMessage } from '../../api/client';
import { listingsApi, type ListingInput } from '../../api/endpoints';
import type { Availability, ListingWithAvailability } from '../../api/types';
import { Alert, Button, Card, Field, Input, Select, Spinner } from '../../components/ui';
import { useApi } from '../../hooks/useApi';
import { TIMEZONES, todayYmd } from '../../lib/format';
import { BlackoutDatesEditor } from './BlackoutDatesEditor';
import { validateRules, WeeklyScheduleEditor } from './WeeklyScheduleEditor';

// Form fields are strings (that's what inputs give us) and converted on submit.
interface FormState {
  title: string;
  description: string;
  address: string;
  city: string;
  price: string; // dollars in the UI, cents in the API
  bedrooms: string;
  bathrooms: string;
  sqft: string;
  photoUrl: string;
  timezone: string;
  showingDurationMin: string;
  bufferMin: string;
  availableFrom: string;
  availableUntil: string;
  status: 'active' | 'inactive';
}

const EMPTY_FORM: FormState = {
  title: '',
  description: '',
  address: '',
  city: '',
  price: '',
  bedrooms: '3',
  bathrooms: '2',
  sqft: '',
  photoUrl: '',
  timezone: 'America/Chicago',
  showingDurationMin: '30',
  bufferMin: '15',
  availableFrom: todayYmd(),
  availableUntil: '',
  status: 'active',
};

// A sensible starting schedule so a new listing is bookable right away.
const DEFAULT_AVAILABILITY: Availability = {
  rules: [
    ...[1, 2, 3, 4, 5].map((d) => ({ dayOfWeek: d, startTime: '17:00', endTime: '19:00' })),
    { dayOfWeek: 6, startTime: '10:00', endTime: '14:00' },
  ],
  blackoutDates: [],
};

function toForm(l: ListingWithAvailability): FormState {
  return {
    title: l.title,
    description: l.description,
    address: l.address,
    city: l.city,
    price: String(l.priceCents / 100),
    bedrooms: String(l.bedrooms),
    bathrooms: String(l.bathrooms),
    sqft: l.sqft ? String(l.sqft) : '',
    photoUrl: l.photoUrl ?? '',
    timezone: l.timezone,
    showingDurationMin: String(l.showingDurationMin),
    bufferMin: String(l.bufferMin),
    availableFrom: l.availableFrom,
    availableUntil: l.availableUntil ?? '',
    status: l.status,
  };
}

function toPayload(f: FormState): Omit<ListingInput, 'availability'> {
  return {
    title: f.title.trim(),
    description: f.description.trim(),
    address: f.address.trim(),
    city: f.city.trim(),
    priceCents: Math.round(parseFloat(f.price || '0') * 100),
    bedrooms: Number(f.bedrooms),
    bathrooms: Number(f.bathrooms),
    sqft: f.sqft ? Number(f.sqft) : null,
    photoUrl: f.photoUrl.trim() || null,
    timezone: f.timezone,
    showingDurationMin: Number(f.showingDurationMin),
    bufferMin: Number(f.bufferMin),
    availableFrom: f.availableFrom,
    availableUntil: f.availableUntil || null,
    status: f.status,
  };
}

/** One page for both "create" (/new) and "edit" (/:id/edit). */
export function ListingFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const existing = useApi(() => (id ? listingsApi.get(id) : Promise.resolve(null)), [id]);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [availability, setAvailability] = useState<Availability>(DEFAULT_AVAILABILITY);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // When editing, fill the form once the listing arrives.
  useEffect(() => {
    if (existing.data) {
      setForm(toForm(existing.data));
      setAvailability(existing.data.availability);
    }
  }, [existing.data]);

  const ruleErrors = validateRules(availability.rules);
  // Editing a field clears its server error right away (no stale "Title is required"
  // under a title the user just typed). "price" is called "priceCents" by the API.
  const set = (key: keyof FormState) => (e: { target: { value: string } }) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    const apiKey = key === 'price' ? 'priceCents' : key;
    setFieldErrors((errs) => {
      if (!errs[apiKey]) return errs;
      const { [apiKey]: _removed, ...rest } = errs;
      return rest;
    });
  };
  const fieldError = (key: string) => fieldErrors[key]?.[0];

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    if (Object.keys(ruleErrors).length) {
      setError('Please fix the showing schedule before saving.');
      return;
    }
    if (availability.rules.length === 0 && form.status === 'active') {
      setError('Add at least one day with showing hours, otherwise buyers cannot book this home.');
      return;
    }

    setSaving(true);
    try {
      const payload = toPayload(form);
      if (id) {
        // Two calls: details (PATCH) and the weekly schedule (PUT, replaces it atomically).
        await listingsApi.update(id, payload);
        await listingsApi.setAvailability(id, availability);
      } else {
        await listingsApi.create({ ...payload, availability });
      }
      navigate('/seller/listings');
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length) {
        setFieldErrors(err.fieldErrors);
        setError('Please review the highlighted fields.');
      } else {
        setError(errorMessage(err));
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSaving(false);
    }
  };

  if (isEdit && existing.loading) return <Spinner fullPage />;
  if (isEdit && existing.error) return <Alert>{existing.error}</Alert>;

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-4xl space-y-6" noValidate>
      <div className="flex items-center justify-between">
        <div>
          <Link to="/seller/listings" className="text-sm text-slate-500 hover:underline">
            ← My listings
          </Link>
          <h1 className="text-2xl font-semibold text-slate-900">{isEdit ? 'Edit listing' : 'List your home'}</h1>
        </div>
      </div>

      {error && <Alert>{error}</Alert>}

      <Card className="space-y-4 p-6">
        <h2 className="font-semibold text-slate-900">The home</h2>
        <Field label="Title" htmlFor="title" error={fieldError('title')}>
          <Input id="title" value={form.title} onChange={set('title')} placeholder="Sunny craftsman near the park" aria-invalid={!!fieldError('title')} />
        </Field>
        <Field label="Description" htmlFor="description" error={fieldError('description')}>
          <textarea
            id="description"
            rows={3}
            value={form.description}
            onChange={set('description')}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Address" htmlFor="address" error={fieldError('address')}>
            <Input id="address" value={form.address} onChange={set('address')} aria-invalid={!!fieldError('address')} />
          </Field>
          <Field label="City" htmlFor="city" error={fieldError('city')}>
            <Input id="city" value={form.city} onChange={set('city')} aria-invalid={!!fieldError('city')} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Price (USD)" htmlFor="price" error={fieldError('priceCents')}>
            <Input id="price" type="number" min={1} step={1000} value={form.price} onChange={set('price')} aria-invalid={!!fieldError('priceCents')} />
          </Field>
          <Field label="Bedrooms" htmlFor="bedrooms" error={fieldError('bedrooms')}>
            <Input id="bedrooms" type="number" min={0} value={form.bedrooms} onChange={set('bedrooms')} />
          </Field>
          <Field label="Bathrooms" htmlFor="bathrooms" error={fieldError('bathrooms')}>
            <Input id="bathrooms" type="number" min={0} step={0.5} value={form.bathrooms} onChange={set('bathrooms')} />
          </Field>
          <Field label="Sq ft" htmlFor="sqft" error={fieldError('sqft')}>
            <Input id="sqft" type="number" min={1} value={form.sqft} onChange={set('sqft')} />
          </Field>
        </div>
        <Field label="Photo URL (optional)" htmlFor="photoUrl" error={fieldError('photoUrl')}>
          <Input id="photoUrl" type="url" value={form.photoUrl} onChange={set('photoUrl')} placeholder="https://…" />
        </Field>
      </Card>

      <Card className="space-y-4 p-6">
        <div>
          <h2 className="font-semibold text-slate-900">Showing settings</h2>
          <p className="text-sm text-slate-500">Times below are in the home's local timezone.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Home timezone" htmlFor="timezone" error={fieldError('timezone')}>
            <Select id="timezone" value={form.timezone} onChange={set('timezone')}>
              {TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Showing length" htmlFor="duration">
            <Select id="duration" value={form.showingDurationMin} onChange={set('showingDurationMin')}>
              {[15, 30, 45, 60, 90].map((m) => (
                <option key={m} value={m}>
                  {m} minutes
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Break between showings" htmlFor="buffer" hint="Time to tidy up between visits">
            <Select id="buffer" value={form.bufferMin} onChange={set('bufferMin')}>
              {[0, 10, 15, 30, 60].map((m) => (
                <option key={m} value={m}>
                  {m === 0 ? 'None' : `${m} minutes`}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Showings from" htmlFor="availableFrom" error={fieldError('availableFrom')}>
            <Input id="availableFrom" type="date" value={form.availableFrom} onChange={set('availableFrom')} />
          </Field>
          <Field label="Showings until" htmlFor="availableUntil" error={fieldError('availableUntil')} hint="Leave empty for no end date">
            <Input id="availableUntil" type="date" min={form.availableFrom} value={form.availableUntil} onChange={set('availableUntil')} />
          </Field>
          <Field label="Status" htmlFor="status" hint="Inactive homes are hidden from buyers">
            <Select id="status" value={form.status} onChange={set('status')}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </Field>
        </div>
      </Card>

      <Card className="space-y-4 p-6">
        <div>
          <h2 className="font-semibold text-slate-900">Weekly showing hours</h2>
          <p className="text-sm text-slate-500">
            Buyers can book {form.showingDurationMin}-minute showings inside these hours. Already-booked showings are kept if you change them.
          </p>
        </div>
        <WeeklyScheduleEditor
          rules={availability.rules}
          onChange={(rules) => setAvailability((a) => ({ ...a, rules }))}
          errors={ruleErrors}
        />
      </Card>

      <Card className="space-y-4 p-6">
        <div>
          <h2 className="font-semibold text-slate-900">Blocked dates</h2>
          <p className="text-sm text-slate-500">No showings on these days, even if they have weekly hours.</p>
        </div>
        <BlackoutDatesEditor
          value={availability.blackoutDates}
          onChange={(blackoutDates) => setAvailability((a) => ({ ...a, blackoutDates }))}
        />
      </Card>

      <div className="flex justify-end gap-3">
        <Link to="/seller/listings">
          <Button type="button" variant="secondary">
            Cancel
          </Button>
        </Link>
        <Button type="submit" loading={saving}>
          {isEdit ? 'Save changes' : 'Publish listing'}
        </Button>
      </div>
    </form>
  );
}
