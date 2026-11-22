import pg from 'pg';

const ssl = process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false' } : false;
export const pool = process.env.DATABASE_URL
  ? new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl, max: Number(process.env.DB_POOL_MAX ?? 10), idleTimeoutMillis: 30_000, connectionTimeoutMillis: 5_000 })
  : null;

if (pool) {
  pool.on('error', error => process.stderr.write(JSON.stringify({ event: 'db_pool_error', message: error.message }) + '\n'));
}
