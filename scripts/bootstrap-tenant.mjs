import pg from 'pg';
const required = ['DATABASE_URL','BOOTSTRAP_TENANT_NAME','BOOTSTRAP_ADMIN_EMAIL','BOOTSTRAP_ADMIN_NAME'];
for (const key of required) if (!process.env[key]) throw new Error(`${key} is required`);
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false' } : false, max: 1 });
const client = await pool.connect();
try {
  await client.query('BEGIN');
  const tenant = await client.query('INSERT INTO tenants(name) VALUES($1) RETURNING id', [process.env.BOOTSTRAP_TENANT_NAME]);
  const tenantId = tenant.rows[0].id;
  const user = await client.query("INSERT INTO users(tenant_id,display_name,email,status) VALUES($1,$2,$3,'active') RETURNING id", [tenantId, process.env.BOOTSTRAP_ADMIN_NAME, process.env.BOOTSTRAP_ADMIN_EMAIL.toLowerCase()]);
  const roleCodes = ['admin','customer','farmer','operator','mill_operator','finance','quality'];
  for (const code of roleCodes) await client.query('INSERT INTO roles(tenant_id,code,name) VALUES($1,$2,$3)', [tenantId,code,code.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase())]);
  await client.query("INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE tenant_id=$2 AND code='admin'", [user.rows[0].id,tenantId]);
  await client.query('COMMIT');
  process.stdout.write(JSON.stringify({tenantId,userId:user.rows[0].id,adminEmail:process.env.BOOTSTRAP_ADMIN_EMAIL,role:'admin'})+'\n');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
}
