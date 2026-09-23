import pg from 'pg';
import { env } from '../config/env.js';

// Return Postgres DATE columns as plain 'YYYY-MM-DD' strings.
// By default pg converts them to JS Date at local midnight, which silently
// shifts the day depending on the server's timezone.
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value);

// One shared pool for the whole app: it reuses a handful of connections
// instead of opening a new one per request.
export const pool = new pg.Pool({ connectionString: env.DATABASE_URL });

// Either the pool or a client inside a transaction: both expose .query(),
// so functions typed with Db work in and out of transactions.
export type Db = pg.Pool | pg.PoolClient;

// Small helper so the rest of the code doesn't import pg directly.
export function query<T extends pg.QueryResultRow = any>(text: string, params?: unknown[]) {
  return pool.query<T>(text, params);
}

// Runs fn inside BEGIN/COMMIT and rolls back on any error.
export async function withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
