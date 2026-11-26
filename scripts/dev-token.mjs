import { createHash, createHmac, randomUUID } from 'node:crypto';
import pg from 'pg';

if (process.env.NODE_ENV !== 'development') throw new Error('Development token generation is disabled outside NODE_ENV=development.');
const [userId,tenantId]=process.argv.slice(2);
if (!userId || !tenantId) throw new Error('Usage: node --env-file=.env scripts/dev-token.mjs <user-id> <tenant-id>');
if (typeof process.env.AUTH_JWT_SECRET !== 'string' || Buffer.byteLength(process.env.AUTH_JWT_SECRET)<32) throw new Error('AUTH_JWT_SECRET must contain at least 32 bytes.');
const now=Math.floor(Date.now()/1000);
const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
const header=encode({alg:'HS256',typ:'JWT'});
const claims=encode({sub:userId,tenant_id:tenantId,iss:process.env.AUTH_ISSUER,aud:process.env.AUTH_AUDIENCE,iat:now,exp:now+900,sid:randomUUID(),roles:['admin']});
const unsigned=header+'.'+claims;
const signature=createHmac('sha256',process.env.AUTH_JWT_SECRET).update(unsigned).digest('base64url');
const token=unsigned+'.'+signature;
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required to register a development session.');
const db=new pg.Pool({connectionString:process.env.DATABASE_URL});
try{await db.query('INSERT INTO user_sessions(id,tenant_id,user_id,token_hash,expires_at) VALUES($1,$2,$3,$4,to_timestamp($5))',[JSON.parse(Buffer.from(claims,'base64url')).sid,tenantId,userId,createHash('sha256').update(token).digest('hex'),now+900]);}
finally{await db.end();}
process.stdout.write(token+'\n');
