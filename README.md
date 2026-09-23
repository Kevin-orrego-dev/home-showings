# Home Showings

A two-sided scheduling app for home showings:

- **Sellers** list their home and configure when it can be shown (allowed dates, weekly hours, blocked days).
- **Buyers** enter their own availability and only see homes that have open showing slots inside it, then book one in a click.

> Built for the One Day Build Challenge.

---

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React + Vite + TypeScript, React Router, axios |
| Backend | Node.js + Express 5 + TypeScript, zod |
| Database | PostgreSQL 16 |
| Tooling | npm workspaces (monorepo), Docker Compose, Vitest |

---

## Getting started

### Prerequisites

- Node.js 20+
- **One** of the following for the database:
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

This starts PostgreSQL 16 on **port 5433** and creates the `showings` database and user automatically
(see `docker-compose.yml`). Nothing else to do.

#### Option B — Existing local PostgreSQL

Connect as a superuser (psql, TablePlus, pgAdmin…) and run:

```sql
CREATE USER showings WITH PASSWORD 'showings';
CREATE DATABASE showings OWNER showings;
```

Then set `DATABASE_URL` in `server/.env` to your port (usually 5432):

```
DATABASE_URL=postgres://showings:showings@localhost:5432/showings
```

> Tables are **not** created by hand. They are created by the migrations in the next step,
> so every environment ends up with exactly the same schema.

### 3. Configure environment variables

```bash
cp server/.env.example server/.env        # macOS / Linux
copy server\.env.example server\.env      # Windows
```

### 4. Create the tables and demo data

```bash
npm run db:migrate   # creates the schema (runs server/src/db/migrations/*.sql)
npm run db:seed      # inserts demo users, listings and one booked showing
```

`npm run db:reset` drops everything and runs both again.

**Demo accounts** (password `password123` for all):

| Role | Email |
|---|---|
| Seller | `seller@demo.com`, `seller2@demo.com` |
| Buyer | `buyer@demo.com`, `buyer2@demo.com` |

### 5. Run the API

```bash
npm run dev:server
```

Check it at <http://localhost:4000/api/health> → `{"status":"ok"}`.

### Inspecting the database (optional)

Any Postgres client works (TablePlus, DBeaver, pgAdmin, psql). With the Docker setup:

| Field | Value |
|---|---|
| Host | `localhost` |
| Port | `5433` |
| User | `showings` |
| Password | `showings` |
| Database | `showings` |

---

## Assumptions & decisions

_To be completed as the project evolves._

## What I'd do with more time

_To be completed._
