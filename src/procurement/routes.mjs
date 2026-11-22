const qtyMilli=v=>{const s=String(v);if(!/^\d+(?:\.\d{1,3})?$/.test(s))return null;const [w,f='']=s.split('.');return BigInt(w)*1000n+BigInt((f+'000').slice(0,3));};
const profileShape=r=>({id:r.id,farmerId:r.farmer_id,farmName:r.farm_name,farmType:r.farm_type,village:r.village,taluk:r.taluk,district:r.district,state:r.state,postalCode:r.postal_code,farmArea:r.farm_area===null?null:String(r.farm_area),farmAreaUnit:r.farm_area_unit,verificationStatus:r.verification_status,verificationNote:r.verification_note,verifiedAt:r.verified_at,createdAt:r.created_at,updatedAt:r.updated_at});
const poShape=r=>({id:r.id,poNumber:r.po_number,farmerId:r.farmer_id,farmerName:r.farmer_name??null,status:r.status,expectedDeliveryDate:r.expected_delivery_date instanceof Date?r.expected_delivery_date.toISOString().slice(0,10):String(r.expected_delivery_date).slice(0,10),responseNote:r.response_note,createdAt:r.created_at,items:r.items??[]});
export async function handleFarmerProcurementRoutes(ctx){
 const {req,res,cid,path,method,auth,db,bodyJson,transaction,audit,send,fail,requireRole,uuid}=ctx;
 if(path==='/api/v1/farmers/me/profile'&&(method==='GET'||method==='PUT')){
  requireRole(auth,'farmer');
  if(method==='GET'){const q=await db.query('SELECT * FROM farmer_profiles WHERE tenant_id=$1 AND farmer_id=$2',[auth.tenantId,auth.userId]);return send(res,q.rowCount?profileShape(q.rows[0]):null,cid),true;}
  const b=await bodyJson(req);if(typeof b.farmName!=='string'||b.farmName.trim().length<2||b.farmName.trim().length>160||!['INDIVIDUAL','FPO','COOPERATIVE','COMPANY'].includes(b.farmType??'INDIVIDUAL')||typeof b.village!=='string'||b.village.trim().length<2||typeof b.district!=='string'||b.district.trim().length<2||typeof b.state!=='string'||b.state.trim().length<2||typeof b.postalCode!=='string'||!/^\d{6}$/.test(b.postalCode)||(b.farmArea!==undefined&&b.farmArea!==null&&(!Number.isFinite(Number(b.farmArea))||Number(b.farmArea)<=0))||!['ACRE','HECTARE'].includes(b.farmAreaUnit??'ACRE'))fail(422,'FARMER_PROFILE_VALIDATION','Provide a farm name, type, village, district, state and valid six-digit PIN code.');
  const r=await transaction(async c=>{const q=await c.query(`INSERT INTO farmer_profiles(tenant_id,farmer_id,farm_name,farm_type,village,taluk,district,state,postal_code,farm_area,farm_area_unit,verification_status)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'PENDING')
   ON CONFLICT(tenant_id,farmer_id) DO UPDATE SET farm_name=EXCLUDED.farm_name,farm_type=EXCLUDED.farm_type,village=EXCLUDED.village,taluk=EXCLUDED.taluk,district=EXCLUDED.district,state=EXCLUDED.state,postal_code=EXCLUDED.postal_code,farm_area=EXCLUDED.farm_area,farm_area_unit=EXCLUDED.farm_area_unit,verification_status='PENDING',verification_note=NULL,verified_by=NULL,verified_at=NULL,updated_at=now() RETURNING *`,[auth.tenantId,auth.userId,b.farmName.trim(),b.farmType??'INDIVIDUAL',b.village.trim(),b.taluk?.trim()||null,b.district.trim(),b.state.trim(),b.postalCode, b.farmArea??null,b.farmAreaUnit??'ACRE']);await audit(c,auth,cid,'farmer_profile.submitted','farmer_profile',q.rows[0].id);return q.rows[0];});return send(res,profileShape(r),cid),true;
 }
 if(method==='GET'&&path==='/api/v1/admin/farmer-profiles'){
  requireRole(auth,'admin');const q=await db.query('SELECT fp.*,u.display_name AS farmer_name,u.phone FROM farmer_profiles fp JOIN users u ON u.id=fp.farmer_id WHERE fp.tenant_id=$1 ORDER BY fp.created_at DESC LIMIT 200',[auth.tenantId]);return send(res,q.rows.map(x=>({...profileShape(x),farmerName:x.farmer_name,phone:x.phone})),cid),true;
 }
 const profileDecision=path.match(/^\/api\/v1\/admin\/farmer-profiles\/([0-9a-f-]+)\/decision$/i);
 if(method==='POST'&&profileDecision){
  requireRole(auth,'admin');if(!uuid.test(profileDecision[1]))fail(404,'FARMER_PROFILE_NOT_FOUND','Farmer profile was not found.');const b=await bodyJson(req);if(!['approve','reject','suspend'].includes(b.decision)||typeof b.reason!=='string'||b.reason.trim().length<3)fail(422,'FARMER_DECISION_INVALID','Choose a valid decision and provide a review reason.');
  const next={approve:'APPROVED',reject:'REJECTED',suspend:'SUSPENDED'}[b.decision];
  const r=await transaction(async c=>{const q=await c.query('SELECT * FROM farmer_profiles WHERE farmer_id=$1 AND tenant_id=$2 FOR UPDATE',[profileDecision[1],auth.tenantId]);if(!q.rowCount)fail(404,'FARMER_PROFILE_NOT_FOUND','Farmer profile was not found.');if(q.rows[0].farmer_id===auth.userId)fail(403,'MAKER_CHECKER_REQUIRED','A farmer cannot review their own profile.');const u=await c.query('UPDATE farmer_profiles SET verification_status=$1,verification_note=$2,verified_by=$3,verified_at=now(),updated_at=now() WHERE id=$4 RETURNING *',[next,b.reason.trim(),auth.userId,q.rows[0].id]);await audit(c,auth,cid,'farmer_profile.'+b.decision,'farmer_profile',q.rows[0].id,{reason:b.reason.trim()});return u.rows[0];});return send(res,profileShape(r),cid),true;
 }
 if(method==='POST'&&path==='/api/v1/admin/procurement/orders'){
  requireRole(auth,'admin');const b=await bodyJson(req);const quantity=qtyMilli(b.quantity);if(typeof b.poNumber!=='string'||b.poNumber.trim().length<3||b.poNumber.trim().length>60||!uuid.test(b.farmerId)||!uuid.test(b.listingId)||quantity===null||quantity<=0n||!Number.isSafeInteger(b.unitPriceMinor)||b.unitPriceMinor<0||typeof b.expectedDeliveryDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(b.expectedDeliveryDate))fail(422,'PROCUREMENT_ORDER_VALIDATION','Provide a PO number, approved farmer listing, positive quantity, unit price and delivery date.');
  const r=await transaction(async c=>{
   const listing=await c.query(`SELECT fl.*,p.name AS product_name,p.base_unit,fp.verification_status FROM farmer_listings fl JOIN products p ON p.id=fl.product_id AND p.tenant_id=fl.tenant_id JOIN farmer_profiles fp ON fp.farmer_id=fl.farmer_id AND fp.tenant_id=fl.tenant_id WHERE fl.id=$1 AND fl.tenant_id=$2 AND fl.farmer_id=$3 AND fl.status='APPROVED' FOR UPDATE OF fl`,[b.listingId,auth.tenantId,b.farmerId]);
   if(!listing.rowCount)fail(404,'APPROVED_LISTING_NOT_FOUND','An approved listing for this farmer was not found.');
   if(listing.rows[0].verification_status!=='APPROVED')fail(409,'FARMER_NOT_VERIFIED','The farmer profile must be approved before procurement.');
   const available=qtyMilli(listing.rows[0].available_quantity)-qtyMilli(listing.rows[0].allocated_quantity??0);if(quantity>available)fail(409,'INSUFFICIENT_LISTING_QUANTITY','The requested quantity exceeds the unallocated farmer availability.');
   const total=(BigInt(b.unitPriceMinor)*quantity+500n)/1000n;
   const po=await c.query("INSERT INTO procurement_orders(tenant_id,po_number,farmer_id,status,expected_delivery_date,created_by) VALUES($1,$2,$3,'ISSUED',$4,$5) RETURNING *",[auth.tenantId,b.poNumber.trim(),b.farmerId,b.expectedDeliveryDate,auth.userId]);
   const item=await c.query('INSERT INTO procurement_order_items(tenant_id,procurement_order_id,listing_id,product_id,quantity_ordered,unit_code,unit_price_minor,line_total_minor) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',[auth.tenantId,po.rows[0].id,b.listingId,listing.rows[0].product_id,Number(quantity)/1000,listing.rows[0].unit_code,b.unitPriceMinor,total.toString()]);
   await c.query('UPDATE farmer_listings SET allocated_quantity=allocated_quantity+$1 WHERE id=$2 AND tenant_id=$3',[Number(quantity)/1000,b.listingId,auth.tenantId]);
   await audit(c,auth,cid,'procurement_order.issued','procurement_order',po.rows[0].id,{poNumber:b.poNumber.trim(),listingId:b.listingId,quantity:String(quantity),totalMinor:total.toString()});
   return {...po.rows[0],items:[{id:item.rows[0].id,productId:item.rows[0].product_id,quantityOrdered:String(item.rows[0].quantity_ordered),unitCode:item.rows[0].unit_code,unitPriceMinor:String(item.rows[0].unit_price_minor),lineTotalMinor:String(item.rows[0].line_total_minor)}]};
  });return send(res,poShape(r),cid),true;
 }
 if(method==='GET'&&path==='/api/v1/admin/procurement/demand-plan'){
  requireRole(auth,'admin');
  const deliveryDate=new URL(req.url,'http://kirani.local').searchParams.get('deliveryDate')||'';
  const parsedDate=new Date(deliveryDate+'T00:00:00Z');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate)||Number.isNaN(parsedDate.getTime())||parsedDate.toISOString().slice(0,10)!==deliveryDate)fail(422,'DEMAND_PLAN_DATE_INVALID','Provide a valid delivery date in YYYY-MM-DD format.');
  const q=await db.query(`WITH demand AS (
   SELECT oi.product_id,sum(oi.quantity)::numeric(12,3) AS demand_quantity
   FROM orders o JOIN order_items oi ON oi.order_id=o.id
   WHERE o.tenant_id=$1 AND o.delivery_date=$2 AND o.fulfilment_status NOT IN ('CANCELLED','DELIVERED')
   GROUP BY oi.product_id
  ),stock AS (
   SELECT product_id,sum(quantity_available)::numeric(12,3) AS available_quantity
   FROM inventory_lots WHERE tenant_id=$1 AND status='AVAILABLE'
    AND (expires_on IS NULL OR expires_on >= $2::date)
    AND (best_before IS NULL OR best_before >= $2::date)
   GROUP BY product_id
  ),supply AS (
   SELECT product_id,sum(GREATEST(available_quantity-allocated_quantity,0))::numeric(12,3) AS supply_quantity
   FROM farmer_listings WHERE tenant_id=$1 AND status='APPROVED'
   GROUP BY product_id
  )
  SELECT p.id AS product_id,p.sku,p.name AS product_name,p.base_unit,
   d.demand_quantity,COALESCE(st.available_quantity,0)::numeric(12,3) AS inventory_available,
   COALESCE(s.supply_quantity,0)::numeric(12,3) AS farmer_supply_available,
   GREATEST(d.demand_quantity-COALESCE(st.available_quantity,0)-COALESCE(s.supply_quantity,0),0)::numeric(12,3) AS net_shortage
  FROM demand d JOIN products p ON p.id=d.product_id AND p.tenant_id=$1
  LEFT JOIN stock st ON st.product_id=d.product_id LEFT JOIN supply s ON s.product_id=d.product_id
  ORDER BY p.name`,[auth.tenantId,deliveryDate]);
  return send(res,{deliveryDate,lines:q.rows.map(x=>({productId:x.product_id,sku:x.sku,productName:x.product_name,unitCode:x.base_unit,demandQuantity:String(x.demand_quantity),inventoryAvailable:String(x.inventory_available),farmerSupplyAvailable:String(x.farmer_supply_available),netShortage:String(x.net_shortage),coverageStatus:Number(x.net_shortage)>0?'SHORT':'COVERED'})),generatedAt:new Date().toISOString()},cid),true;
 }
 if(method==='GET'&&(path==='/api/v1/admin/procurement/orders'||path==='/api/v1/farmers/me/procurement-orders')){
  const admin=path.includes('/admin/');if(admin)requireRole(auth,'admin');else requireRole(auth,'farmer');
  const q=admin?await db.query(`SELECT po.*,po.expected_delivery_date::text AS expected_delivery_date,u.display_name AS farmer_name,COALESCE(json_agg(json_build_object('id',i.id,'productId',i.product_id,'quantityOrdered',i.quantity_ordered::text,'quantityAccepted',i.quantity_accepted::text,'quantityReceived',i.quantity_received::text,'quantityQualityAccepted',i.quantity_quality_accepted::text,'quantityRejected',i.quantity_rejected::text,'unitCode',i.unit_code,'unitPriceMinor',i.unit_price_minor::text,'lineTotalMinor',i.line_total_minor::text)) FILTER(WHERE i.id IS NOT NULL),'[]') AS items FROM procurement_orders po JOIN users u ON u.id=po.farmer_id LEFT JOIN procurement_order_items i ON i.procurement_order_id=po.id AND i.tenant_id=po.tenant_id WHERE po.tenant_id=$1 GROUP BY po.id,u.display_name ORDER BY po.created_at DESC LIMIT 200`,[auth.tenantId]):await db.query(`SELECT po.*,po.expected_delivery_date::text AS expected_delivery_date,COALESCE(json_agg(json_build_object('id',i.id,'productId',i.product_id,'quantityOrdered',i.quantity_ordered::text,'quantityAccepted',i.quantity_accepted::text,'quantityReceived',i.quantity_received::text,'quantityQualityAccepted',i.quantity_quality_accepted::text,'quantityRejected',i.quantity_rejected::text,'unitCode',i.unit_code,'unitPriceMinor',i.unit_price_minor::text,'lineTotalMinor',i.line_total_minor::text)) FILTER(WHERE i.id IS NOT NULL),'[]') AS items FROM procurement_orders po LEFT JOIN procurement_order_items i ON i.procurement_order_id=po.id AND i.tenant_id=po.tenant_id WHERE po.tenant_id=$1 AND po.farmer_id=$2 GROUP BY po.id ORDER BY po.created_at DESC LIMIT 100`,[auth.tenantId,auth.userId]);
  return send(res,q.rows.map(poShape),cid),true;
 }
 const poResponse=path.match(/^\/api\/v1\/farmers\/me\/procurement-orders\/([0-9a-f-]+)\/response$/i);
 if(method==='POST'&&poResponse){
  requireRole(auth,'farmer');if(!uuid.test(poResponse[1]))fail(404,'PROCUREMENT_ORDER_NOT_FOUND','Purchase order was not found.');const b=await bodyJson(req);if(!['accept','reject'].includes(b.decision)||typeof b.reason!=='string'||b.reason.trim().length<3||b.reason.trim().length>500)fail(422,'PROCUREMENT_RESPONSE_INVALID','Choose accept or reject and provide a reason.');
  const r=await transaction(async c=>{const q=await c.query('SELECT * FROM procurement_orders WHERE id=$1 AND tenant_id=$2 AND farmer_id=$3 FOR UPDATE',[poResponse[1],auth.tenantId,auth.userId]);if(!q.rowCount)fail(404,'PROCUREMENT_ORDER_NOT_FOUND','Purchase order was not found.');if(q.rows[0].status!=='ISSUED')fail(409,'PROCUREMENT_ORDER_STATE_CONFLICT','This purchase order has already been responded to or closed.');
   if(b.decision==='reject'){const lines=await c.query('SELECT listing_id,quantity_ordered FROM procurement_order_items WHERE procurement_order_id=$1 AND tenant_id=$2',[poResponse[1],auth.tenantId]);for(const line of lines.rows)await c.query('UPDATE farmer_listings SET allocated_quantity=GREATEST(0,allocated_quantity-$1) WHERE id=$2 AND tenant_id=$3',[line.quantity_ordered,line.listing_id,auth.tenantId]);const u=await c.query("UPDATE procurement_orders SET status='REJECTED',response_note=$1,responded_at=now(),updated_at=now() WHERE id=$2 RETURNING *,expected_delivery_date::text AS expected_delivery_date",[b.reason.trim(),poResponse[1]]);await audit(c,auth,cid,'procurement_order.rejected','procurement_order',poResponse[1],{reason:b.reason.trim()});return u.rows[0];}
   const item=await c.query('SELECT * FROM procurement_order_items WHERE procurement_order_id=$1 AND tenant_id=$2',[poResponse[1],auth.tenantId]);if(!item.rowCount)fail(409,'PROCUREMENT_ORDER_EMPTY','This purchase order has no line items.');const accepted=qtyMilli(b.acceptedQuantity??item.rows[0].quantity_ordered);if(accepted===null||accepted<=0n||accepted>qtyMilli(item.rows[0].quantity_ordered))fail(422,'ACCEPTED_QUANTITY_INVALID','Accepted quantity must be positive and cannot exceed the ordered quantity.');
   await c.query('UPDATE procurement_order_items SET quantity_accepted=$1 WHERE id=$2',[Number(accepted)/1000,item.rows[0].id]);const release=Number(qtyMilli(item.rows[0].quantity_ordered)-accepted)/1000;if(release>0)await c.query('UPDATE farmer_listings SET allocated_quantity=GREATEST(0,allocated_quantity-$1) WHERE id=$2 AND tenant_id=$3',[release,item.rows[0].listing_id,auth.tenantId]);const u=await c.query("UPDATE procurement_orders SET status='ACCEPTED',response_note=$1,responded_at=now(),updated_at=now() WHERE id=$2 RETURNING *,expected_delivery_date::text AS expected_delivery_date",[b.reason.trim(),poResponse[1]]);await audit(c,auth,cid,'procurement_order.accepted','procurement_order',poResponse[1],{acceptedQuantity:String(accepted)});return u.rows[0];
  });return send(res,poShape(r),cid),true;
 }
 return false;
}
