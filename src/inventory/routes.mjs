const milli=v=>{const s=String(v);if(!/^-?\d+(?:\.\d{1,3})?$/.test(s))return null;const negative=s.startsWith('-');const [w,f='']=s.replace(/^-/,'').split('.');const n=BigInt(w)*1000n+BigInt((f+'000').slice(0,3));return negative?-n:n;};
const qty=v=>Number(v)/1000;
const validId=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function handleInventoryRoutes(ctx){
 const {req,res,cid,path,method,auth,db,url,bodyJson,transaction,audit,send,fail,requireRole}=ctx;
 if(!path.startsWith('/api/v1/admin/inventory/'))return false;
 requireRole(auth,'admin');
 if(method==='GET'&&path==='/api/v1/admin/inventory/reservations'){
  const q=await db.query(`SELECT r.*,COALESCE(json_agg(json_build_object('lotId',i.lot_id,'productId',i.product_id,'lotCode',il.lot_code,'productName',p.name,'quantity',i.quantity::text)) FILTER(WHERE i.id IS NOT NULL),'[]') AS items FROM inventory_reservations r LEFT JOIN inventory_reservation_items i ON i.reservation_id=r.id AND i.tenant_id=r.tenant_id LEFT JOIN inventory_lots il ON il.id=i.lot_id AND il.tenant_id=i.tenant_id LEFT JOIN products p ON p.id=i.product_id AND p.tenant_id=i.tenant_id WHERE r.tenant_id=$1 GROUP BY r.id ORDER BY r.created_at DESC LIMIT 100`,[auth.tenantId]);
  return send(res,q.rows.map(x=>({id:x.id,reservationNumber:x.reservation_number,referenceType:x.reference_type,referenceId:x.reference_id,status:x.status,createdAt:x.created_at,items:x.items})),cid),true;
 }
 if(method==='GET'&&path==='/api/v1/admin/inventory/ledger'){
  const limit=Math.min(200,Math.max(1,Number(url.searchParams.get('limit')||50)));
  const lotId=url.searchParams.get('lotId');
  if(lotId&&!validId.test(lotId))fail(422,'INVENTORY_FILTER_INVALID','Choose a valid inventory lot.');
  const q=await db.query(`SELECT l.*,p.name AS product_name,il.lot_code,u.display_name AS actor_name FROM inventory_ledger l JOIN products p ON p.id=l.product_id JOIN inventory_lots il ON il.id=l.lot_id AND il.tenant_id=l.tenant_id JOIN users u ON u.id=l.actor_id WHERE l.tenant_id=$1 AND ($2::uuid IS NULL OR l.lot_id=$2) ORDER BY l.created_at DESC LIMIT $3`,[auth.tenantId,lotId,limit]);
  return send(res,q.rows.map(x=>({id:x.id,lotId:x.lot_id,lotCode:x.lot_code,productName:x.product_name,eventType:x.event_type,onHandDelta:String(x.quantity_on_hand_delta),reservedDelta:String(x.quantity_reserved_delta),availableDelta:String(x.quantity_available_delta),referenceType:x.reference_type,referenceId:x.reference_id,reason:x.reason,actor:x.actor_name,createdAt:x.created_at})),cid),true;
 }
 if(method==='POST'&&path==='/api/v1/admin/inventory/adjustments'){
  const b=await bodyJson(req),delta=milli(b.quantityDelta);
  if(!validId.test(b.lotId)||delta===null||delta===0n||typeof b.reason!=='string'||b.reason.trim().length<5)fail(422,'INVENTORY_ADJUSTMENT_INVALID','Select a lot, enter a non-zero quantity adjustment (up to 3 decimals) and explain the reason.');
  const result=await transaction(async c=>{
   const q=await c.query('SELECT * FROM inventory_lots WHERE id=$1 AND tenant_id=$2 FOR UPDATE',[b.lotId,auth.tenantId]);
   if(!q.rowCount)fail(404,'INVENTORY_LOT_NOT_FOUND','Inventory lot was not found.');
   const lot=q.rows[0];if(lot.status!=='AVAILABLE')fail(409,'INVENTORY_LOT_NOT_AVAILABLE','Only available lots can be adjusted.');
   const next=BigInt(Math.round(Number(lot.quantity_on_hand)*1000))+delta;
   const reserved=BigInt(Math.round(Number(lot.quantity_reserved)*1000));
   if(next<reserved||next<0n)fail(409,'INVENTORY_ADJUSTMENT_BELOW_RESERVED','Adjustment cannot reduce stock below the quantity already reserved.');
   const available=next-reserved;
   await c.query('UPDATE inventory_lots SET quantity_on_hand=$1,quantity_available=$2 WHERE id=$3 AND tenant_id=$4',[qty(next),qty(available),lot.id,auth.tenantId]);
   await c.query('INSERT INTO inventory_ledger(tenant_id,lot_id,product_id,location_id,event_type,quantity_on_hand_delta,quantity_available_delta,reference_type,reference_id,reason,actor_id,correlation_id) VALUES($1,$2,$3,$4,$5,$6,$6,$7,$8,$9,$10,$11)',[auth.tenantId,lot.id,lot.product_id,lot.location_id,delta>0n?'ADJUSTMENT_IN':'ADJUSTMENT_OUT',qty(delta),'MANUAL',b.referenceId||null,b.reason.trim(),auth.userId,cid]);
   await audit(c,auth,cid,'inventory.adjusted','inventory_lot',lot.id,{delta:qty(delta),reason:b.reason.trim()});
   return {lotId:lot.id,quantityOnHand:qty(next),quantityReserved:qty(reserved),quantityAvailable:qty(available)};
  });
  return send(res,result,cid),true;
 }
 if(method==='POST'&&path==='/api/v1/admin/inventory/reservations'){
  const b=await bodyJson(req),key=String(req.headers['idempotency-key']||b.idempotencyKey||'').trim();
  if(key.length<8||key.length>128||!['ORDER','PROCESSING_JOB','MANUAL'].includes(b.referenceType)||!Array.isArray(b.items)||b.items.length<1||b.items.length>100)fail(422,'INVENTORY_RESERVATION_INVALID','Provide an idempotency key, valid reference type and at least one product quantity.');
  const requested=new Map();for(const item of b.items){const q=milli(item.quantity);if(!validId.test(item.productId)||q===null||q<=0n)fail(422,'INVENTORY_RESERVATION_LINE_INVALID','Each reservation line needs a product and positive quantity with at most 3 decimals.');requested.set(item.productId,(requested.get(item.productId)||0n)+q);}
  const result=await transaction(async c=>{
   await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[auth.tenantId+':inventory-reservation:'+auth.userId+':'+key]);
   const prior=await c.query('SELECT * FROM inventory_reservations WHERE tenant_id=$1 AND created_by=$2 AND idempotency_key=$3',[auth.tenantId,auth.userId,key]);
   if(prior.rowCount)return {id:prior.rows[0].id,reservationNumber:prior.rows[0].reservation_number,status:prior.rows[0].status,replayed:true};
   const reservationNumber=String(b.reservationNumber||'RSV-'+key).slice(0,60);
   const h=await c.query("INSERT INTO inventory_reservations(tenant_id,reservation_number,reference_type,reference_id,idempotency_key,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",[auth.tenantId,reservationNumber,b.referenceType,b.referenceId||null,key,auth.userId]);
   for(const [productId,wanted] of requested){
    const lots=await c.query("SELECT * FROM inventory_lots WHERE tenant_id=$1 AND product_id=$2 AND status='AVAILABLE' AND quantity_available>0 ORDER BY received_at ASC,id FOR UPDATE",[auth.tenantId,productId]);
    const total=lots.rows.reduce((sum,l)=>sum+BigInt(Math.round(Number(l.quantity_available)*1000)),0n);
    if(total<wanted)fail(409,'INVENTORY_INSUFFICIENT_STOCK','Available stock is insufficient for one or more requested products.');
    let remaining=wanted;
    for(const lot of lots.rows){if(remaining<=0n)break;const available=BigInt(Math.round(Number(lot.quantity_available)*1000));const take=available<remaining?available:remaining;const n=await c.query('UPDATE inventory_lots SET quantity_available=quantity_available-$1,quantity_reserved=quantity_reserved+$1 WHERE id=$2 AND tenant_id=$3 AND quantity_available>=$1 RETURNING quantity_available,quantity_reserved',[qty(take),lot.id,auth.tenantId]);if(!n.rowCount)fail(409,'INVENTORY_STOCK_CHANGED','Stock changed while the reservation was being created. Retry the operation.');await c.query('INSERT INTO inventory_reservation_items(tenant_id,reservation_id,lot_id,product_id,quantity) VALUES($1,$2,$3,$4,$5)',[auth.tenantId,h.rows[0].id,lot.id,productId,qty(take)]);await c.query("INSERT INTO inventory_ledger(tenant_id,lot_id,product_id,location_id,event_type,quantity_reserved_delta,quantity_available_delta,reference_type,reference_id,reason,actor_id,correlation_id) VALUES($1,$2,$3,$4,'RESERVE',$5,$6,'INVENTORY_RESERVATION',$7,$8,$9,$10)",[auth.tenantId,lot.id,productId,lot.location_id,qty(take),-qty(take),h.rows[0].id,'Stock reserved for '+b.referenceType,auth.userId,cid]);remaining-=take;}
   }
   await audit(c,auth,cid,'inventory.reserved','inventory_reservation',h.rows[0].id,{referenceType:b.referenceType,referenceId:b.referenceId||null,products:requested.size});
   return {id:h.rows[0].id,reservationNumber:h.rows[0].reservation_number,status:h.rows[0].status,replayed:false};
  });
  return send(res,result,cid),true;
 }
 const release=path.match(/^\/api\/v1\/admin\/inventory\/reservations\/([0-9a-f-]+)\/release$/i);
 if(method==='POST'&&release){
  if(!validId.test(release[1]))fail(404,'INVENTORY_RESERVATION_NOT_FOUND','Reservation was not found.');
  const b=await bodyJson(req);if(typeof b.reason!=='string'||b.reason.trim().length<5)fail(422,'INVENTORY_RELEASE_REASON_REQUIRED','Provide a reason for releasing reserved stock.');
  const result=await transaction(async c=>{
   const h=await c.query("SELECT * FROM inventory_reservations WHERE id=$1 AND tenant_id=$2 FOR UPDATE",[release[1],auth.tenantId]);if(!h.rowCount)fail(404,'INVENTORY_RESERVATION_NOT_FOUND','Reservation was not found.');if(h.rows[0].status!=='ACTIVE')fail(409,'INVENTORY_RESERVATION_NOT_ACTIVE','Only active reservations can be released.');
   const items=await c.query('SELECT * FROM inventory_reservation_items WHERE reservation_id=$1 AND tenant_id=$2',[release[1],auth.tenantId]);
   for(const item of items.rows){const lot=await c.query('SELECT * FROM inventory_lots WHERE id=$1 AND tenant_id=$2 FOR UPDATE',[item.lot_id,auth.tenantId]);if(!lot.rowCount||BigInt(Math.round(Number(lot.rows[0].quantity_reserved)*1000))<BigInt(Math.round(Number(item.quantity)*1000)))fail(409,'INVENTORY_RESERVATION_BALANCE_INVALID','Reserved stock no longer matches its lot balance.');const n=await c.query('UPDATE inventory_lots SET quantity_available=quantity_available+$1,quantity_reserved=quantity_reserved-$1 WHERE id=$2 AND tenant_id=$3 RETURNING *',[item.quantity,item.lot_id,auth.tenantId]);await c.query("INSERT INTO inventory_ledger(tenant_id,lot_id,product_id,location_id,event_type,quantity_reserved_delta,quantity_available_delta,reference_type,reference_id,reason,actor_id,correlation_id) VALUES($1,$2,$3,$4,'RELEASE',$5,$6,'INVENTORY_RESERVATION',$7,$8,$9,$10)",[auth.tenantId,item.lot_id,item.product_id,n.rows[0].location_id,-Number(item.quantity),Number(item.quantity),release[1],b.reason.trim(),auth.userId,cid]);}
   await c.query("UPDATE inventory_reservations SET status='RELEASED',released_by=$1,release_reason=$2,released_at=now() WHERE id=$3 AND tenant_id=$4",[auth.userId,b.reason.trim(),release[1],auth.tenantId]);await audit(c,auth,cid,'inventory.reservation_released','inventory_reservation',release[1],{reason:b.reason.trim()});return {id:release[1],status:'RELEASED',releasedLines:items.rowCount};
  });
  return send(res,result,cid),true;
 }
 const quality=path.match(/^\/api\/v1\/admin\/inventory\/lots\/([0-9a-f-]+)\/quality$/i);
 if(method==='POST'&&quality){
  if(!validId.test(quality[1]))fail(404,'INVENTORY_LOT_NOT_FOUND','Inventory lot was not found.');
  const b=await bodyJson(req);if(!['QUARANTINED','AVAILABLE','RECALLED'].includes(b.status)||typeof b.reason!=='string'||b.reason.trim().length<5)fail(422,'INVENTORY_QUALITY_DECISION_INVALID','Choose a valid lot status and provide a reason.');
  const result=await transaction(async c=>{
   const q=await c.query('SELECT * FROM inventory_lots WHERE id=$1 AND tenant_id=$2 FOR UPDATE',[quality[1],auth.tenantId]);if(!q.rowCount)fail(404,'INVENTORY_LOT_NOT_FOUND','Inventory lot was not found.');const lot=q.rows[0];
   const transitions={AVAILABLE:['QUARANTINED','RECALLED'],QUARANTINED:['AVAILABLE','RECALLED'],RECALLED:[],DEPLETED:[]};if(!transitions[lot.status]?.includes(b.status))fail(409,'INVENTORY_QUALITY_TRANSITION_INVALID','This lot cannot move to the selected quality status.');
   if(['RECALLED','QUARANTINED'].includes(b.status)&&Number(lot.quantity_reserved)>0)fail(409,'INVENTORY_LOT_HAS_RESERVATIONS','Release active reservations before placing this lot on hold or recalling it.');
   const old=lot.status;await c.query('UPDATE inventory_lots SET status=$1 WHERE id=$2 AND tenant_id=$3',[b.status,lot.id,auth.tenantId]);
   const type=b.status==='QUARANTINED'?'QUALITY_HOLD':b.status==='AVAILABLE'?'QUALITY_RELEASE':'RECALL';
   await c.query('INSERT INTO inventory_ledger(tenant_id,lot_id,product_id,location_id,event_type,reference_type,reference_id,reason,actor_id,correlation_id) VALUES($1,$2,$3,$4,$5,\'QUALITY\',$6,$7,$8,$9)',[auth.tenantId,lot.id,lot.product_id,lot.location_id,type,old+'->'+b.status,b.reason.trim(),auth.userId,cid]);await audit(c,auth,cid,'inventory.quality_status_changed','inventory_lot',lot.id,{from:old,to:b.status,reason:b.reason.trim()});return {lotId:lot.id,previousStatus:old,status:b.status,quantityOnHand:String(lot.quantity_on_hand),quantityReserved:String(lot.quantity_reserved),quantityAvailable:String(lot.quantity_available)};
  });
  return send(res,result,cid),true;
 }
 return false;
}
