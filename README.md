# 🏡 Home Showings

A two-sided scheduling app for home showings.

- **Sellers** list a home and decide when it can be shown: allowed dates, weekly hours, blocked days, visit length and a break between visits.
- **Buyers** say when *they* are free and only see homes with open showing times inside that availability, then book one in two clicks.

Built for the **One Day Build Challenge** (Project 2 – Home Showing Schedule Application).

![Buyer search](docs/screenshots/02-buyer-search.png)

---

## Table of contents

- [Quick start](#quick-start)
- [Demo walkthrough](#demo-walkthrough)
- [Features](#features)
- [Assumptions & product decisions](#assumptions--product-decisions)
- [Architecture](#architecture)
- [Data model](#data-model)
- [How scheduling works](#how-scheduling-works)
- [API](#api)
- [Security](#security)
- [Testing](#testing)
- [Project structure](#project-structure)
- [What I'd do with more time](#what-id-do-with-more-time)
- [How I used AI](#how-i-used-ai)

---

## Quick start

### Prerequisites

- Node.js 20+
- **One** of:
  - Docker Desktop (recommended), or
  - A local PostgreSQL 14+ installation

### 1. Install dependencies

```bash
npm install
```

### 2. Create the database

#### Option A — Docker (recommended)

```bash
npm run db:up
```

Starts PostgreSQL 16 on **port 5433** and creates the `showings` database and user automatically
(see `docker-compose.yml`). Port 5433 avoids clashing with a Postgres you may already run on 5432.

#### Option B — Existing local PostgreSQL

Connect as a superuser (psql, TablePlus, pgAdmin…) and run:

```sql
CREATE USER showings WITH PASSWORD 'showings';
CREATE DATABASE showings OWNER showings;
```

Then point `DATABASE_URL` in `server/.env` (next step) to your port, usually 5432:

```
DATABASE_URL=postgres://showings:showings@localhost:5432/showings
```

> Tables are never created by hand: the migrations in step 4 create them, so every environment
> ends up with exactly the same schema.

### 3. Configure environment variables

```bash
cp server/.env.example server/.env        # macOS / Linux
copy server\.env.example server\.env      # Windows
```

The defaults work as-is for local development.

### 4. Create the tables and demo data

```bash
npm run db:migrate   # runs server/src/db/migrations/*.sql
npm run db:seed      # demo users, 5 homes with schedules, 1 booked showing
```

`npm run db:reset` drops everything and runs both again. Seed dates are relative to *today*, so the
demo never goes stale.

### 5. Run the app

```bash
npm run dev
```

Starts the API on <http://localhost:4000> and the web app on **<http://localhost:5173>**.

### 6. Run the tests

```bash
npm test
```

### Demo accounts

Password for all: `password123` (or use the **Demo seller / Demo buyer** buttons on the login page).

| Role   | Email                                  |
|--------|----------------------------------------|
| Seller | `seller@demo.com`, `seller2@demo.com`  |
| Buyer  | `buyer@demo.com`, `buyer2@demo.com`    |

### Inspecting the database (optional)

Any Postgres client works (TablePlus, DBeaver, pgAdmin). With Docker: host `localhost`, port `5433`,
user / password / database `showings`.

---

## Demo walkthrough

1. **Log in as the demo buyer.** The search runs immediately for *this weekend*: four homes appear,
   each with its open times grouped by day.
2. Pick a time → a confirmation dialog shows the exact visit in the **home's timezone** (and in yours
   if they differ) → **Book showing**. The slot disappears from the results.
3. **Log in as the demo seller** → *Showings*: the new visit is there with the buyer's name, email and note.
4. Edit a listing: change the weekly hours, block a date, change the visit length. Search again as a
   buyer and the openings follow.
5. **Double booking:** open the same time slot in two browsers with two buyers and confirm both.
   One gets the showing, and the other is told the time is no longer available and its list refreshes.

| | |
|---|---|
| ![Booking](docs/screenshots/03-booking-dialog.png) | ![My showings](docs/screenshots/04-buyer-showings.png) |
| ![Seller listings](docs/screenshots/05-seller-listings.png) | ![Weekly schedule](docs/screenshots/06-seller-schedule.png) |

---

## Features

**Seller side**
- Create / edit / activate / deactivate / delete listings (price, beds, baths, sqft, photo, description).
- Showing configuration per home: timezone, visit length (15–90 min), break between visits, allowed date range.
- Weekly schedule editor: several time ranges per day, "copy Monday to Tue–Fri", overlap validation as you type.
- Blocked dates (with a private reason).
- See every showing booked on their homes, with the buyer's contact info; cancel if needed.

**Buyer side**
- Enter availability as one or more time windows in *their own* timezone, with presets
  (*This weekend*, *Weekday evenings*, *Next 7 days*).
- Filters: city, max price, minimum bedrooms.
- Results only include homes with at least one bookable time, sorted by earliest opening.
- Booking with confirmation step and an optional note for the seller.
- *My showings*: upcoming and past visits; cancel upcoming ones.

**Both**
- Accounts with a role (seller or buyer), session kept across refreshes.
- Times always shown in the home's timezone, plus a hint in the viewer's local time when different.
- Responsive from 390px phones to wide desktop screens.

---

## Assumptions & product decisions

The brief is intentionally open, so these are the calls I made and why.

| # | Decision | Why |
|---|---|---|
| 1 | **One app, two roles.** The role is chosen at sign-up; one account is either a seller or a buyer. | Keeps authorization simple and matches the brief's "two sides". Supporting both roles per account is an easy extension (a user_roles table). |
| 2 | **Seller availability = date range + weekly hours + blocked dates**, all in the **home's timezone**. | That's how people actually think ("weekday evenings, Saturday mornings, not Oct 12"). A showing at 10:00 means 10:00 *at the house*, wherever the viewer is. |
| 3 | **Slots are computed, never stored.** | Storing every slot would mean thousands of rows per home that go stale the moment the seller changes the visit length. Calendly-style tools work the same way. |
| 4 | **Fixed visit length per home + optional break between visits.** Slots start at the beginning of each weekly range. | Sellers need predictable visits and time to tidy up. The break is enforced around existing bookings. |
| 5 | **Buyer availability is a search, not saved data.** | The brief says the buyer "inputs their availability and is shown listings". Saving it plus alerts for new openings is listed under *more time*. |
| 6 | **Bookings are confirmed instantly** (no seller approval). | Fewer round trips for a one-day scope; the seller controls supply through their schedule. An approve/decline flow is a natural next step. |
| 7 | **Either side can cancel;** cancelled showings are kept (who and when) and stay visible, marked. | History matters, and each side must see that a visit was cancelled rather than having it silently vanish. |
| 8 | **Changing the schedule never cancels existing bookings.** | Silently cancelling something that was agreed is worse than honoring it. The UI tells the seller this. |
| 9 | **A home with upcoming showings can't be deleted**; the seller is asked to deactivate it instead. | Deleting would cascade and erase buyers' visits. Inactive homes are hidden from search but keep their bookings. |
| 10 | **A buyer can't book two showings that overlap**, even at different homes. | They can't be in two places at once; the search also hides those times. |
| 11 | **Search is limited to 10 windows and a 31-day span.** | Protects the server from requests that would generate millions of slots. |
| 12 | Out of scope: real agents, payments, emails/SMS, maps, photo uploads. | Not needed to prove the core scheduling problem in one day. |

---

## Architecture

```
┌──────────────────────────┐   /api/* (Vite dev proxy,   ┌──────────────────────────┐     ┌──────────────┐
│  React + Vite (client)   │   same origin → cookies)    │  Express 5 API (server)  │ SQL │ PostgreSQL 16│
│  axios · React Router    │ ──────────────────────────► │  zod · JWT cookie · pg   │ ──► │ exclusion    │
│  Context (session only)  │ ◄────────────────────────── │  Luxon slot engine       │     │ constraints  │
└──────────────────────────┘        JSON                 └──────────────────────────┘     └──────────────┘
```

| Layer | Choice | Why this, and not the usual alternative |
|---|---|---|
| Repo | npm workspaces monorepo | One public repo as requested, one `npm install`. Turborepo/Nx would be overkill for two packages. |
| API | Express 5 + TypeScript | Express 5 forwards errors from `async` handlers natively (no try/catch in every route). NestJS adds a lot of structure a one-day app doesn't need. |
| Validation | zod | One schema gives runtime validation **and** the TypeScript type. Also validates env vars at boot. |
| DB access | `pg` + hand-written SQL, custom 50-line migration runner | The key rule lives in an exclusion constraint that Prisma's schema can't express; plain SQL keeps the whole schema readable in one file. |
| Dates (API) | Luxon | Converting "Saturday 10:00 in Chicago" into an instant, DST included, needs a real tz library. |
| Dates (UI) | native `Intl` | The UI only *displays* instants in a zone; `Intl.DateTimeFormat` does that with zero dependencies. |
| Client data | axios + a small `useApi` hook | Explicit and easy to follow; the hook handles loading/error and ignores stale responses. TanStack Query would add caching we don't need at this size. |
| Styling | Tailwind v4 + ~6 small components | Fast to build, no heavy component library, consistent tokens in one `@theme`. |

**Backend layering:** `routes` (parse input, call service, send response) → `service` (business
rules, SQL; knows nothing about Express) → DB. One central error handler turns every error into
`{ error: { code, message, details? } }` and maps Postgres errors (unique / exclusion violations)
to 409s.

---

## Data model

```mermaid
erDiagram
    users ||--o{ listings : "sells"
    users ||--o{ showings : "books"
    listings ||--o{ availability_rules : "weekly hours"
    listings ||--o{ blackout_dates : "blocked days"
    listings ||--o{ showings : "has"

    users {
        uuid id PK
        text name
        text email "unique, case-insensitive"
        text password_hash
        text role "seller | buyer"
    }
    listings {
        uuid id PK
        uuid seller_id FK
        text title
        text address
        text city
        bigint price_cents
        smallint bedrooms
        numeric bathrooms
        text timezone "IANA, e.g. America/Chicago"
        smallint showing_duration_min
        smallint buffer_min
        date available_from
        date available_until "nullable"
        text status "active | inactive"
    }
    availability_rules {
        uuid id PK
        uuid listing_id FK
        smallint day_of_week "0 = Sunday"
        time start_time "local to the home"
        time end_time
    }
    blackout_dates {
        uuid listing_id PK, FK
        date date PK
        text reason
    }
    showings {
        uuid id PK
        uuid listing_id FK
        uuid buyer_id FK
        timestamptz starts_at
        timestamptz ends_at
        text status "confirmed | cancelled"
        text notes
        uuid cancelled_by FK
        timestamptz cancelled_at
    }
```

Notable choices: money as integer cents, UUID keys (no guessable ids), `CHECK` constraints instead of
Postgres `ENUM`s (easier to evolve), and schema changes only through new migration files
(`002_…` adds `cancelled_by` rather than editing `001`).

---

## How scheduling works

### The slot engine (`server/src/modules/scheduling/slotEngine.ts`)

Pure functions (no DB, no Express, no `Date.now()`, since "now" is passed in), which makes every
edge case unit-testable. For one home and the buyer's windows:

1. Walk each calendar day touched by the windows, **in the home's timezone**.
2. Skip days outside `available_from … available_until` and blocked dates.
3. Cut every weekly range of that weekday into slots of `showing_duration_min`.
4. Keep a slot only if it is in the future, fits **entirely** inside a buyer window, doesn't collide
   with an existing showing **plus the seller's break**, and doesn't collide with another showing of
   the same buyer.

Search runs cheap filters in SQL first (city, price, beds, date range), loads rules, blocked dates and
bookings for all candidates in **3 queries total** (no N+1), then runs the engine per home.

### Booking without double bookings

Two buyers clicking the same slot at the same millisecond must not both win. There are two layers:

1. **Application layer.** `SELECT … FROM listings WHERE id = $1 FOR UPDATE` locks the home for the
   duration of the booking transaction, then re-runs the slot engine (`isBookable`) for that exact start.
   This covers everything including the seller's break, which varies per home.
2. **Database layer, the safety net.** An exclusion constraint makes overlapping confirmed showings
   of the same home impossible, no matter what code path writes them:

```sql
CONSTRAINT showings_no_overlap_per_listing EXCLUDE USING gist (
  listing_id WITH =,
  tstzrange(starts_at, ends_at, '[)') WITH &&
) WHERE (status = 'confirmed')
```

`'[)'` makes 10:00–10:30 and 10:30–11:00 adjacent, not overlapping. A second constraint does the same
per buyer. The client only sends `startsAt`; the server derives the end from the home's visit length.

An integration test fires 5 simultaneous bookings for the same slot and asserts exactly one `201` and four `409`s.

### Timezones

- Weekly hours are wall-clock times **of the home** (`time` + the listing's IANA `timezone`).
- Bookings are absolute instants (`timestamptz`).
- The buyer's availability is entered in the browser's timezone and sent as ISO 8601 instants; the API
  rejects date-times without an offset.
- DST is handled by Luxon; a unit test covers the Nov 1 2026 US change.

---

## API

All endpoints are under `/api` and return JSON. Errors are always `{ error: { code, message, details? } }`.

| Method | Path | Who | Purpose |
|---|---|---|---|
| POST | `/auth/register` | public | Create account (`role`: seller or buyer), sets session cookie |
| POST | `/auth/login` | public | Log in, sets session cookie |
| POST | `/auth/logout` | any | Clear session |
| GET | `/auth/me` | logged in | Current user (used on page load) |
| GET | `/listings/mine` | seller | Own listings + upcoming showing count |
| POST | `/listings` | seller | Create listing (+ optional schedule) in one transaction |
| PATCH | `/listings/:id` | owner | Update some fields |
| PUT | `/listings/:id/availability` | owner | Replace the weekly schedule + blocked dates atomically |
| DELETE | `/listings/:id` | owner | Delete (409 if it has upcoming showings) |
| GET | `/listings/:id` | logged in | Listing detail with schedule |
| GET | `/listings/:id/slots?from&to` | logged in | Open times of one home (default next 14 days) |
| POST | `/search` | logged in | `{ windows[], city?, minPriceCents?, maxPriceCents?, minBedrooms? }` → homes with open slots |
| POST | `/showings` | buyer | Book `{ listingId, startsAt, notes? }` |
| GET | `/showings?scope=upcoming\|past\|all` | logged in | Buyer: own bookings · Seller: bookings on own homes |
| POST | `/showings/:id/cancel` | booking buyer or home's seller | Cancel (kept for history) |

---

## Security

- **Passwords:** bcrypt; login answers the same way (and takes the same time) whether or not the email
  exists, so accounts can't be enumerated.
- **Session:** JWT in an **httpOnly, SameSite=Lax** cookie: JavaScript can't read it (XSS can't steal
  it) and cross-site POSTs don't carry it (basic CSRF protection). `Secure` in production.
- **Authorization in three layers:** authenticated (401) → role (403) → **ownership** (a seller can only
  touch their own homes, so changing an id in the URL gives 403). Private resources (showings) answer
  404 to strangers so their existence isn't revealed.
- **Input:** every body, query and route param is validated with zod; all SQL is parameterized; the
  PATCH column list comes from a whitelist, never from request keys.
- **Hardening:** `helmet` headers, 100 kb body limit, env vars validated at boot (32+ char JWT secret).
- Frontend route guards are UX only; the API enforces everything.

---

## Testing

```bash
npm test
```

- **13 unit tests** for the slot engine: slot cutting, partial windows, overlapping windows, blocked
  dates, date range, past times, existing bookings, the seller's break, the buyer's own bookings, a DST
  change, a buyer in a different timezone, and `isBookable`.
- **6 integration tests** (supertest + the real database): search results, role checks, off-grid times,
  **5 concurrent bookings of one slot → exactly 1 succeeds**, booked slots disappearing from search,
  and cancel permissions. They create and delete their own data.
- The full seller and buyer flows were also run in a headless browser at widths from 390px to 2000px.

---

## Project structure

```
home-showings/
├── docker-compose.yml          # PostgreSQL 16
├── package.json                # workspaces + root scripts
├── server/
│   ├── src/
│   │   ├── app.ts / server.ts  # app factory (testable) / listener
│   │   ├── config/env.ts       # zod-validated env
│   │   ├── db/                 # pool, migrations/*.sql, migrate.ts, seed.ts
│   │   ├── lib/                # errors, shared zod validators
│   │   ├── middleware/         # requireAuth, requireRole, errorHandler
│   │   └── modules/
│   │       ├── auth/           # register, login, JWT cookie
│   │       ├── listings/       # seller CRUD + availability
│   │       ├── scheduling/     # slot engine (+ tests), search
│   │       └── showings/       # book, list, cancel
│   └── tests/                  # integration tests
└── client/
    └── src/
        ├── api/                # axios instance, typed endpoints, types
        ├── components/         # layout + small UI kit
        ├── features/
        │   ├── auth/           # session context, login, register
        │   ├── seller/         # listings, form, schedule editor
        │   ├── buyer/          # availability search, booking
        │   └── showings/       # list shared by both sides
        ├── hooks/useApi.ts
        ├── lib/format.ts       # Intl-based money / date / timezone formatting
        └── routes/RequireAuth.tsx
```

---

## What I'd do with more time

**Product**
- Seller approve / decline / reschedule flow, and notifications (email/SMS) with an `.ics` attachment.
- Save a buyer's availability and alert them when a matching opening appears.
- Listing detail page with photo uploads (S3) and a map; search by distance.
- Date-specific extra hours (e.g. an open house on one Sunday), not only weekly rules.
- Support multiple agents per listing and users with both roles.

**Engineering**
- One `PUT /listings/:id` that saves details + schedule in a single transaction (today the edit form
  makes two calls).
- Refresh tokens / session revocation, login rate limiting, password reset, email verification.
- Pagination for search, and caching of computed slots for popular homes.
- Playwright end-to-end tests and GitHub Actions CI (typecheck, unit + integration tests on every push).
- Deployment: API on Render/Fly, database on Neon, client on Vercel, with a Dockerfile for the API.
- OpenAPI spec generated from the zod schemas, shared types between client and server.

---

## How I used AI

I used Claude (Anthropic) as a pair programmer throughout the day. I set the scope and made the product
and architecture decisions: which project, the schema, the double-booking strategy, timezone handling,
and what to leave out. I used the AI to scaffold code faster, challenge those decisions, and write
tests. I reviewed and ran every part, tested each step myself (Postman, TablePlus, the browser), and
asked for changes where the result wasn't right (layout issues on wide screens, validation messages).
