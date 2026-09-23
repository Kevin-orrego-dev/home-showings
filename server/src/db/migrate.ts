import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './pool.js';

// Minimal migration runner:
// 1. Reads every .sql file in ./migrations, sorted by name (001_, 002_, ...).
// 2. Skips the ones already recorded in the schema_migrations table.
// 3. Runs each pending file inside its own transaction and records it.
// If a migration fails, its transaction rolls back and nothing half-applied remains.

const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
  const { rows } = await pool.query<{ name: string }>('SELECT name FROM schema_migrations');
  const applied = new Set(rows.map((r) => r.name));

  const pending = files.filter((f) => !applied.has(f));
  if (pending.length === 0) {
    console.log('Database is up to date.');
    return;
  }

  for (const file of pending) {
    const sql = await readFile(path.join(migrationsDir, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`Applied ${file}`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`Failed on ${file}:`, err);
      throw err;
    } finally {
      client.release();
    }
  }
}

// --reset drops everything first. Handy during development, never used in prod.
async function main() {
  if (process.argv.includes('--reset')) {
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    console.log('Schema reset.');
  }
  await migrate();
}

main()
  .catch(() => {
    process.exitCode = 1;
  })
  .finally(() => pool.end());
