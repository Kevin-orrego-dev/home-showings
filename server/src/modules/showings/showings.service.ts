import { query, withTransaction } from '../../db/pool.js';
import { AppError, conflict, notFound } from '../../lib/errors.js';
import type { AuthUser } from '../auth/auth.types.js';
import { loadBuyerBusy, loadSchedules, type ScheduleSource } from '../scheduling/schedule.repository.js';
import { isBookable } from '../scheduling/slotEngine.js';
import type { BookShowingInput } from './showings.schemas.js';

interface ShowingRow {
  id: string;
  listing_id: string;
  starts_at: Date;
  ends_at: Date;
  status: 'confirmed' | 'cancelled';
  notes: string | null;
  created_at: Date;
  cancelled_at: Date | null;
  cancelled_by_role: 'buyer' | 'seller' | null;
  listing_title: string;
  listing_address: string;
  listing_city: string;
  listing_timezone: string;
  buyer_id: string;
  buyer_name: string;
  buyer_email: string;
  seller_name: string;
}

function toShowingDto(r: ShowingRow) {
  return {
    id: r.id,
    startsAt: r.starts_at.toISOString(),
    endsAt: r.ends_at.toISOString(),
    status: r.status,
    notes: r.notes,
    createdAt: r.created_at,
    cancelledAt: r.cancelled_at,
    cancelledBy: r.cancelled_by_role,
    listing: {
      id: r.listing_id,
      title: r.listing_title,
      address: r.listing_address,
      city: r.listing_city,
      timezone: r.listing_timezone,
      sellerName: r.seller_name,
    },
    // The seller needs to know who's coming and how to reach them.
    buyer: { id: r.buyer_id, name: r.buyer_name, email: r.buyer_email },
  };
}

const SHOWING_SELECT = `
  SELECT s.id, s.listing_id, s.starts_at, s.ends_at, s.status, s.notes, s.created_at, s.cancelled_at,
         cu.role AS cancelled_by_role,
         l.title AS listing_title, l.address AS listing_address, l.city AS listing_city,
         l.timezone AS listing_timezone,
         b.id AS buyer_id, b.name AS buyer_name, b.email AS buyer_email,
         se.name AS seller_name
    FROM showings s
    JOIN listings l ON l.id = s.listing_id
    JOIN users b    ON b.id = s.buyer_id
    JOIN users se   ON se.id = l.seller_id
    LEFT JOIN users cu ON cu.id = s.cancelled_by`;

async function getShowingDto(id: string) {
  const { rows } = await query<ShowingRow>(`${SHOWING_SELECT} WHERE s.id = $1`, [id]);
  return toShowingDto(rows[0]);
}

/**
 * Booking flow, all inside ONE transaction:
 *  1. Lock the listing row (SELECT ... FOR UPDATE). Two buyers booking the same house
 *     now run one after the other, so the buffer check below can't race.
 *  2. Re-run the slot engine for that exact start time: aligned to the grid, inside
 *     the seller's rules, not blacked out, not in the past, respects buffer, buyer free.
 *  3. Insert. The exclusion constraint is still there as the last safety net.
 */
export async function bookShowing(user: AuthUser, input: BookShowingInput) {
  const id = await withTransaction(async (db) => {
    const { rows } = await db.query<ScheduleSource & { status: string }>(
      'SELECT * FROM listings WHERE id = $1 FOR UPDATE',
      [input.listingId],
    );
    const listing = rows[0];
    if (!listing || listing.status !== 'active') throw notFound('Listing not found');

    const start = input.startsAt;
    const end = new Date(start.getTime() + listing.showing_duration_min * 60_000);
    const range = { start, end };

    // Sequential on purpose: a transaction has a single connection.
    const schedules = await loadSchedules([listing], range, db);
    const buyerBusy = await loadBuyerBusy(user.id, range, db);

    if (!isBookable(schedules.get(listing.id)!, start, { now: new Date(), buyerBusy })) {
      throw new AppError(409, 'SLOT_UNAVAILABLE', 'That time is no longer available. Please pick another slot.');
    }

    const inserted = await db.query<{ id: string }>(
      `INSERT INTO showings (listing_id, buyer_id, starts_at, ends_at, notes)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [listing.id, user.id, start, end, input.notes || null],
    );
    return inserted.rows[0].id;
  });

  return getShowingDto(id);
}

/** Buyers see their own showings; sellers see the showings on their listings. */
export async function listShowings(user: AuthUser, scope: 'upcoming' | 'past' | 'all') {
  const who = user.role === 'buyer' ? 's.buyer_id = $1' : 'l.seller_id = $1';
  const when = { upcoming: 'AND s.ends_at > now()', past: 'AND s.ends_at <= now()', all: '' }[scope];
  const order = scope === 'past' ? 'DESC' : 'ASC';

  const { rows } = await query<ShowingRow>(
    `${SHOWING_SELECT} WHERE ${who} ${when} ORDER BY s.starts_at ${order}`,
    [user.id],
  );
  return rows.map(toShowingDto);
}

/**
 * Either side can cancel: the buyer who booked it, or the seller who owns the house.
 * Anyone else gets 404 (not 403): showings are private, so we don't even confirm they exist.
 */
export async function cancelShowing(id: string, user: AuthUser) {
  const { rows } = await query<{ buyer_id: string; seller_id: string; status: string; starts_at: Date }>(
    `SELECT s.buyer_id, l.seller_id, s.status, s.starts_at
       FROM showings s JOIN listings l ON l.id = s.listing_id
      WHERE s.id = $1`,
    [id],
  );
  const showing = rows[0];
  if (!showing || (showing.buyer_id !== user.id && showing.seller_id !== user.id)) {
    throw notFound('Showing not found');
  }
  if (showing.status === 'cancelled') throw conflict('This showing is already cancelled');
  if (showing.starts_at <= new Date()) throw conflict('Past showings cannot be cancelled');

  await query(
    `UPDATE showings SET status = 'cancelled', cancelled_at = now(), cancelled_by = $2 WHERE id = $1`,
    [id, user.id],
  );
  return getShowingDto(id);
}
