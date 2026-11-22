import { createHmac, randomUUID } from 'node:crypto';

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
process.stdout.write(unsigned+'.'+signature+'\n');
