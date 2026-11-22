import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { bearerToken, verifyAccessToken } from '../src/security/jwt.mjs';

const secret='unit-test-secret-that-is-at-least-thirty-two-bytes-long';
function sign(claims,header={alg:'HS256',typ:'JWT'}) {
  const a=Buffer.from(JSON.stringify(header)).toString('base64url');
  const b=Buffer.from(JSON.stringify(claims)).toString('base64url');
  const signature=createHmac('sha256',secret).update(a+'.'+b).digest('base64url');
  return a+'.'+b+'.'+signature;
}
const claims={sub:'user-1',tenant_id:'tenant-1',iss:'https://identity.test/',aud:'kirani-api',exp:2_000_000_000,roles:['admin']};

test('verifies a correctly signed access token and returns identity claims',()=>{
  const result=verifyAccessToken(sign(claims),{secret,issuer:claims.iss,audience:claims.aud,now:1_900_000_000});
  assert.equal(result.userId,'user-1');
  assert.equal(result.tenantId,'tenant-1');
  assert.deepEqual(result.roles,['admin']);
});
test('rejects expired tokens and invalid issuer or audience',()=>{
  assert.throws(()=>verifyAccessToken(sign({...claims,exp:100}),{secret,now:101}));
  assert.throws(()=>verifyAccessToken(sign(claims),{secret,issuer:'https://wrong.test/',now:1_900_000_000}));
  assert.throws(()=>verifyAccessToken(sign(claims),{secret,audience:'other-api',now:1_900_000_000}));
});
test('rejects signature tampering and unsupported algorithms',()=>{
  const token=sign(claims);
  const parts=token.split('.');
  parts[2]=(parts[2][0]==='A'?'B':'A')+parts[2].slice(1);
  assert.throws(()=>verifyAccessToken(parts.join('.'),{secret,now:1_900_000_000}));
  assert.throws(()=>verifyAccessToken(sign(claims,{alg:'none',typ:'JWT'}),{secret,now:1_900_000_000}));
});
test('extracts only a strict bearer token',()=>{
  assert.equal(bearerToken('Bearer abc.def_1-2'),'abc.def_1-2');
  assert.equal(bearerToken('bearer abc'),null);
  assert.equal(bearerToken('Basic abc'),null);
  assert.equal(bearerToken(undefined),null);
});
