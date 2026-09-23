import { pool, query, withTransaction, type Db } from '../../db/pool.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import type { AuthUser } from '../auth/auth.types.js';
import type { AvailabilityInput, CreateListingInput, UpdateListingInput } from './listings.schemas.js';

// ---------------------------------------------------------------------
// DB row  ->  API shape
// The DB uses snake_case (SQL convention) and the API uses camelCase
// (JS convention). This is the one place where we translate.
// ---------------------------------------------------------------------

interface ListingRow {
  id: string;
  seller_id: string;
  seller_name?: string;
  title: string;
  description: string;
  address: string;
  city: string;
  price_cents: string; // bigint comes back as string from pg
  bedrooms: number;
  bathrooms: string; // numeric comes back as string from pg
  sqft: number | null;
  photo_url: string | null;
  timezone: string;
  showing_duration_min: number;
  buffer_min: number;
  available_from: string;
  available_until: string | null;
  status: 'active' | 'inactive';
  created_at: Date;
}

export function toListingDto(row: ListingRow) {
  return {
    id: row.id,
    sellerId: row.seller_id,
    sellerName: row.seller_name,
    title: row.title,
    description: row.description,
    address: row.address,
    city: row.city,
    priceCents: Number(row.price_cents),
    bedrooms: row.bedrooms,
    bathrooms: Number(row.bathrooms),
    sqft: row.sqft,
    photoUrl: row.photo_url,
    timezone: row.timezone,
    showingDurationMin: row.showing_duration_min,
    bufferMin: row.buffer_min,
    availableFrom: row.available_from,
    availableUntil: row.available_until,
    status: row.status,
    createdAt: row.created_at,
  };
}

export type ListingDto = ReturnType<typeof toListingDto>;

// ---------------------------------------------------------------------
// Ownership: the third authorization layer.
//   requireAuth  -> are you logged in?          (401)
//   requireRole  -> are you a seller?           (403)
//   getOwnedListing -> is this YOUR listing?    (403)
// ---------------------------------------------------------------------

async function getListingRow(id: string, db: Db = pool) {
  const { rows } = await db.query<ListingRow>(
    `SELECT l.*, u.name AS seller_name
       FROM listings l JOIN users u ON u.id = l.seller_id
      WHERE l.id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function getOwnedListing(id: string, user: AuthUser, db?: Db) {
  const row = await getListingRow(id, db);
  if (!row) throw notFound('Listing not found');
  if (row.seller_id !== user.id) throw forbidden('You can only manage your own listings');
  return row;
}

// ---------------------------------------------------------------------
// Availability
// ---------------------------------------------------------------------

async function getAvailability(listingId: string) {
  const [rules, blackouts] = await Promise.all([
    query<{ day_of_week: number; start_time: string; end_time: string }>(
      `SELECT day_of_week, to_char(start_time, 'HH24:MI') AS start_time, to_char(end_time, 'HH24:MI') AS end_time
         FROM availability_rules WHERE listing_id = $1
        ORDER BY day_of_week, start_time`,
      [listingId],
    ),
    query<{ date: string; reason: string | null }>(
      'SELECT date, reason FROM blackout_dates WHERE listing_id = $1 ORDER BY date',
      [listingId],
    ),
  ]);

  return {
    rules: rules.rows.map((r) => ({ dayOfWeek: r.day_of_week, startTime: r.start_time, endTime: r.end_time })),
    blackoutDates: blackouts.rows.map((b) => ({ date: b.date, reason: b.reason ?? undefined })),
  };
}

// "Replace all" instead of CRUD per rule: the seller edits the weekly schedule
// as a whole in one form, so the API mirrors that. Delete + insert inside a
// transaction means readers never see a half-updated schedule.
async function replaceAvailability(db: Db, listingId: string, input: AvailabilityInput) {
  await db.query('DELETE FROM availability_rules WHERE listing_id = $1', [listingId]);
  await db.query('DELETE FROM blackout_dates WHERE listing_id = $1', [listingId]);

  if (input.rules.length) {
    // One multi-row INSERT via unnest instead of N round-trips.
    await db.query(
      `INSERT INTO availability_rules (listing_id, day_of_week, start_time, end_time)
       SELECT $1, d, s::time, e::time
         FROM unnest($2::smallint[], $3::text[], $4::text[]) AS t(d, s, e)`,
      [
        listingId,
        input.rules.map((r) => r.dayOfWeek),
        input.rules.map((r) => r.startTime),
        input.rules.map((r) => r.endTime),
      ],
    );
  }

  if (input.blackoutDates.length) {
    await db.query(
      `INSERT INTO blackout_dates (listing_id, date, reason)
       SELECT $1, d::date, r
         FROM unnest($2::text[], $3::text[]) AS t(d, r)`,
      [listingId, input.blackoutDates.map((b) => b.date), input.blackoutDates.map((b) => b.reason ?? null)],
    );
  }
}

// ---------------------------------------------------------------------
// Queries used by the routes
// ---------------------------------------------------------------------

export async function listMyListings(user: AuthUser) {
  const { rows } = await query<ListingRow & { upcoming_showings: string }>(
    `SELECT l.*, u.name AS seller_name,
            (SELECT count(*) FROM showings s
              WHERE s.listing_id = l.id AND s.status = 'confirmed' AND s.starts_at > now()) AS upcoming_showings
       FROM listings l JOIN users u ON u.id = l.seller_id
      WHERE l.seller_id = $1
      ORDER BY l.created_at DESC`,
    [user.id],
  );
  return rows.map((r) => ({ ...toListingDto(r), upcomingShowings: Number(r.upcoming_showings) }));
}

// Any logged-in user can see an active listing; inactive ones only by their owner.
export async function getListingDetail(id: string, user: AuthUser) {
  const row = await getListingRow(id);
  if (!row || (row.status !== 'active' && row.seller_id !== user.id)) throw notFound('Listing not found');
  return { ...toListingDto(row), availability: await getAvailability(id) };
}

export async function createListing(user: AuthUser, input: CreateListingInput) {
  const id = await withTransaction(async (db) => {
    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO listings
         (seller_id, title, description, address, city, price_cents, bedrooms, bathrooms, sqft, photo_url,
          timezone, showing_duration_min, buffer_min, available_from, available_until, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13, COALESCE($14::date, current_date), $15, $16)
       RETURNING id`,
      [
        user.id, input.title, input.description, input.address, input.city, input.priceCents,
        input.bedrooms, input.bathrooms, input.sqft ?? null, input.photoUrl ?? null, input.timezone,
        input.showingDurationMin, input.bufferMin, input.availableFrom ?? null, input.availableUntil ?? null,
        input.status,
      ],
    );
    if (input.availability) await replaceAvailability(db, rows[0].id, input.availability);
    return rows[0].id;
  });
  return getListingDetail(id, user);
}

// Whitelist: maps API field -> DB column. Only these can ever be updated,
// and column names never come from user input (no SQL injection via keys).
const UPDATABLE_COLUMNS: Record<keyof UpdateListingInput, string> = {
  title: 'title',
  description: 'description',
  address: 'address',
  city: 'city',
  priceCents: 'price_cents',
  bedrooms: 'bedrooms',
  bathrooms: 'bathrooms',
  sqft: 'sqft',
  photoUrl: 'photo_url',
  timezone: 'timezone',
  showingDurationMin: 'showing_duration_min',
  bufferMin: 'buffer_min',
  availableFrom: 'available_from',
  availableUntil: 'available_until',
  status: 'status',
};

export async function updateListing(id: string, user: AuthUser, input: UpdateListingInput) {
  const current = await getOwnedListing(id, user);

  // The body may change only one of the two dates, so check the final combination.
  const from = input.availableFrom ?? current.available_from;
  const until = input.availableUntil !== undefined ? input.availableUntil : current.available_until;
  if (until && until < from) throw badRequest('availableUntil must be on or after availableFrom');

  const entries = Object.entries(input).filter(([, v]) => v !== undefined) as [keyof UpdateListingInput, unknown][];
  const sets = entries.map(([key], i) => `${UPDATABLE_COLUMNS[key]} = $${i + 2}`);
  await query(`UPDATE listings SET ${sets.join(', ')} WHERE id = $1`, [id, ...entries.map(([, v]) => v)]);

  return getListingDetail(id, user);
}

export async function setAvailability(id: string, user: AuthUser, input: AvailabilityInput) {
  await withTransaction(async (db) => {
    await getOwnedListing(id, user, db);
    await replaceAvailability(db, id, input);
  });
  return getAvailability(id);
}

export async function deleteListing(id: string, user: AuthUser) {
  await getOwnedListing(id, user);

  // Deleting would cascade and silently erase buyers' upcoming visits.
  // Force the seller to deactivate instead (hides it, keeps the bookings).
  const { rows } = await query<{ n: string }>(
    `SELECT count(*) AS n FROM showings WHERE listing_id = $1 AND status = 'confirmed' AND starts_at > now()`,
    [id],
  );
  if (Number(rows[0].n) > 0) {
    throw conflict('This listing has upcoming showings. Set it to inactive instead of deleting it.');
  }
  await query('DELETE FROM listings WHERE id = $1', [id]);
}
