import {createHmac,timingSafeEqual} from 'node:crypto';

export function verifyAccessToken(token,{secret,issuer,audience,now=Math.floor(Date.now()/1000)}={}){
  if(typeof token!=='string'||token.length>8192||typeof secret!=='string'||Buffer.byteLength(secret)<32)throw new Error('Invalid authentication configuration');
  const parts=token.split('.');
  if(parts.length!==3)throw new Error('Invalid token');
  let header,claims;
  try{header=JSON.parse(Buffer.from(parts[0],'base64url'));claims=JSON.parse(Buffer.from(parts[1],'base64url'))}
  catch{throw new Error('Invalid token')}
  if(!header||header.alg!=='HS256'||header.typ!=='JWT'||!claims||typeof claims!=='object')throw new Error('Unsupported token');
  const expected=createHmac('sha256',secret).update(parts[0]+'.'+parts[1]).digest();
  const supplied=Buffer.from(parts[2],'base64url');
  if(expected.length!==supplied.length||!timingSafeEqual(expected,supplied))throw new Error('Invalid token');
  if(typeof claims.sub!=='string'||!claims.sub.trim()||typeof claims.tenant_id!=='string'||!claims.tenant_id.trim()||
     !Number.isSafeInteger(claims.exp)||claims.exp<=now||
     claims.nbf!==undefined&&(!Number.isSafeInteger(claims.nbf)||claims.nbf>now))throw new Error('Expired or incomplete token');
  if(issuer&&claims.iss!==issuer)throw new Error('Invalid issuer');
  if(audience&&!(claims.aud===audience||Array.isArray(claims.aud)&&claims.aud.includes(audience)))throw new Error('Invalid audience');
  if(!Array.isArray(claims.roles)||claims.roles.some(role=>typeof role!=='string'||!role.trim()))throw new Error('Invalid roles');
  if(claims.sid!==undefined&&(typeof claims.sid!=='string'||!claims.sid.trim()))throw new Error('Invalid session');
  return Object.freeze({verified:true,userId:claims.sub,tenantId:claims.tenant_id,roles:[...new Set(claims.roles)],sessionId:claims.sid??null});
}
export function bearerToken(header){
  const match=typeof header==='string'&&/^Bearer ([A-Za-z0-9._~-]+)$/.exec(header);
  return match?.[1]??null;
}
