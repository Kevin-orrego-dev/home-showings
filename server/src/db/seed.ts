import bcrypt from 'bcryptjs';
import { pool, withTransaction } from './pool.js';

// Demo data so reviewers can try the app in seconds.
// Dates are relative to "today", so the demo never goes stale.
// Every demo account uses the same password.
const DEMO_PASSWORD = 'password123';

type RuleSeed = [day: number, start: string, end: string]; // 0 = Sunday

interface ListingSeed {
  title: string;
  description: string;
  address: string;
  city: string;
  priceCents: number;
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  durationMin: number;
  bufferMin: number;
  rules: RuleSeed[];
}

const WEEKDAY_MORNINGS: RuleSeed[] = [1, 2, 3, 4, 5].map((d) => [d, '09:00', '12:00']);
const WEEKDAY_EVENINGS: RuleSeed[] = [1, 2, 3, 4, 5].map((d) => [d, '17:00', '19:30']);
const WEEKENDS: RuleSeed[] = [
  [6, '10:00', '16:00'],
  [0, '12:00', '16:00'],
];

const sellers = [
  {
    name: 'Sarah Seller',
    email: 'seller@demo.com',
    listings: [
      {
        title: 'Sunny craftsman near Zilker Park',
        description: 'Renovated 1940s craftsman with a big front porch, open kitchen and a shaded backyard.',
        address: '1204 Kinney Ave',
        city: 'Austin',
        priceCents: 689_000_00,
        bedrooms: 3,
        bathrooms: 2,
        sqft: 1650,
        durationMin: 30,
        bufferMin: 15,
        rules: [...WEEKDAY_EVENINGS, ...WEEKENDS],
      },
      {
        title: 'Modern townhome in East Austin',
        description: 'Three-story townhome with rooftop deck and downtown views. Walk to coffee shops and bars.',
        address: '2311 E 6th St, Unit 4',
        city: 'Austin',
        priceCents: 545_000_00,
        bedrooms: 2,
        bathrooms: 2.5,
        sqft: 1420,
        durationMin: 30,
        bufferMin: 0,
        rules: [...WEEKDAY_MORNINGS, [6, '09:00', '13:00']],
      },
      {
        title: 'Family home with pool in Round Rock',
        description: 'Spacious 4-bedroom home on a cul-de-sac, top-rated schools, heated pool.',
        address: '809 Brushy Creek Rd',
        city: 'Round Rock',
        priceCents: 475_000_00,
        bedrooms: 4,
        bathrooms: 3,
        sqft: 2600,
        durationMin: 45,
        bufferMin: 15,
        rules: WEEKENDS,
      },
    ] satisfies ListingSeed[],
  },
  {
    name: 'Marcus Owner',
    email: 'seller2@demo.com',
    listings: [
      {
        title: 'Downtown loft with skyline views',
        description: 'Industrial loft, 14 ft ceilings, concrete floors, gym and pool in the building.',
        address: '555 E 5th St, #1802',
        city: 'Austin',
        priceCents: 799_000_00,
        bedrooms: 1,
        bathrooms: 1.5,
        sqft: 1100,
        durationMin: 30,
        bufferMin: 10,
        rules: [...WEEKDAY_MORNINGS, ...WEEKDAY_EVENINGS],
      },
      {
        title: 'Hill Country retreat in Dripping Springs',
        description: 'Stone home on 2 acres with oak trees, workshop and sunset views.',
        address: '3100 Creek Rd',
        city: 'Dripping Springs',
        priceCents: 925_000_00,
        bedrooms: 4,
        bathrooms: 3.5,
        sqft: 3200,
        durationMin: 60,
        bufferMin: 30,
        rules: [[5, '13:00', '18:00'], ...WEEKENDS],
      },
    ] satisfies ListingSeed[],
  },
];

const buyers = [
  { name: 'Ben Buyer', email: 'buyer@demo.com' },
  { name: 'Alice Shopper', email: 'buyer2@demo.com' },
];

async function seed() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  await withTransaction(async (db) => {
    // Idempotent: wipe data (not schema) so the seed can run many times.
    await db.query('TRUNCATE showings, blackout_dates, availability_rules, listings, users CASCADE');

    const insertUser = (name: string, email: string, role: 'seller' | 'buyer') =>
      db
        .query<{ id: string }>(
          'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id',
          [name, email, passwordHash, role],
        )
        .then((r) => r.rows[0].id);

    const listingIds: string[] = [];

    for (const seller of sellers) {
      const sellerId = await insertUser(seller.name, seller.email, 'seller');

      for (const l of seller.listings) {
        const { rows } = await db.query<{ id: string }>(
          `INSERT INTO listings
             (seller_id, title, description, address, city, price_cents, bedrooms, bathrooms, sqft,
              timezone, showing_duration_min, buffer_min, available_from, available_until)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'America/Chicago',$10,$11, current_date, current_date + 60)
           RETURNING id`,
          [sellerId, l.title, l.description, l.address, l.city, l.priceCents, l.bedrooms, l.bathrooms,
            l.sqft, l.durationMin, l.bufferMin],
        );
        const listingId = rows[0].id;
        listingIds.push(listingId);

        for (const [day, start, end] of l.rules) {
          await db.query(
            'INSERT INTO availability_rules (listing_id, day_of_week, start_time, end_time) VALUES ($1,$2,$3,$4)',
            [listingId, day, start, end],
          );
        }
      }
    }

    const buyerIds = [];
    for (const b of buyers) buyerIds.push(await insertUser(b.name, b.email, 'buyer'));

    // A blackout day on the first listing (a week from today) to demo that feature.
    await db.query(
      `INSERT INTO blackout_dates (listing_id, date, reason) VALUES ($1, current_date + 7, 'Owner out of town')`,
      [listingIds[0]],
    );

    // One pre-booked showing: next Saturday 10:00-10:30 house time, on the first listing,
    // by the second buyer. Lets us demo that a taken slot disappears for everyone else.
    // (date + time) AT TIME ZONE tz  => converts a local wall-clock time to an absolute instant.
    await db.query(
      `WITH next_sat AS (
         SELECT current_date + ((6 - extract(dow FROM current_date)::int + 7) % 7) AS d
       )
       INSERT INTO showings (listing_id, buyer_id, starts_at, ends_at, notes)
       SELECT $1, $2,
              (d + time '10:00') AT TIME ZONE 'America/Chicago',
              (d + time '10:30') AT TIME ZONE 'America/Chicago',
              'Pre-booked demo showing'
       FROM next_sat`,
      [listingIds[0], buyerIds[1]],
    );
  });

  console.log('Seed complete. Demo accounts (password: %s):', DEMO_PASSWORD);
  console.log('  sellers: seller@demo.com, seller2@demo.com');
  console.log('  buyers:  buyer@demo.com, buyer2@demo.com');
}

seed()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
