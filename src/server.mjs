import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './db/pool.mjs';
import { bearerToken, verifyAccessToken } from './security/jwt.mjs';
import { correlationId } from './shared/skeleton/observability.mjs';
import { handleOrderRoutes } from './orders/routes.mjs';
import { handleFarmerProcurementRoutes } from './procurement/routes.mjs';
import { handleGoodsReceiptRoutes } from './receiving/routes.mjs';
import { handleInventoryRoutes } from './inventory/routes.mjs';
import { handleProcessingRoutes } from './processing/routes.mjs';
import { handlePackingRoutes, handlePublicTrace } from './packing/routes.mjs';
import { handleDeliveryRoutes } from './delivery/routes.mjs';
import { handleLoyaltyRoutes } from './loyalty/routes.mjs';
import { handleEngagementRoutes } from './engagement/routes.mjs';
import { handleFinanceRoutes } from './finance/routes.mjs';
import { createRateLimiter } from './security/rate-limit.mjs';

const port = Number(process.env.PORT ?? 3000);
const root = resolve(fileURLToPath(new URL('../public/', import.meta.url)));
const types = { '.html':'text/html; charset=utf-8', '.webmanifest':'application/manifest+json; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.svg':'image/svg+xml' };
const rateLimit=createRateLimiter({limit:Number(process.env.API_RATE_LIMIT_PER_MINUTE??120),windowMs:Number(process.env.API_RATE_WINDOW_MS??60_000),trustProxy:process.env.TRUST_PROXY==='true'});
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
class HttpError extends Error { constructor(status,code,message){super(message);this.status=status;this.code=code;} }
const fail=(status,code,message)=>{throw new HttpError(status,code,message)};
const send=(res,statusOrData,dataOrCid,cid)=>{const status=typeof statusOrData==='number'?statusOrData:200;const data=typeof statusOrData==='number'?dataOrCid:statusOrData;const correlation=typeof statusOrData==='number'?cid:dataOrCid;res.writeHead(status,{'content-type':'application/json; charset=utf-8'});res.end(JSON.stringify({data,meta:{correlationId:correlation,version:'v1'}}));};
const sendError=(res,error,cid)=>{const status=error instanceof HttpError?error.status:error?.code==='23505'?409:error?.code==='23503'||error?.code==='22P02'?422:500;const code=error instanceof HttpError?error.code:error?.code==='23505'?'DUPLICATE_RECORD':error?.code==='23503'||error?.code==='22P02'?'DATA_VALIDATION':'INTERNAL_ERROR';const messages={400:'Please check the submitted information.',401:'Please sign in again.',403:'You do not have permission for this action.',404:'We could not find that record.',409:'This record changed or the requested action conflicts with its current state.',413:'The submitted request is too large.',415:'Please submit JSON data.',422:'The information does not meet the business rules.',429:'Too many requests. Please try again shortly.',500:'Something went wrong. Please try again.',503:'Kirani services are temporarily unavailable.'};res.writeHead(status,{'content-type':'application/json; charset=utf-8'});res.end(JSON.stringify({error:{code,message:error instanceof HttpError?error.message:(messages[status]??messages[500]),fieldErrors:[],correlationId:cid}}));};
const bodyJson=async req=>{if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']??''))fail(415,'JSON_REQUIRED','Please submit this form as JSON.');let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>1_000_000)fail(413,'BODY_TOO_LARGE','Request body exceeds 1 MB.');}if(!raw)return {};try{return JSON.parse(raw);}catch{fail(400,'INVALID_JSON','Request body must be valid JSON.');}};
const requireDb=()=>{if(!pool)fail(503,'DATABASE_NOT_CONFIGURED','Database connection is not configured.');return pool;};
const requireRole=(auth,...roles)=>{if(!roles.some(role=>auth.roles.includes(role)))fail(403,'FORBIDDEN','Your account does not have access to this workspace.');};
const audit=async(client,auth,cid,action,resource,resourceId,metadata={})=>{await client.query('INSERT INTO audit_events(tenant_id,actor_id,action,resource,resource_id,outcome,metadata,correlation_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[auth.tenantId,auth.userId,action,resource,String(resourceId??''),'success',JSON.stringify(metadata),cid]);};
const transaction=async fn=>{const db=requireDb();const client=await db.connect();try{await client.query('BEGIN');const value=await fn(client);await client.query('COMMIT');return value;}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}};
const authenticate=async req=>{
  const token=bearerToken(req.headers.authorization);
  if(!token)fail(401,'AUTH_REQUIRED','Please sign in to continue.');
  let claims;
  try{claims=verifyAccessToken(token,{secret:process.env.AUTH_JWT_SECRET,issuer:process.env.AUTH_ISSUER,audience:process.env.AUTH_AUDIENCE});}
  catch{fail(401,'AUTH_INVALID','Your sign-in token is invalid or expired.');}
  const db=requireDb();
  const result=await db.query(`SELECT u.id,u.tenant_id,u.display_name,u.email,u.phone,u.status,u.locale,
    COALESCE(array_agg(DISTINCT r.code) FILTER(WHERE r.code IS NOT NULL),'{}') AS roles
    FROM users u LEFT JOIN user_roles ur ON ur.user_id=u.id LEFT JOIN roles r ON r.id=ur.role_id AND r.tenant_id=u.tenant_id
    WHERE u.id=$1 AND u.tenant_id=$2 GROUP BY u.id`,[claims.userId,claims.tenantId]);
  if(!result.rowCount||result.rows[0].status!=='active')fail(401,'ACCOUNT_INACTIVE','This account is not active. Contact Kirani support.');
  const user=result.rows[0];
  if(!user.roles.length)fail(403,'ROLE_NOT_ASSIGNED','Your account has no active workspace role.');
  return {userId:user.id,tenantId:user.tenant_id,displayName:user.display_name,email:user.email,phone:user.phone,locale:user.locale,roles:user.roles,sessionId:claims.sessionId};
};
const productShape=r=>({id:r.id,sku:r.sku,name:r.name,description:r.description,category:r.category,baseUnit:r.base_unit,priceMinor:String(r.price_minor),currency:String(r.currency??'INR').trim(),active:r.active,approvedFarmerListings:Number(r.approved_farmer_listings??0)});
const cycleShape=r=>({id:r.id,code:r.code,startsOn:String(r.starts_on).slice(0,10),deliveryFrom:String(r.delivery_from).slice(0,10),deliveryTo:String(r.delivery_to).slice(0,10),cutoffAt:r.cutoff_at,status:r.status});
const orderShape=r=>({id:r.id,customerId:r.customer_id,cycleId:r.cycle_id,orderType:r.order_type,fulfilmentStatus:r.fulfilment_status,paymentStatus:r.payment_status,currency:String(r.currency??'INR').trim(),subtotalMinor:String(r.subtotal_minor),discountMinor:String(r.discount_minor),taxMinor:String(r.tax_minor),totalMinor:String(r.total_minor),createdAt:r.created_at});
async function route(req,res,cid){
  const url=new URL(req.url,'http://kirani.local');const path=url.pathname;const method=req.method;
  if(method==='GET'&&path==='/health/live')return send(res,200,{status:'ok',service:'kirani'},cid);
  if(method==='GET'&&path==='/health/ready'){
    if(!pool)fail(503,'DATABASE_NOT_CONFIGURED','Database connection is not configured.');
    try{await pool.query('SELECT 1');return send(res,200,{status:'ready',database:'connected'},cid);}catch{fail(503,'DATABASE_UNAVAILABLE','Database is not reachable.');}
  }
  if(method==='GET'&&(path==='/'||path==='/index.html'||path==='/manifest.webmanifest')){
    const file=path==='/manifest.webmanifest'?'manifest.webmanifest':'index.html';
    const content=await readFile(resolve(root,file));
    res.writeHead(200,{'content-type':types[extname(file)],'content-security-policy':"default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'"});return res.end(content);
  }
  if(!path.startsWith('/api/v1/'))fail(404,'NOT_FOUND','That page is not available.');
  const publicDb=requireDb();if(await handlePublicTrace({req,res,cid,path,method,db:publicDb,send,fail}))return;
  const auth=await authenticate(req);const db=requireDb();

  if(method==='GET'&&path==='/api/v1/session/me')return send(res,{id:auth.userId,tenantId:auth.tenantId,displayName:auth.displayName,email:auth.email,phone:auth.phone,locale:auth.locale,roles:auth.roles},cid);

  if(method==='GET'&&path==='/api/v1/admin/dashboard'){
    requireRole(auth,'admin');
    const [orders,farmers,listings,cycles,procurement]=await Promise.all([
      db.query("SELECT count(*)::int AS total FROM orders WHERE tenant_id=$1 AND created_at>=date_trunc('month',now())",[auth.tenantId]),
      db.query("SELECT count(DISTINCT u.id)::int AS total FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id WHERE u.tenant_id=$1 AND r.code='farmer' AND u.status='active'",[auth.tenantId]),
      db.query("SELECT count(*)::int AS pending FROM farmer_listings WHERE tenant_id=$1 AND status IN ('SUBMITTED','UNDER_REVIEW')",[auth.tenantId]),
      db.query("SELECT count(*)::int AS open FROM grocery_cycles WHERE tenant_id=$1 AND status='OPEN' AND cutoff_at>now()",[auth.tenantId]),
      db.query("SELECT COALESCE(sum(total_minor),0)::text AS total FROM orders WHERE tenant_id=$1 AND created_at>=date_trunc('month',now())",[auth.tenantId])
    ]);
    return send(res,{ordersThisMonth:orders.rows[0].total,activeFarmers:farmers.rows[0].total,pendingListings:listings.rows[0].pending,openCycles:cycles.rows[0].open,orderValueMinor:procurement.rows[0].total},cid);
  }

  if(method==='GET'&&path==='/api/v1/catalogue/products'){
    const result=await db.query(`SELECT p.*,count(fl.id) FILTER(WHERE fl.status='APPROVED') AS approved_farmer_listings
      FROM products p LEFT JOIN farmer_listings fl ON fl.product_id=p.id AND fl.tenant_id=p.tenant_id
      WHERE p.tenant_id=$1 AND p.active=true GROUP BY p.id ORDER BY p.category,p.name LIMIT 100`,[auth.tenantId]);
    return send(res,result.rows.map(productShape),cid);
  }
  if(method==='POST'&&path==='/api/v1/admin/catalogue/products'){
    requireRole(auth,'admin');const b=await bodyJson(req);
    if(!b.sku||!b.name||!b.category||!b.baseUnit||!Number.isSafeInteger(b.priceMinor)||b.priceMinor<0)fail(422,'PRODUCT_VALIDATION','SKU, name, category, unit and a non-negative integer price are required.');
    const created=await transaction(async c=>{const r=await c.query('INSERT INTO products(tenant_id,sku,name,description,category,base_unit,price_minor,currency) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',[auth.tenantId,String(b.sku).trim(),String(b.name).trim(),b.description??null,String(b.category).trim(),String(b.baseUnit).trim().toUpperCase(),b.priceMinor,b.currency??'INR']);await audit(c,auth,cid,'product.created','product',r.rows[0].id);return r.rows[0];});
    return send(res,productShape(created),cid);
  }

  if(method==='GET'&&path==='/api/v1/monthly-cycles/current'){
    const r=await db.query("SELECT * FROM grocery_cycles WHERE tenant_id=$1 AND status='OPEN' AND cutoff_at>now() ORDER BY cutoff_at ASC LIMIT 1",[auth.tenantId]);
    return send(res,r.rowCount?cycleShape(r.rows[0]):null,cid);
  }
  if(method==='GET'&&path==='/api/v1/admin/monthly-cycles'){
    requireRole(auth,'admin');const r=await db.query('SELECT * FROM grocery_cycles WHERE tenant_id=$1 ORDER BY starts_on DESC LIMIT 100',[auth.tenantId]);return send(res,r.rows.map(cycleShape),cid);
  }
  if(method==='POST'&&path==='/api/v1/admin/monthly-cycles'){
    requireRole(auth,'admin');const b=await bodyJson(req);
    if(!b.code||!b.startsOn||!b.deliveryFrom||!b.deliveryTo||!b.cutoffAt||![b.startsOn,b.deliveryFrom,b.deliveryTo].every(x=>/^\d{4}-\d{2}-\d{2}$/.test(x))||!Number.isFinite(Date.parse(b.cutoffAt)))fail(422,'CYCLE_VALIDATION','Provide a cycle code, valid dates and cutoff timestamp.');
    const status='DRAFT';
    const r=await transaction(async c=>{const q=await c.query('INSERT INTO grocery_cycles(tenant_id,code,starts_on,delivery_from,delivery_to,cutoff_at,status) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',[auth.tenantId,String(b.code).trim(),b.startsOn,b.deliveryFrom,b.deliveryTo,b.cutoffAt,status]);await audit(c,auth,cid,'cycle.created','grocery_cycle',q.rows[0].id);return q.rows[0];});
    return send(res,cycleShape(r),cid);
  }

  const openCycle=path.match(new RegExp('^/api/v1/admin/monthly-cycles/([0-9a-f-]+)/open$','i'));
  if(method==='POST'&&openCycle){
    requireRole(auth,'admin');if(!uuid.test(openCycle[1]))fail(404,'CYCLE_NOT_FOUND','Cycle was not found.');
    const r=await transaction(async c=>{const existing=await c.query("SELECT id FROM grocery_cycles WHERE tenant_id=$1 AND status='OPEN' AND cutoff_at>now() FOR UPDATE",[auth.tenantId]);if(existing.rowCount)fail(409,'OPEN_CYCLE_EXISTS','Close the current cycle before opening another.');const q=await c.query("UPDATE grocery_cycles SET status='OPEN' WHERE id=$1 AND tenant_id=$2 AND status='DRAFT' AND cutoff_at>now() RETURNING *",[openCycle[1],auth.tenantId]);if(!q.rowCount)fail(409,'CYCLE_CANNOT_OPEN','Only a future draft cycle can be opened.');await audit(c,auth,cid,'cycle.opened','grocery_cycle',q.rows[0].id);return q.rows[0];});
    return send(res,cycleShape(r),cid);
  }

  const closeCycle=path.match(new RegExp('^/api/v1/admin/monthly-cycles/([0-9a-f-]+)/close$','i'));
  if(method==='POST'&&closeCycle){
    requireRole(auth,'admin');if(!uuid.test(closeCycle[1]))fail(404,'CYCLE_NOT_FOUND','Cycle was not found.');
    const r=await transaction(async c=>{const q=await c.query("UPDATE grocery_cycles SET status='CLOSED' WHERE id=$1 AND tenant_id=$2 AND status='OPEN' RETURNING *",[closeCycle[1],auth.tenantId]);if(!q.rowCount)fail(409,'CYCLE_NOT_OPEN','Only an open cycle can be closed.');await audit(c,auth,cid,'cycle.closed','grocery_cycle',q.rows[0].id);return q.rows[0];});
    return send(res,cycleShape(r),cid);
  }

  if(method==='GET'&&path==='/api/v1/customers/me/recurring-basket'){
    requireRole(auth,'customer');const r=await db.query(`SELECT b.id AS basket_id,b.status AS basket_status,bv.id AS version_id,bv.version,bv.effective_cycle_id,bi.product_id,bi.quantity::text,bi.unit_code,bi.substitution_policy,p.name,p.price_minor,p.currency
      FROM baskets b LEFT JOIN LATERAL (SELECT * FROM basket_versions WHERE basket_id=b.id ORDER BY version DESC LIMIT 1) bv ON true
      LEFT JOIN basket_items bi ON bi.basket_version_id=bv.id LEFT JOIN products p ON p.id=bi.product_id
      WHERE b.tenant_id=$1 AND b.customer_id=$2 ORDER BY bi.id NULLS LAST`,[auth.tenantId,auth.userId]);
    if(!r.rowCount)return send(res,null,cid);
    const first=r.rows[0];return send(res,{id:first.basket_id,status:first.basket_status,version:first.version??0,effectiveCycleId:first.effective_cycle_id,items:r.rows.filter(x=>x.product_id).map(x=>({productId:x.product_id,name:x.name,quantity:x.quantity,unitCode:x.unit_code,substitutionPolicy:x.substitution_policy,priceMinor:String(x.price_minor),currency:x.currency}))},cid);
  }
  if(method==='PUT'&&path==='/api/v1/customers/me/recurring-basket'){
    requireRole(auth,'customer');const b=await bodyJson(req);
    if(!uuid.test(b.cycleId)||!Array.isArray(b.items)||b.items.length<1||b.items.length>100)fail(422,'BASKET_VALIDATION','Choose an open cycle and between 1 and 100 basket items.');
    const ids=new Set();for(const i of b.items){if(!uuid.test(i.productId)||ids.has(i.productId)||!Number.isFinite(Number(i.quantity))||Number(i.quantity)<=0||Number(i.quantity)>10000||Math.round(Number(i.quantity)*1000)!==Number(i.quantity)*1000)fail(422,'BASKET_ITEM_INVALID','Basket items must have unique products and valid quantities.');ids.add(i.productId);}
    const result=await transaction(async c=>{
      const cycle=await c.query("SELECT * FROM grocery_cycles WHERE id=$1 AND tenant_id=$2 AND status='OPEN' AND cutoff_at>now() FOR UPDATE",[b.cycleId,auth.tenantId]);
      if(!cycle.rowCount)fail(409,'CYCLE_CLOSED','This cycle is no longer accepting basket changes.');
      const productRows=await c.query('SELECT id,base_unit FROM products WHERE tenant_id=$1 AND active=true AND id=ANY($2::uuid[])',[auth.tenantId,[...ids]]);
      if(productRows.rowCount!==ids.size)fail(422,'PRODUCT_UNAVAILABLE','One or more selected products are unavailable.');
      const basket=await c.query("INSERT INTO baskets(tenant_id,customer_id) VALUES($1,$2) ON CONFLICT(tenant_id,customer_id) DO UPDATE SET customer_id=EXCLUDED.customer_id RETURNING id",[auth.tenantId,auth.userId]);
      const next=await c.query('SELECT COALESCE(max(version),0)+1 AS version FROM basket_versions WHERE basket_id=$1',[basket.rows[0].id]);
      const version=next.rows[0].version;
      const bv=await c.query('INSERT INTO basket_versions(basket_id,version,effective_cycle_id,created_by) VALUES($1,$2,$3,$4) RETURNING id',[basket.rows[0].id,version,b.cycleId,auth.userId]);
      for(const item of b.items){const product=productRows.rows.find(p=>p.id===item.productId);const policy=item.substitutionPolicy??'ASK_CUSTOMER';if(!['NO_SUBSTITUTION','ASK_CUSTOMER','PREAPPROVED_ONLY'].includes(policy))fail(422,'SUBSTITUTION_POLICY_INVALID','Choose a valid substitution preference.');await c.query('INSERT INTO basket_items(basket_version_id,product_id,quantity,unit_code,substitution_policy) VALUES($1,$2,$3,$4,$5)',[bv.rows[0].id,item.productId,Number(item.quantity),String(item.unitCode??product.base_unit).toUpperCase(),policy]);}
      await audit(c,auth,cid,'basket.version_saved','basket',basket.rows[0].id,{version});
      return {id:basket.rows[0].id,version,effectiveCycleId:b.cycleId,items:b.items};
    });
    return send(res,result,cid);
  }

  if(method==='GET'&&path==='/api/v1/farmers/me/listings'){
    requireRole(auth,'farmer');const r=await db.query('SELECT fl.*,p.name AS product_name,p.sku FROM farmer_listings fl JOIN products p ON p.id=fl.product_id WHERE fl.tenant_id=$1 AND fl.farmer_id=$2 ORDER BY fl.created_at DESC LIMIT 100',[auth.tenantId,auth.userId]);
    return send(res,r.rows.map(x=>({id:x.id,productId:x.product_id,productName:x.product_name,sku:x.sku,availableQuantity:x.available_quantity,allocatedQuantity:x.allocated_quantity??0,unitCode:x.unit_code,priceMinor:x.price_minor===null?null:String(x.price_minor),status:x.status,reviewNote:x.review_note,createdAt:x.created_at})),cid);
  }
  if(method==='POST'&&path==='/api/v1/farmers/me/listings'){
    requireRole(auth,'farmer');const b=await bodyJson(req);
    if(!uuid.test(b.productId)||!Number.isFinite(Number(b.availableQuantity))||Number(b.availableQuantity)<=0||Number(b.availableQuantity)>1000000||!b.unitCode)fail(422,'LISTING_VALIDATION','Select a product and enter a valid available quantity and unit.');
    const r=await transaction(async c=>{const p=await c.query('SELECT id FROM products WHERE id=$1 AND tenant_id=$2 AND active=true',[b.productId,auth.tenantId]);if(!p.rowCount)fail(404,'PRODUCT_NOT_FOUND','The selected product is not available.');const q=await c.query("INSERT INTO farmer_listings(tenant_id,farmer_id,product_id,available_quantity,unit_code,price_minor,status) VALUES($1,$2,$3,$4,$5,$6,'SUBMITTED') RETURNING *",[auth.tenantId,auth.userId,b.productId,Number(b.availableQuantity),String(b.unitCode).toUpperCase(),b.priceMinor??null]);await audit(c,auth,cid,'farmer_listing.submitted','farmer_listing',q.rows[0].id);return q.rows[0];});
    return send(res,{id:r.id,status:r.status,productId:r.product_id,availableQuantity:r.available_quantity,unitCode:r.unit_code},cid);
  }
  if(method==='GET'&&path==='/api/v1/admin/listings'){
    requireRole(auth,'admin');const r=await db.query('SELECT fl.*,p.name AS product_name,u.display_name AS farmer_name FROM farmer_listings fl JOIN products p ON p.id=fl.product_id JOIN users u ON u.id=fl.farmer_id WHERE fl.tenant_id=$1 ORDER BY fl.created_at DESC LIMIT 100',[auth.tenantId]);
    return send(res,r.rows.map(x=>({id:x.id,farmerId:x.farmer_id,farmerName:x.farmer_name,productId:x.product_id,productName:x.product_name,availableQuantity:x.available_quantity,unitCode:x.unit_code,priceMinor:x.price_minor===null?null:String(x.price_minor),status:x.status,reviewNote:x.review_note,createdAt:x.created_at})),cid);
  }
  const decision=path.match(new RegExp('^/api/v1/admin/listings/([0-9a-f-]+)/decision$','i'));
  if(method==='POST'&&decision){
    requireRole(auth,'admin');const b=await bodyJson(req);const statusMap={approve:'APPROVED',reject:'REJECTED',request_changes:'CHANGES_REQUESTED',suspend:'SUSPENDED'};
    if(!uuid.test(decision[1])||!statusMap[b.decision]||typeof b.reason!=='string'||b.reason.trim().length<3)fail(422,'LISTING_DECISION_INVALID','Choose a decision and provide a reason.');
    const r=await transaction(async c=>{const q=await c.query('SELECT * FROM farmer_listings WHERE id=$1 AND tenant_id=$2 FOR UPDATE',[decision[1],auth.tenantId]);if(!q.rowCount)fail(404,'LISTING_NOT_FOUND','Listing was not found.');if(q.rows[0].farmer_id===auth.userId)fail(403,'MAKER_CHECKER_REQUIRED','A farmer cannot approve their own listing.');const next=statusMap[b.decision];const allowed={SUBMITTED:['APPROVED','REJECTED','CHANGES_REQUESTED'],UNDER_REVIEW:['APPROVED','REJECTED','CHANGES_REQUESTED'],APPROVED:['SUSPENDED'],SUSPENDED:['APPROVED','REJECTED']};if(!allowed[q.rows[0].status]?.includes(next))fail(409,'LISTING_STATE_CONFLICT','This listing cannot receive that decision in its current state.');const u=await c.query('UPDATE farmer_listings SET status=$1,reviewed_by=$2,reviewed_at=now(),review_note=$3 WHERE id=$4 RETURNING *',[next,auth.userId,b.reason.trim(),decision[1]]);await audit(c,auth,cid,'farmer_listing.'+b.decision,'farmer_listing',decision[1],{reason:b.reason.trim()});return u.rows[0];});
    return send(res,{id:r.id,status:r.status,reviewNote:r.review_note},cid);
  }

  if(await handleOrderRoutes({req,res,cid,path,method,auth,db,bodyJson,transaction,audit,send,fail,requireRole,uuid}))return;
  if(await handleFarmerProcurementRoutes({req,res,cid,path,method,auth,db,bodyJson,transaction,audit,send,fail,requireRole,uuid}))return;
  if(await handleGoodsReceiptRoutes({req,res,cid,path,method,auth,db,url,bodyJson,transaction,audit,send,fail,requireRole,uuid}))return;
  if(await handleInventoryRoutes({req,res,cid,path,method,auth,db,url,bodyJson,transaction,audit,send,fail,requireRole,uuid}))return;
  if(await handleProcessingRoutes({req,res,cid,path,method,auth,db,url,bodyJson,transaction,audit,send,fail,requireRole,uuid}))return;
  if(await handlePackingRoutes({req,res,cid,path,method,auth,db,bodyJson,transaction,audit,send,fail,requireRole,uuid}))return;
  if(await handleDeliveryRoutes({req,res,cid,path,method,auth,db,bodyJson,transaction,audit,send,fail,requireRole,uuid}))return;
  if(await handleLoyaltyRoutes({req,res,cid,path,method,auth,db,bodyJson,transaction,audit,send,fail,requireRole}))return;
  if(await handleEngagementRoutes({req,res,cid,path,method,auth,db,bodyJson,transaction,audit,send,fail,requireRole}))return;
  if(await handleFinanceRoutes({req,res,cid,path,method,auth,db,bodyJson,transaction,audit,send,fail,requireRole}))return;

  if(method==='GET'&&(path==='/api/v1/customers/me/orders'||path==='/api/v1/admin/orders')){
    if(path.includes('/admin/'))requireRole(auth,'admin');else requireRole(auth,'customer');
    const limit=Math.min(100,Math.max(1,Number(url.searchParams.get('limit')??25)||25));
    const r=path.includes('/admin/')?await db.query('SELECT * FROM orders WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2',[auth.tenantId,limit]):await db.query('SELECT * FROM orders WHERE tenant_id=$1 AND customer_id=$2 ORDER BY created_at DESC LIMIT $3',[auth.tenantId,auth.userId,limit]);
    return send(res,r.rows.map(orderShape),cid);
  }
  const orderMatch=path.match(new RegExp('^/api/v1/orders/([0-9a-f-]+)$','i'));
  if(method==='GET'&&orderMatch){
    if(!uuid.test(orderMatch[1]))fail(404,'ORDER_NOT_FOUND','Order was not found.');
    const r=await db.query('SELECT * FROM orders WHERE id=$1 AND tenant_id=$2 AND ($3::boolean OR customer_id=$4)',[orderMatch[1],auth.tenantId,auth.roles.includes('admin'),auth.userId]);
    if(!r.rowCount)fail(404,'ORDER_NOT_FOUND','Order was not found.');return send(res,orderShape(r.rows[0]),cid);
  }
  fail(404,'ENDPOINT_NOT_FOUND','This Kirani workflow is not available yet.');
}
const server=http.createServer(async(req,res)=>{
  const cid=correlationId(req.headers['x-correlation-id']);res.setHeader('x-correlation-id',cid);res.setHeader('x-content-type-options','nosniff');res.setHeader('referrer-policy','strict-origin-when-cross-origin');res.setHeader('permissions-policy','camera=(), microphone=(), geolocation=()');res.setHeader('cache-control','no-store');res.setHeader('x-frame-options','DENY');res.setHeader('content-security-policy',"frame-ancestors 'none'");res.setHeader('cross-origin-resource-policy','same-origin');
  if(req.socket?.encrypted||process.env.TRUST_PROXY==='true'&&req.headers['x-forwarded-proto']==='https')res.setHeader('strict-transport-security','max-age=31536000; includeSubDomains');
  if(String(req.url||'').startsWith('/api/')){const rate=rateLimit.consume(req);res.setHeader('x-ratelimit-limit',String(rate.limit));res.setHeader('x-ratelimit-remaining',String(rate.remaining));res.setHeader('x-ratelimit-reset',String(Math.ceil(rate.resetAt/1000)));if(!rate.allowed){res.statusCode=429;res.setHeader('retry-after',String(rate.retryAfterSeconds));res.setHeader('content-type','application/json; charset=utf-8');res.end(JSON.stringify({error:{code:'RATE_LIMITED',message:'Too many requests. Please retry after the indicated interval.'},correlationId:cid}));return;}}
  try{await route(req,res,cid);}catch(error){if(!(error instanceof HttpError))process.stderr.write(JSON.stringify({event:'request_failed',correlationId:cid,errorCode:error?.code??'INTERNAL_ERROR',errorType:error?.name??'Error'})+'\\n');if(!res.headersSent)sendError(res,error,cid);else res.destroy();}
});
server.listen(port,'0.0.0.0',()=>process.stdout.write(JSON.stringify({event:'server_started',port})+'\n'));
const shutdown=()=>server.close(async()=>{if(pool)await pool.end();process.exit(0);});
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);