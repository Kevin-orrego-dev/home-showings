import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { pool } from '../src/db/pool.js';

// Integration tests: real Express app + real Postgres (the one in DATABASE_URL).
// They create their own users/listing with a unique email domain and delete
// them at the end, so they never touch the demo data.
// Requires: database running and migrations applied (npm run db:migrate).

const app = createApp();
const DOMAIN = `@int-${Date.now()}.test`;

// Tomorrow at 10:00 UTC: guaranteed future and inside the listing's rules below.
const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
const SLOT = `${tomorrow}T10:00:00.000Z`;
const WINDOW = { start: `${tomorrow}T09:00:00Z`, end: `${tomorrow}T12:00:00Z` };

async function signUp(role: 'seller' | 'buyer', name: string) {
  const agent = request.agent(app); // keeps the auth cookie between requests, like a browser
  await agent
    .post('/api/auth/register')
    .send({ name, email: `${name}${DOMAIN}`, password: 'password123', role })
    .expect(201);
  return agent;
}

let seller: ReturnType<typeof request.agent>;
let buyers: ReturnType<typeof request.agent>[];
let listingId: string;

beforeAll(async () => {
  seller = await signUp('seller', 'seller');
  buyers = await Promise.all([1, 2, 3, 4, 5].map((n) => signUp('buyer', `buyer${n}`)));

  const res = await seller
    .post('/api/listings')
    .send({
      title: 'Integration test house',
      address: '1 Test St',
      city: 'Testville',
      priceCents: 100_000_00,
      bedrooms: 2,
      bathrooms: 1,
      timezone: 'UTC',
      showingDurationMin: 30,
      availability: {
        rules: [0, 1, 2, 3, 4, 5, 6].map((d) => ({ dayOfWeek: d, startTime: '09:00', endTime: '12:00' })),
        blackoutDates: [],
      },
    })
    .expect(201);
  listingId = res.body.listing.id;
});

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`%${DOMAIN}`]); // cascades listings + showings
  await pool.end();
});

const searchSlots = async (agent = buyers[0]) => {
  const res = await agent.post('/api/search').send({ windows: [WINDOW], city: 'Testville' }).expect(200);
  return res.body.results.find((r: any) => r.listing.id === listingId)?.slots.map((s: any) => s.start) ?? [];
};

describe('search + booking', () => {
  it('search returns the listing with its open slots', async () => {
    expect(await searchSlots()).toEqual([
      `${tomorrow}T09:00:00.000Z`, `${tomorrow}T09:30:00.000Z`, `${tomorrow}T10:00:00.000Z`,
      `${tomorrow}T10:30:00.000Z`, `${tomorrow}T11:00:00.000Z`, `${tomorrow}T11:30:00.000Z`,
    ]);
  });

  it('only buyers can book', async () => {
    await seller.post('/api/showings').send({ listingId, startsAt: SLOT }).expect(403);
  });

  it('rejects times that are not real slots', async () => {
    const res = await buyers[0].post('/api/showings').send({ listingId, startsAt: `${tomorrow}T10:10:00Z` }).expect(409);
    expect(res.body.error.code).toBe('SLOT_UNAVAILABLE');
  });

  it('when 5 buyers book the same slot at the same time, exactly one wins', async () => {
    const responses = await Promise.all(
      buyers.map((b) => b.post('/api/showings').send({ listingId, startsAt: SLOT })),
    );
    const statuses = responses.map((r) => r.status).sort();
    expect(statuses).toEqual([201, 409, 409, 409, 409]);

    const { rows } = await pool.query(
      `SELECT count(*)::int AS n FROM showings WHERE listing_id = $1 AND status = 'confirmed'`,
      [listingId],
    );
    expect(rows[0].n).toBe(1);
  });

  it('a booked slot disappears from search for everyone', async () => {
    expect(await searchSlots(buyers[1])).not.toContain(SLOT);
  });

  it('strangers cannot cancel; the seller can, and the slot reopens', async () => {
    const { body } = await seller.get('/api/showings').expect(200);
    const showing = body.showings.find((s: any) => s.listing.id === listingId);
    const winner = buyers.find((_, i) => showing.buyer.email === `buyer${i + 1}${DOMAIN}`)!;
    const stranger = buyers.find((b) => b !== winner)!;

    await stranger.post(`/api/showings/${showing.id}/cancel`).expect(404);

    const cancelled = await seller.post(`/api/showings/${showing.id}/cancel`).expect(200);
    expect(cancelled.body.showing).toMatchObject({ status: 'cancelled', cancelledBy: 'seller' });

    await winner.post(`/api/showings/${showing.id}/cancel`).expect(409); // already cancelled
    expect(await searchSlots()).toContain(SLOT);
  });
});
