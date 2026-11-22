import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false' } : false, max: 1 });
const dir = resolve(fileURLToPath(new URL('../../migrations/', import.meta.url)));
const client = await pool.connect();
try {
  await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
  const files = (await readdir(dir)).filter(name => /^\d+_[a-z0-9_-]+\.sql$/.test(name)).sort();
  for (const name of files) {
    const sql = await readFile(resolve(dir, name), 'utf8');
    const checksum = createHash('sha256').update(sql).digest('hex');
    const existing = await client.query('SELECT checksum FROM schema_migrations WHERE version=$1', [name]);
    if (existing.rowCount) {
      if (existing.rows[0].checksum !== checksum) throw new Error(`Applied migration checksum changed: ${name}`);
      continue;
    }
    if (name.startsWith('0001_')) {
      const baseline = await client.query(`SELECT count(*)::int AS present FROM unnest(ARRAY['tenants','users','roles','user_roles','products','grocery_cycles','baskets','basket_versions','basket_items','orders','order_items','farmer_listings','audit_events','idempotency_keys']) AS required(name) WHERE to_regclass('public.' || name) IS NOT NULL`);
      if (baseline.rows[0].present === 14) {
        await client.query('INSERT INTO schema_migrations(version,checksum) VALUES($1,$2)', [name, checksum]);
        process.stdout.write(`adopted existing schema baseline ${name}\n`);
        continue;
      }
    }
    const migration = sql.replace(/^\s*BEGIN\s*;\s*/i, '').replace(/\s*COMMIT\s*;\s*$/i, '');
    await client.query('BEGIN');
    try {
      await client.query(migration);
      await client.query('INSERT INTO schema_migrations(version,checksum) VALUES($1,$2)', [name, checksum]);
      await client.query('COMMIT');
      process.stdout.write(`applied ${name}\n`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }
} finally {
  client.release();
  await pool.end();
}
