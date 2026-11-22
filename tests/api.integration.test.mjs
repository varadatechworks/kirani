import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { once } from 'node:events';
import pg from 'pg';

const databaseUrl=process.env.KIRANI_TEST_DATABASE_URL;
test('PostgreSQL-backed admin, farmer and customer API workflow', {skip:!databaseUrl}, async t=>{
  const pool=new pg.Pool({connectionString:databaseUrl});
  const port=41000+Math.floor(Math.random()*10000);
  const secret=process.env.AUTH_JWT_SECRET||'ci-kirani-integration-secret-at-least-32-bytes';
  const issuer=process.env.AUTH_ISSUER||'https://identity.kirani.test/';
  const audience=process.env.AUTH_AUDIENCE||'kirani-api';
  const child=spawn(process.execPath,['src/server.mjs'],{cwd:process.cwd(),env:{...process.env,DATABASE_URL:databaseUrl,PORT:String(port),AUTH_JWT_SECRET:secret,AUTH_ISSUER:issuer,AUTH_AUDIENCE:audience},stdio:'ignore'});
  t.after(async()=>{child.kill('SIGTERM');await Promise.race([once(child,'exit'),delay(3000)]);await pool.end();});
  const tenant=(await pool.query('INSERT INTO tenants(name) VALUES($1) RETURNING id',['CI Kirani '+randomUUID()])).rows[0].id;
  const roleIds={};
  for(const role of ['admin','farmer','customer'])roleIds[role]=(await pool.query('INSERT INTO roles(tenant_id,code,name) VALUES($1,$2,$3) RETURNING id',[tenant,role,role])).rows[0].id;
  const userIds={};
  for(const role of ['admin','farmer','customer'])userIds[role]=(await pool.query("INSERT INTO users(tenant_id,display_name,email,status) VALUES($1,$2,$3,'active') RETURNING id",[tenant,'CI '+role,role+'-'+randomUUID()+'@kirani.test'])).rows[0].id;
  for(const role of ['admin','farmer','customer'])await pool.query('INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)',[userIds[role],roleIds[role]]);
  const cycle=(await pool.query("INSERT INTO grocery_cycles(tenant_id,code,starts_on,delivery_from,delivery_to,cutoff_at,status) VALUES($1,$2,current_date,current_date,current_date+3,now()+interval '2 days','OPEN') RETURNING id",[tenant,'CI-'+randomUUID()])).rows[0].id;
  const token=role=>{const enc=v=>Buffer.from(JSON.stringify(v)).toString('base64url');const header=enc({alg:'HS256',typ:'JWT'});const claims=enc({sub:userIds[role],tenant_id:tenant,iss:issuer,aud:audience,iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+600,sid:randomUUID(),roles:[role]});const unsigned=header+'.'+claims;return unsigned+'.'+createHmac('sha256',secret).update(unsigned).digest('base64url');};
  const tokens={admin:token('admin'),farmer:token('farmer'),customer:token('customer')};
  const base='http://127.0.0.1:'+port;
  let ready=false;
  for(let i=0;i<100;i++){try{const response=await fetch(base+'/health/ready');if(response.ok){ready=true;break}}catch{}await delay(100)}
  assert.equal(ready,true,'API server should become ready against PostgreSQL');
  const call=async(role,path,options={})=>{const response=await fetch(base+'/api/v1'+path,{...options,headers:{authorization:'Bearer '+tokens[role],...(options.body?{'content-type':'application/json'}:{}),...(options.headers||{})}});const payload=await response.json();return {status:response.status,...payload};};

  const me=await call('admin','/session/me');
  assert.equal(me.status,200);assert.equal(me.data.roles[0],'admin');
  const dashboard=await call('admin','/admin/dashboard');
  assert.equal(dashboard.status,200);assert.equal(dashboard.data.openCycles,1);

  const product=await call('admin','/admin/catalogue/products',{method:'POST',body:JSON.stringify({sku:'CI-'+randomUUID(),name:'Integration Rice',category:'Grains',baseUnit:'KG',priceMinor:8500,currency:'INR'})});
  assert.equal(product.status,200);assert.equal(product.data.priceMinor,'8500');

  const listing=await call('farmer','/farmers/me/listings',{method:'POST',body:JSON.stringify({productId:product.data.id,availableQuantity:50,unitCode:'KG'})});
  assert.equal(listing.status,200);assert.equal(listing.data.status,'SUBMITTED');
  const pending=await call('admin','/admin/listings');
  assert.equal(pending.status,200);assert.equal(pending.data.length,1);
  const decision=await call('admin','/admin/listings/'+listing.data.id+'/decision',{method:'POST',body:JSON.stringify({decision:'approve',reason:'CI approval verification'})});
  assert.equal(decision.status,200);assert.equal(decision.data.status,'APPROVED');

  const catalogue=await call('customer','/catalogue/products');
  assert.equal(catalogue.status,200);assert.equal(catalogue.data[0].approvedFarmerListings,1);
  const saved=await call('customer','/customers/me/recurring-basket',{method:'PUT',body:JSON.stringify({cycleId:cycle,items:[{productId:product.data.id,quantity:2,substitutionPolicy:'ASK_CUSTOMER'}]})});
  assert.equal(saved.status,200);assert.equal(saved.data.version,1);
  const basket=await call('customer','/customers/me/recurring-basket');
  assert.equal(basket.status,200);assert.equal(basket.data.items.length,1);assert.equal(basket.data.items[0].quantity,'2.000');
  const address=await call('customer','/customers/me/addresses',{method:'POST',body:JSON.stringify({label:'Home',recipientName:'CI Customer',phone:'+919876543210',line1:'12 Test Road',locality:'Test Layout',city:'Bengaluru',state:'Karnataka',postalCode:'560001',isDefault:true})});
  assert.equal(address.status,200);assert.equal(address.data.isDefault,true);
  const addresses=await call('customer','/customers/me/addresses');
  assert.equal(addresses.status,200);assert.equal(addresses.data.length,1);
  const deliveryDate=(await pool.query('SELECT (current_date+1)::text AS d')).rows[0].d;
  const preview=await call('customer','/customers/me/orders/preview',{method:'POST',body:JSON.stringify({cycleId:cycle,addressId:address.data.id,deliveryDate})});
  assert.equal(preview.status,200);assert.equal(preview.data.items.length,1);assert.equal(preview.data.totalMinor,'17000');
  const idempotencyKey='ci-order-'+randomUUID();
  const orderOptions={method:'POST',headers:{'idempotency-key':idempotencyKey},body:JSON.stringify({cycleId:cycle,addressId:address.data.id,deliveryDate})};
  const simultaneous=await Promise.all([call('customer','/customers/me/orders',orderOptions),call('customer','/customers/me/orders',orderOptions)]);
  assert.equal(simultaneous.every(x=>x.status===200),true);assert.equal(simultaneous[0].data.id,simultaneous[1].data.id);
  assert.equal(simultaneous.filter(x=>x.data.idempotentReplay).length,1);
  const order=simultaneous[0];
  assert.equal(order.data.fulfilmentStatus,'PLACED');assert.equal(order.data.totalMinor,'17000');
  const replay=await call('customer','/customers/me/orders',orderOptions);
  assert.equal(replay.status,200);assert.equal(replay.data.id,order.data.id);assert.equal(replay.data.idempotentReplay,true);
  const orderDetail=await call('customer','/orders/'+order.data.id);
  assert.equal(orderDetail.status,200);assert.equal(orderDetail.data.items.length,1);assert.equal(orderDetail.data.deliveryAddress.postalCode,'560001');
  const cancelled=await call('customer','/orders/'+order.data.id+'/cancel',{method:'POST',body:JSON.stringify({reason:'Customer requested cancellation'})});
  assert.equal(cancelled.status,200);assert.equal(cancelled.data.fulfilmentStatus,'CANCELLED');
  const secondCancel=await call('customer','/orders/'+order.data.id+'/cancel',{method:'POST',body:JSON.stringify({reason:'Duplicate cancellation attempt'})});
  assert.equal(secondCancel.status,409);
  const adminAddressAccess=await call('admin','/customers/me/addresses');
  assert.equal(adminAddressAccess.status,403);

  const forbidden=await call('customer','/admin/dashboard');
  assert.equal(forbidden.status,403);
});
