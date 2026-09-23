-- =====================================================================
-- 001_init: core schema for the home showing scheduler
-- =====================================================================

-- btree_gist lets a GiST index mix "=" on a normal column (listing_id)
-- with "&&" (overlaps) on a range. We need it for the no-double-booking
-- exclusion constraint on showings.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ---------------------------------------------------------------------
-- users: one table for both sides, differentiated by role
-- ---------------------------------------------------------------------
CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL CHECK (length(trim(name)) > 0),
  email         text NOT NULL,
  password_hash text NOT NULL,
  role          text NOT NULL CHECK (role IN ('seller', 'buyer')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Case-insensitive uniqueness: "Ana@Mail.com" and "ana@mail.com" are the same user.
CREATE UNIQUE INDEX users_email_unique ON users (lower(email));

-- ---------------------------------------------------------------------
-- listings: a home a seller wants to show
-- ---------------------------------------------------------------------
CREATE TABLE listings (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id            uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title                text NOT NULL CHECK (length(trim(title)) > 0),
  description          text NOT NULL DEFAULT '',
  address              text NOT NULL,
  city                 text NOT NULL,
  -- Money as integer cents: floats can't represent decimals exactly.
  price_cents          bigint  NOT NULL CHECK (price_cents > 0),
  bedrooms             smallint NOT NULL CHECK (bedrooms >= 0),
  bathrooms            numeric(3,1) NOT NULL CHECK (bathrooms >= 0),
  sqft                 integer CHECK (sqft > 0),
  photo_url            text,
  -- IANA zone of the HOUSE (e.g. America/Chicago). Weekly hours like
  -- "Mon 09:00-12:00" are local to the house, not to whoever is browsing.
  timezone             text NOT NULL DEFAULT 'America/Chicago',
  -- Showing configuration
  showing_duration_min smallint NOT NULL DEFAULT 30 CHECK (showing_duration_min BETWEEN 15 AND 240),
  buffer_min           smallint NOT NULL DEFAULT 0  CHECK (buffer_min BETWEEN 0 AND 120),
  -- Date window in which showings are allowed (NULL until = open-ended)
  available_from       date NOT NULL DEFAULT current_date,
  available_until      date,
  status               text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at           timestamptz NOT NULL DEFAULT now(),
  CHECK (available_until IS NULL OR available_until >= available_from)
);

CREATE INDEX listings_seller_idx ON listings (seller_id);
CREATE INDEX listings_active_city_idx ON listings (lower(city)) WHERE status = 'active';

-- ---------------------------------------------------------------------
-- availability_rules: recurring weekly hours for a listing
-- e.g. Mon 09:00-12:00, Mon 14:00-17:00, Sat 10:00-14:00
-- Slots are NOT stored; they are computed from these rules on demand.
-- ---------------------------------------------------------------------
CREATE TABLE availability_rules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id  uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0 = Sunday
  start_time  time NOT NULL,
  end_time    time NOT NULL,
  CHECK (end_time > start_time)
);

CREATE INDEX availability_rules_listing_idx ON availability_rules (listing_id);

-- ---------------------------------------------------------------------
-- blackout_dates: specific days a listing can NOT be shown
-- (e.g. the seller is traveling, a holiday)
-- ---------------------------------------------------------------------
CREATE TABLE blackout_dates (
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  date       date NOT NULL,
  reason     text,
  PRIMARY KEY (listing_id, date)
);

-- ---------------------------------------------------------------------
-- showings: a buyer's booked visit
-- ---------------------------------------------------------------------
CREATE TABLE showings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id   uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  buyer_id     uuid NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  -- Always stored as absolute instants (UTC under the hood).
  starts_at    timestamptz NOT NULL,
  ends_at      timestamptz NOT NULL,
  status       text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz,
  CHECK (ends_at > starts_at),

  -- THE key rule: two active showings of the same house can never overlap.
  -- Enforced by the database, so it holds even if two buyers click
  -- "book" on the same slot at the exact same millisecond.
  -- '[)' = start inclusive, end exclusive, so 10:00-10:30 and 10:30-11:00 don't collide.
  CONSTRAINT showings_no_overlap_per_listing EXCLUDE USING gist (
    listing_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  ) WHERE (status = 'confirmed'),

  -- A buyer can't be in two houses at the same time either.
  CONSTRAINT showings_no_overlap_per_buyer EXCLUDE USING gist (
    buyer_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  ) WHERE (status = 'confirmed')
);

CREATE INDEX showings_buyer_idx ON showings (buyer_id, starts_at);
