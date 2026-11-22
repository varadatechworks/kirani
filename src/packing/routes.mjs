import QRCode from 'qrcode';
const milli=v=>{const s=String(v);if(!/^\d+(?:\.\d{1,3})?$/.test(s))return null;const [w,f='']=s.split('.');return BigInt(w)*1000n+BigInt((f+'000').slice(0,3));};
const qty=n=>Number(n)/1000;
export async function handlePublicTrace(ctx){
 const {res,cid,path,method,db,send,fail}=ctx;
 const match=path.match(/^\/api\/v1\/public\/trace\/([0-9a-f-]{36})$/i);
 if(!match||method!=='GET')return false;
 const token=match[1];const p=await db.query('SELECT p.id,p.package_number,p.status,p.packed_at,o.currency FROM packages p JOIN orders o ON o.id=p.order_id AND o.tenant_id=p.tenant_id WHERE p.public_token=$1 AND p.public_token_revoked_at IS NULL',[token]);
 if(!p.rowCount)fail(404,'TRACE_NOT_FOUND','This package trace is unavailable or the code is invalid.');
 const items=await db.query('SELECT pi.id,pi.quantity::text,pi.unit_code,pr.name AS product_name,pr.sku FROM package_items pi JOIN products pr ON pr.id=pi.product_id AND pr.tenant_id=pi.tenant_id WHERE pi.tenant_id=(SELECT tenant_id FROM packages WHERE id=$1) AND pi.package_id=$1 ORDER BY pr.name',[p.rows[0].id]);
 const batches=await db.query(`WITH RECURSIVE trace_outputs(output_id,depth) AS (
  SELECT il.processing_output_id,0 FROM package_batch_allocations a JOIN package_items i ON i.id=a.package_item_id AND i.tenant_id=a.tenant_id JOIN inventory_lots il ON il.id=a.inventory_lot_id AND il.tenant_id=a.tenant_id WHERE i.package_id=$1 AND il.processing_output_id IS NOT NULL
  UNION
  SELECT g.parent_output_id,t.depth+1 FROM trace_outputs t JOIN processing_output_genealogy g ON g.output_id=t.output_id WHERE g.parent_output_id IS NOT NULL AND t.depth<20
 ), source_lots(lot_id) AS (
  SELECT il.id FROM package_batch_allocations a JOIN package_items i ON i.id=a.package_item_id AND i.tenant_id=a.tenant_id JOIN inventory_lots il ON il.id=a.inventory_lot_id AND il.tenant_id=a.tenant_id WHERE i.package_id=$1 AND il.goods_receipt_item_id IS NOT NULL
  UNION
  SELECT g.source_lot_id FROM trace_outputs t JOIN processing_output_genealogy g ON g.output_id=t.output_id WHERE g.source_lot_id IS NOT NULL
 ), all_lots(lot_id) AS (
  SELECT il.id FROM package_batch_allocations a JOIN package_items i ON i.id=a.package_item_id AND i.tenant_id=a.tenant_id JOIN inventory_lots il ON il.id=a.inventory_lot_id AND il.tenant_id=a.tenant_id WHERE i.package_id=$1
  UNION SELECT lot_id FROM source_lots
 )
 SELECT DISTINCT il.lot_code,il.received_at,p.name AS product_name,gr.receipt_number,po.po_number,
 (SELECT string_agg(s.stage_name,' → ' ORDER BY s.sequence_no) FROM trace_outputs t JOIN processing_outputs outp ON outp.id=t.output_id JOIN processing_job_stages s ON s.id=outp.stage_id AND s.tenant_id=outp.tenant_id) AS stage_summary
 FROM all_lots a JOIN inventory_lots il ON il.id=a.lot_id JOIN products p ON p.id=il.product_id
 LEFT JOIN goods_receipt_items gri ON gri.id=il.goods_receipt_item_id LEFT JOIN goods_receipts gr ON gr.id=gri.goods_receipt_id AND gr.tenant_id=gri.tenant_id LEFT JOIN procurement_orders po ON po.id=gr.procurement_order_id AND po.tenant_id=gr.tenant_id
 ORDER BY il.received_at`,[p.rows[0].id]);
 return send(res,{packageNumber:p.rows[0].package_number,status:p.rows[0].status,packedAt:p.rows[0].packed_at,items:items.rows.map(x=>({productName:x.product_name,sku:x.sku,quantity:x.quantity,unitCode:x.unit_code})),sourceBatches:batches.rows.map(x=>({batchCode:x.lot_code,productName:x.product_name,receivedAt:x.received_at,receiptNumber:x.receipt_number||null,purchaseOrder:x.po_number||null,processingStages:x.stage_summary||null})),disclosure:'This page shows approved product and batch trace details only. Farmer contact, private address and payment details are not disclosed.'},cid),true;
}
export async function handlePackingRoutes(ctx){
 const {req,res,cid,path,method,auth,db,bodyJson,transaction,audit,send,fail,requireRole}=ctx;
 if(!path.startsWith('/api/v1/admin/packing/'))return false;requireRole(auth,'admin');
 const labelMatch=path.match(/^\/api\/v1\/admin\/packing\/packages\/([0-9a-f-]{36})\/label$/i);
 if(method==='GET'&&labelMatch){
  const base=process.env.PUBLIC_APP_URL;
  if(!base)fail(503,'PUBLIC_APP_URL_NOT_CONFIGURED','Public application URL must be configured before printing QR labels.');
  let origin;try{origin=new URL(base);if(!['http:','https:'].includes(origin.protocol)||origin.username||origin.password)throw new Error('invalid')}catch{fail(503,'PUBLIC_APP_URL_INVALID','Public application URL configuration is invalid.');}
  const q=await db.query('SELECT id,package_number,public_token,status,packed_at,public_token_revoked_at FROM packages WHERE id=$1 AND tenant_id=$2',[labelMatch[1],auth.tenantId]);
  if(!q.rowCount)fail(404,'PACKAGE_NOT_FOUND','Package was not found.');if(q.rows[0].public_token_revoked_at)fail(409,'PACKAGE_TRACE_REVOKED','The public trace token for this package has been revoked.');
  const items=await db.query('SELECT pr.name AS product_name,pi.quantity::text,pi.unit_code FROM package_items pi JOIN products pr ON pr.id=pi.product_id AND pr.tenant_id=pi.tenant_id WHERE pi.tenant_id=$1 AND pi.package_id=$2 ORDER BY pr.name',[auth.tenantId,q.rows[0].id]);
  const traceUrl=new URL('/trace/'+q.rows[0].public_token,origin).toString();
  const qrSvg=await QRCode.toString(traceUrl,{type:'svg',errorCorrectionLevel:'H',margin:2,width:320});
  return send(res,{packageNumber:q.rows[0].package_number,status:q.rows[0].status,packedAt:q.rows[0].packed_at,traceUrl,qrSvg,items:items.rows.map(x=>({productName:x.product_name,quantity:x.quantity,unitCode:x.unit_code}))},cid),true;
 }
 const revokeMatch=path.match(/^\/api\/v1\/admin\/packing\/packages\/([0-9a-f-]{36})\/revoke-trace$/i);
 if(method==='POST'&&revokeMatch){
  const b=await bodyJson(req);if(typeof b.reason!=='string'||b.reason.trim().length<5||b.reason.trim().length>500)fail(422,'TRACE_REVOCATION_REASON_REQUIRED','Provide a reason of at least five characters.');
  const result=await transaction(async client=>{const q=await client.query('SELECT id,public_token_revoked_at FROM packages WHERE id=$1 AND tenant_id=$2 FOR UPDATE',[revokeMatch[1],auth.tenantId]);if(!q.rowCount)fail(404,'PACKAGE_NOT_FOUND','Package was not found.');if(q.rows[0].public_token_revoked_at)return {id:q.rows[0].id,revokedAt:q.rows[0].public_token_revoked_at,replayed:true};const updated=await client.query('UPDATE packages SET public_token_revoked_at=now(),updated_at=now() WHERE id=$1 AND tenant_id=$2 RETURNING public_token_revoked_at',[revokeMatch[1],auth.tenantId]);await audit(client,auth,cid,'package.trace_revoked','package',revokeMatch[1],{reason:b.reason.trim()});return {id:q.rows[0].id,revokedAt:updated.rows[0].public_token_revoked_at,replayed:false};});
  return send(res,result,cid),true;
 }
 if(method==='GET'&&path==='/api/v1/admin/packing/packages'){
  const q=await db.query(`SELECT p.*,count(DISTINCT pi.id)::int AS line_count,COALESCE(sum(pi.quantity),0)::text AS packed_quantity FROM packages p LEFT JOIN package_items pi ON pi.package_id=p.id AND pi.tenant_id=p.tenant_id WHERE p.tenant_id=$1 GROUP BY p.id ORDER BY p.packed_at DESC LIMIT 100`,[auth.tenantId]);
  return send(res,q.rows.map(x=>({id:x.id,packageNumber:x.package_number,publicToken:x.public_token,tracePath:'/api/v1/public/trace/'+x.public_token,traceRevoked:Boolean(x.public_token_revoked_at),orderId:x.order_id,status:x.status,packedAt:x.packed_at,lineCount:x.line_count,quantity:x.packed_quantity})),cid),true;
 }
 if(method==='POST'&&path==='/api/v1/admin/packing/packages'){
  const b=await bodyJson(req);if(!/^[0-9a-f-]{36}$/i.test(b.orderId)||typeof b.packageNumber!=='string'||b.packageNumber.trim().length<3||b.packageNumber.trim().length>60||!Array.isArray(b.items)||b.items.length<1||b.items.length>50)fail(422,'PACKAGE_VALIDATION','Provide an order, package number and at least one packed item.');
  const seen=new Set();for(const item of b.items){const n=milli(item.quantity);if(!/^[0-9a-f-]{36}$/i.test(item.orderItemId)||seen.has(item.orderItemId)||n===null||n<=0n||!Array.isArray(item.allocations)||item.allocations.length<1||item.allocations.length>50)fail(422,'PACKAGE_LINE_INVALID','Each package line needs a unique order item, positive quantity and batch allocations.');seen.add(item.orderItemId);let sum=0n;for(const a of item.allocations){const q=milli(a.quantity);if(!/^[0-9a-f-]{36}$/i.test(a.lotId)||q===null||q<=0n)fail(422,'PACKAGE_ALLOCATION_INVALID','Each batch allocation needs a valid lot and positive quantity.');sum+=q;}if(sum!==n)fail(422,'PACKAGE_ALLOCATION_MISMATCH','Batch allocations must exactly equal the packed item quantity.');}
  const result=await transaction(async c=>{
   const order=await c.query('SELECT * FROM orders WHERE id=$1 AND tenant_id=$2 FOR UPDATE',[b.orderId,auth.tenantId]);if(!order.rowCount)fail(404,'ORDER_NOT_FOUND','Order was not found.');
   const packageRow=await c.query("INSERT INTO packages(tenant_id,package_number,order_id,packed_by,status) VALUES($1,$2,$3,$4,'PACKED') RETURNING *",[auth.tenantId,b.packageNumber.trim(),b.orderId,auth.userId]);
   for(const line of b.items){const oi=await c.query('SELECT * FROM order_items WHERE id=$1 AND order_id=$2 FOR UPDATE',[line.orderItemId,b.orderId]);if(!oi.rowCount)fail(422,'PACKAGE_ORDER_ITEM_INVALID','A package line does not belong to the selected order.');const n=milli(line.quantity);const packed=await c.query('SELECT COALESCE(sum(pi.quantity),0)::text AS q FROM package_items pi JOIN packages p ON p.id=pi.package_id AND p.tenant_id=pi.tenant_id WHERE p.tenant_id=$1 AND pi.order_item_id=$2',[auth.tenantId,line.orderItemId]);if(milli(oi.rows[0].quantity)-milli(packed.rows[0].q)<n)fail(409,'PACKAGE_QUANTITY_EXCEEDED','Packed quantity exceeds the remaining order item quantity.');
    const pi=await c.query('INSERT INTO package_items(tenant_id,package_id,order_item_id,product_id,quantity,unit_code) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',[auth.tenantId,packageRow.rows[0].id,line.orderItemId,oi.rows[0].product_id,qty(n),oi.rows[0].unit_code]);
    for(const a of line.allocations){const amount=milli(a.quantity);const lot=await c.query('SELECT * FROM inventory_lots WHERE id=$1 AND tenant_id=$2 AND (expires_on IS NULL OR expires_on>=CURRENT_DATE) FOR UPDATE',[a.lotId,auth.tenantId]);if(!lot.rowCount||lot.rows[0].status!=='AVAILABLE'||lot.rows[0].product_id!==oi.rows[0].product_id||milli(lot.rows[0].quantity_available)<amount)fail(409,'PACKAGE_STOCK_UNAVAILABLE','A selected batch is unavailable, quarantined or does not match the order product.');await c.query('INSERT INTO package_batch_allocations(tenant_id,package_item_id,inventory_lot_id,quantity) VALUES($1,$2,$3,$4)',[auth.tenantId,pi.rows[0].id,a.lotId,qty(amount)]);const updated=await c.query("UPDATE inventory_lots SET quantity_on_hand=quantity_on_hand-$1,quantity_available=quantity_available-$1,status=CASE WHEN quantity_on_hand-$1=0 AND quantity_reserved=0 THEN 'DEPLETED' ELSE status END WHERE id=$2 AND tenant_id=$3 RETURNING *",[qty(amount),a.lotId,auth.tenantId]);await c.query("INSERT INTO inventory_ledger(tenant_id,lot_id,product_id,location_id,event_type,quantity_on_hand_delta,quantity_available_delta,reference_type,reference_id,reason,actor_id,correlation_id) VALUES($1,$2,$3,$4,'CONSUME',$5,$5,'PACKAGE',$6,'Stock packed against customer order',$7,$8)",[auth.tenantId,a.lotId,updated.rows[0].product_id,updated.rows[0].location_id,-qty(amount),packageRow.rows[0].id,auth.userId,cid]);}
   }
   await c.query("INSERT INTO package_events(tenant_id,package_id,event_type,reason,actor_id,correlation_id) VALUES($1,$2,'PACKED','Package created and batch allocation validated',$3,$4)",[auth.tenantId,packageRow.rows[0].id,auth.userId,cid]);await audit(c,auth,cid,'package.packed','package',packageRow.rows[0].id,{packageNumber:b.packageNumber.trim(),lineCount:b.items.length});return {id:packageRow.rows[0].id,packageNumber:packageRow.rows[0].package_number,publicToken:packageRow.rows[0].public_token,status:packageRow.rows[0].status,tracePath:'/api/v1/public/trace/'+packageRow.rows[0].public_token};
  });return send(res,result,cid),true;
 }
 return false;
}
