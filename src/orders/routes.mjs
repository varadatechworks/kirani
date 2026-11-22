const validAddress=b=>typeof b.label==='string'&&b.label.trim().length>0&&b.label.trim().length<=40&&typeof b.recipientName==='string'&&b.recipientName.trim().length>0&&b.recipientName.trim().length<=160&&typeof b.phone==='string'&&/^[0-9+() -]{7,20}$/.test(b.phone)&&typeof b.line1==='string'&&b.line1.trim().length>=3&&b.line1.trim().length<=200&&typeof b.locality==='string'&&b.locality.trim().length>=2&&typeof b.city==='string'&&b.city.trim().length>=2&&typeof b.state==='string'&&b.state.trim().length>=2&&typeof b.postalCode==='string'&&/^[0-9]{6}$/.test(b.postalCode);
const addressShape=r=>({id:r.id,label:r.label,recipientName:r.recipient_name,phone:r.phone,line1:r.line1,line2:r.line2,landmark:r.landmark,locality:r.locality,city:r.city,state:r.state,postalCode:r.postal_code,countryCode:r.country_code,isDefault:r.is_default});
const milli=value=>{const s=String(value);if(!/^\d+(?:\.\d{1,3})?$/.test(s))return null;const [whole,frac='']=s.split('.');return BigInt(whole)*1000n+BigInt((frac+'000').slice(0,3));};
const orderShape=r=>({id:r.id,customerId:r.customer_id,cycleId:r.cycle_id,orderType:r.order_type,fulfilmentStatus:r.fulfilment_status,paymentStatus:r.payment_status,currency:String(r.currency??'INR').trim(),subtotalMinor:String(r.subtotal_minor),discountMinor:String(r.discount_minor),taxMinor:String(r.tax_minor),totalMinor:String(r.total_minor),deliveryDate:r.delivery_date,createdAt:r.created_at,updatedAt:r.updated_at});
export async function handleOrderRoutes(ctx){
 const {req,res,cid,path,method,auth,db,bodyJson,transaction,audit,send,fail,requireRole,uuid}=ctx;
 if(path.startsWith('/api/v1/customers/me/addresses')){
  requireRole(auth,'customer');
  if(method==='GET'&&path==='/api/v1/customers/me/addresses'){
   const r=await db.query('SELECT * FROM customer_addresses WHERE tenant_id=$1 AND customer_id=$2 AND active=true ORDER BY is_default DESC,created_at DESC',[auth.tenantId,auth.userId]);
   return send(res,r.rows.map(addressShape),cid),true;
  }
  if(method==='POST'&&path==='/api/v1/customers/me/addresses'){
   const b=await bodyJson(req);if(!validAddress(b))fail(422,'ADDRESS_VALIDATION','Enter a valid recipient, phone number and complete six-digit Indian postal address.');
   const created=await transaction(async c=>{
    if(b.isDefault)await c.query('UPDATE customer_addresses SET is_default=false,updated_at=now() WHERE tenant_id=$1 AND customer_id=$2 AND active=true',[auth.tenantId,auth.userId]);
    const q=await c.query('INSERT INTO customer_addresses(tenant_id,customer_id,label,recipient_name,phone,line1,line2,landmark,locality,city,state,postal_code,country_code,is_default) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *',[auth.tenantId,auth.userId,b.label.trim(),b.recipientName.trim(),b.phone.trim(),b.line1.trim(),b.line2?.trim()||null,b.landmark?.trim()||null,b.locality.trim(),b.city.trim(),b.state.trim(),b.postalCode,'IN',Boolean(b.isDefault)]);
    await audit(c,auth,cid,'customer_address.created','customer_address',q.rows[0].id);return q.rows[0];
   });return send(res,addressShape(created),cid),true;
  }
  const addressId=path.match(/^\/api\/v1\/customers\/me\/addresses\/([0-9a-f-]+)$/i);
  if(addressId&&method==='PUT'){
   if(!uuid.test(addressId[1]))fail(404,'ADDRESS_NOT_FOUND','Address was not found.');const b=await bodyJson(req);if(!validAddress(b))fail(422,'ADDRESS_VALIDATION','Enter a valid recipient, phone number and complete six-digit Indian postal address.');
   const updated=await transaction(async c=>{
    const exists=await c.query('SELECT id FROM customer_addresses WHERE id=$1 AND tenant_id=$2 AND customer_id=$3 AND active=true FOR UPDATE',[addressId[1],auth.tenantId,auth.userId]);if(!exists.rowCount)fail(404,'ADDRESS_NOT_FOUND','Address was not found.');
    if(b.isDefault)await c.query('UPDATE customer_addresses SET is_default=false,updated_at=now() WHERE tenant_id=$1 AND customer_id=$2 AND active=true',[auth.tenantId,auth.userId]);
    const q=await c.query('UPDATE customer_addresses SET label=$1,recipient_name=$2,phone=$3,line1=$4,line2=$5,landmark=$6,locality=$7,city=$8,state=$9,postal_code=$10,is_default=$11,updated_at=now() WHERE id=$12 AND tenant_id=$13 AND customer_id=$14 RETURNING *',[b.label.trim(),b.recipientName.trim(),b.phone.trim(),b.line1.trim(),b.line2?.trim()||null,b.landmark?.trim()||null,b.locality.trim(),b.city.trim(),b.state.trim(),b.postalCode,Boolean(b.isDefault),addressId[1],auth.tenantId,auth.userId]);await audit(c,auth,cid,'customer_address.updated','customer_address',addressId[1]);return q.rows[0];
   });return send(res,addressShape(updated),cid),true;
  }
  if(addressId&&method==='DELETE'){
   if(!uuid.test(addressId[1]))fail(404,'ADDRESS_NOT_FOUND','Address was not found.');
   await transaction(async c=>{const q=await c.query('UPDATE customer_addresses SET active=false,is_default=false,updated_at=now() WHERE id=$1 AND tenant_id=$2 AND customer_id=$3 AND active=true RETURNING id',[addressId[1],auth.tenantId,auth.userId]);if(!q.rowCount)fail(404,'ADDRESS_NOT_FOUND','Address was not found.');await audit(c,auth,cid,'customer_address.archived','customer_address',addressId[1]);});return send(res,{id:addressId[1],archived:true},cid),true;
  }
 }
 if(method==='POST'&&path==='/api/v1/customers/me/orders/preview'){
  requireRole(auth,'customer');const b=await bodyJson(req);
  if(!uuid.test(b.cycleId)||!uuid.test(b.addressId)||typeof b.deliveryDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(b.deliveryDate))fail(422,'ORDER_PREVIEW_VALIDATION','Choose a cycle, delivery address and valid delivery date.');
  const r=await db.query(`SELECT gc.id AS cycle_id,gc.code,gc.delivery_from::text AS delivery_from_text,gc.delivery_to::text AS delivery_to_text,gc.cutoff_at,ca.*,bv.id AS basket_version_id,bi.product_id,bi.quantity::text,p.name AS product_name,p.base_unit,p.price_minor,p.currency
   FROM grocery_cycles gc JOIN customer_addresses ca ON ca.id=$2 AND ca.tenant_id=gc.tenant_id AND ca.customer_id=$3 AND ca.active=true
   JOIN baskets ba ON ba.tenant_id=gc.tenant_id AND ba.customer_id=$3 AND ba.status='ACTIVE'
   JOIN LATERAL(SELECT * FROM basket_versions WHERE basket_id=ba.id ORDER BY version DESC LIMIT 1)bv ON bv.effective_cycle_id=gc.id
   JOIN basket_items bi ON bi.basket_version_id=bv.id JOIN products p ON p.id=bi.product_id AND p.tenant_id=gc.tenant_id AND p.active=true
   WHERE gc.id=$1 AND gc.tenant_id=$4 AND gc.status='OPEN' AND gc.cutoff_at>now() ORDER BY p.name`,[b.cycleId,b.addressId,auth.userId,auth.tenantId]);
  if(!r.rowCount)fail(409,'ORDER_NOT_READY','The selected cycle, address or recurring basket is unavailable. Please review your basket and delivery details.');
  const first=r.rows[0];if(b.deliveryDate<first.delivery_from_text||b.deliveryDate>first.delivery_to_text)fail(422,'DELIVERY_DATE_INVALID','Choose a delivery date within this cycle.');
  const items=r.rows.map(x=>{const qty=milli(x.quantity);if(qty===null)fail(422,'QUANTITY_INVALID','A basket quantity is invalid.');const line=(BigInt(x.price_minor)*qty+500n)/1000n;return {productId:x.product_id,name:x.product_name,quantity:x.quantity,unitCode:x.base_unit,unitPriceMinor:String(x.price_minor),lineTotalMinor:String(line),currency:String(x.currency).trim()};});
  const currencies=new Set(items.map(x=>x.currency));if(currencies.size!==1)fail(409,'CURRENCY_MISMATCH','The basket contains products with different currencies.');
  const subtotal=items.reduce((sum,x)=>sum+BigInt(x.lineTotalMinor),0n);
  return send(res,{cycle:{id:first.cycle_id,code:first.code,cutoffAt:first.cutoff_at},deliveryDate:b.deliveryDate,address:addressShape(first),currency:items[0].currency,items,subtotalMinor:String(subtotal),discountMinor:'0',taxMinor:'0',totalMinor:String(subtotal),taxNote:'Tax is not configured for this tenant; no tax has been added.'},cid),true;
 }
 if(method==='POST'&&path==='/api/v1/customers/me/orders'){
  requireRole(auth,'customer');const b=await bodyJson(req);const key=req.headers['idempotency-key'];
  if(typeof key!=='string'||key.length<8||key.length>128)fail(422,'IDEMPOTENCY_KEY_REQUIRED','Submit a unique Idempotency-Key header between 8 and 128 characters.');
  if(!uuid.test(b.cycleId)||!uuid.test(b.addressId)||typeof b.deliveryDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(b.deliveryDate))fail(422,'ORDER_VALIDATION','Choose a cycle, delivery address and valid delivery date.');
  const created=await transaction(async c=>{
   const prior=await c.query('SELECT * FROM orders WHERE tenant_id=$1 AND customer_id=$2 AND idempotency_key=$3',[auth.tenantId,auth.userId,key]);if(prior.rowCount)return {order:prior.rows[0],replayed:true};
   const cycle=await c.query("SELECT *,delivery_from::text AS delivery_from_text,delivery_to::text AS delivery_to_text FROM grocery_cycles WHERE id=$1 AND tenant_id=$2 AND status='OPEN' AND cutoff_at>now() FOR UPDATE",[b.cycleId,auth.tenantId]);if(!cycle.rowCount)fail(409,'CYCLE_CLOSED','This cycle is no longer accepting orders.');
   const d=b.deliveryDate;if(d<cycle.rows[0].delivery_from_text||d>cycle.rows[0].delivery_to_text)fail(422,'DELIVERY_DATE_INVALID','Choose a delivery date within this cycle.');
   const address=await c.query('SELECT * FROM customer_addresses WHERE id=$1 AND tenant_id=$2 AND customer_id=$3 AND active=true FOR SHARE',[b.addressId,auth.tenantId,auth.userId]);if(!address.rowCount)fail(404,'ADDRESS_NOT_FOUND','Choose an active delivery address.');
   const basket=await c.query("SELECT ba.id AS basket_id,bv.id AS version_id,bv.version,bi.product_id,bi.quantity::text,p.name,p.base_unit,p.price_minor,p.currency FROM baskets ba JOIN LATERAL(SELECT * FROM basket_versions WHERE basket_id=ba.id ORDER BY version DESC LIMIT 1)bv ON bv.effective_cycle_id=$3 JOIN basket_items bi ON bi.basket_version_id=bv.id JOIN products p ON p.id=bi.product_id AND p.tenant_id=ba.tenant_id AND p.active=true WHERE ba.tenant_id=$1 AND ba.customer_id=$2 AND ba.status='ACTIVE' ORDER BY p.name FOR SHARE OF ba",[auth.tenantId,auth.userId,b.cycleId]);if(!basket.rowCount)fail(409,'BASKET_EMPTY','Your recurring basket is empty or not configured for this cycle.');
   const items=basket.rows.map(x=>{const qty=milli(x.quantity);if(qty===null)fail(422,'QUANTITY_INVALID','A basket quantity is invalid.');return {...x,line:(BigInt(x.price_minor)*qty+500n)/1000n};});
   if(new Set(items.map(x=>String(x.currency).trim())).size!==1)fail(409,'CURRENCY_MISMATCH','The basket contains products with different currencies.');
   const subtotal=items.reduce((sum,x)=>sum+x.line,0n);const currency=String(items[0].currency).trim();
   const addressSnapshot=addressShape(address.rows[0]);
   const order=await c.query("INSERT INTO orders(tenant_id,customer_id,cycle_id,order_type,fulfilment_status,payment_status,currency,subtotal_minor,discount_minor,tax_minor,total_minor,idempotency_key,address_id,address_snapshot,delivery_date,updated_at) VALUES($1,$2,$3,'RECURRING','PLACED','PENDING',$4,$5,0,0,$5,$6,$7,$8,$9,now()) RETURNING *",[auth.tenantId,auth.userId,b.cycleId,currency,subtotal.toString(),key,b.addressId,JSON.stringify(addressSnapshot),d]);
   for(const item of items)await c.query('INSERT INTO order_items(order_id,product_id,quantity,unit_price_minor,line_total_minor,source_type,product_name_snapshot,unit_code) VALUES($1,$2,$3,$4,$5,\'RECURRING\',$6,$7)',[order.rows[0].id,item.product_id,item.quantity,item.price_minor,item.line.toString(),item.name,item.base_unit]);
   await audit(c,auth,cid,'customer_order.placed','order',order.rows[0].id,{cycleId:b.cycleId,itemCount:items.length,totalMinor:subtotal.toString()});
   return {order:order.rows[0],replayed:false};
  });
  return send(res,{...orderShape(created.order),idempotentReplay:created.replayed},cid),true;
 }
 const cancel=path.match(/^\/api\/v1\/orders\/([0-9a-f-]+)\/cancel$/i);
 if(method==='POST'&&cancel){
  requireRole(auth,'customer');if(!uuid.test(cancel[1]))fail(404,'ORDER_NOT_FOUND','Order was not found.');const b=await bodyJson(req);if(typeof b.reason!=='string'||b.reason.trim().length<3||b.reason.trim().length>500)fail(422,'CANCELLATION_REASON_REQUIRED','Please provide a cancellation reason.');
  const order=await transaction(async c=>{const q=await c.query('SELECT * FROM orders WHERE id=$1 AND tenant_id=$2 AND customer_id=$3 FOR UPDATE',[cancel[1],auth.tenantId,auth.userId]);if(!q.rowCount)fail(404,'ORDER_NOT_FOUND','Order was not found.');const current=q.rows[0];if(current.fulfilment_status!=='PLACED'||current.payment_status!=='PENDING')fail(409,'ORDER_NOT_CANCELLABLE','Only placed orders awaiting payment can be cancelled online. Please contact support if payment was collected.');const u=await c.query("UPDATE orders SET fulfilment_status='CANCELLED',cancellation_reason=$1,updated_at=now(),version=version+1 WHERE id=$2 AND tenant_id=$3 RETURNING *",[b.reason.trim(),cancel[1],auth.tenantId]);await audit(c,auth,cid,'customer_order.cancelled','order',cancel[1],{reason:b.reason.trim()});return u.rows[0];});return send(res,orderShape(order),cid),true;
 }
 const detail=path.match(/^\/api\/v1\/orders\/([0-9a-f-]+)$/i);
 if(method==='GET'&&detail){
  if(!uuid.test(detail[1]))fail(404,'ORDER_NOT_FOUND','Order was not found.');
  const q=await db.query('SELECT o.*,oi.id AS item_id,oi.product_id,COALESCE(oi.product_name_snapshot,p.name) AS product_name,oi.quantity::text,oi.unit_code,oi.unit_price_minor,oi.line_total_minor FROM orders o LEFT JOIN order_items oi ON oi.order_id=o.id LEFT JOIN products p ON p.id=oi.product_id WHERE o.id=$1 AND o.tenant_id=$2 AND ($3::boolean OR o.customer_id=$4) ORDER BY oi.id',[detail[1],auth.tenantId,auth.roles.includes('admin'),auth.userId]);if(!q.rowCount)fail(404,'ORDER_NOT_FOUND','Order was not found.');const first=q.rows[0];return send(res,{...orderShape(first),deliveryAddress:first.address_snapshot,items:q.rows.filter(x=>x.item_id).map(x=>({id:x.item_id,productId:x.product_id,name:x.product_name,quantity:x.quantity,unitCode:x.unit_code,unitPriceMinor:String(x.unit_price_minor),lineTotalMinor:String(x.line_total_minor)}))},cid),true;
 }
 return false;
}
