const milli=v=>{const s=String(v);if(!/^\d+(?:\.\d{1,3})?$/.test(s))return null;const [w,f='']=s.split('.');return BigInt(w)*1000n+BigInt((f+'000').slice(0,3));};
export async function handleGoodsReceiptRoutes(ctx){
 const {req,res,cid,path,method,auth,db,bodyJson,transaction,audit,send,fail,requireRole,uuid}=ctx;
 const match=path.match(/^\/api\/v1\/admin\/procurement\/orders\/([0-9a-f-]+)\/receipts$/i);
 if(!match)return false;
 requireRole(auth,'admin');if(!uuid.test(match[1]))fail(404,'PROCUREMENT_ORDER_NOT_FOUND','Purchase order was not found.');
 if(method==='GET'){
  const q=await db.query(`SELECT gr.*,COALESCE(json_agg(json_build_object('id',gri.id,'productId',gri.product_id,'quantityReceived',gri.quantity_received::text,'quantityQualityAccepted',gri.quantity_quality_accepted::text,'quantityRejected',gri.quantity_rejected::text,'rejectionReason',gri.rejection_reason,'lotCode',gri.lot_code)) FILTER(WHERE gri.id IS NOT NULL),'[]') AS items FROM goods_receipts gr LEFT JOIN goods_receipt_items gri ON gri.goods_receipt_id=gr.id AND gri.tenant_id=gr.tenant_id WHERE gr.tenant_id=$1 AND gr.procurement_order_id=$2 GROUP BY gr.id ORDER BY gr.received_at DESC`,[auth.tenantId,match[1]]);
  return send(res,q.rows.map(x=>({id:x.id,receiptNumber:x.receipt_number,receivedAt:x.received_at,notes:x.notes,items:x.items})),cid),true;
 }
 if(method!=='POST')return false;
 const b=await bodyJson(req);if(typeof b.receiptNumber!=='string'||b.receiptNumber.trim().length<3||b.receiptNumber.trim().length>60||!Array.isArray(b.items)||b.items.length<1||b.items.length>100)fail(422,'GOODS_RECEIPT_VALIDATION','Provide a receipt number and at least one receipt line.');
 const seen=new Set();for(const item of b.items){const received=milli(item.quantityReceived),accepted=milli(item.quantityQualityAccepted),rejected=milli(item.quantityRejected);if(!uuid.test(item.procurementOrderItemId)||seen.has(item.procurementOrderItemId)||received===null||accepted===null||rejected===null||received<=0n||accepted<0n||rejected<0n||accepted+rejected!==received||(rejected>0n&&(typeof item.rejectionReason!=='string'||item.rejectionReason.trim().length<3))||(accepted>0n&&(typeof item.lotCode!=='string'||item.lotCode.trim().length<2)))fail(422,'GOODS_RECEIPT_LINE_INVALID','Each line needs a valid PO item, received quantity, accepted/rejected split, rejection reason when needed and lot code for accepted stock.');seen.add(item.procurementOrderItemId);}
 const result=await transaction(async c=>{
  await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[auth.tenantId+':grn:'+b.receiptNumber.trim()]);
  const prior=await c.query('SELECT * FROM goods_receipts WHERE tenant_id=$1 AND receipt_number=$2',[auth.tenantId,b.receiptNumber.trim()]);
  if(prior.rowCount){if(prior.rows[0].procurement_order_id!==match[1])fail(409,'RECEIPT_NUMBER_CONFLICT','This receipt number is already used for another purchase order.');return {id:prior.rows[0].id,receiptNumber:prior.rows[0].receipt_number,replayed:true};}
  const po=await c.query("SELECT * FROM procurement_orders WHERE id=$1 AND tenant_id=$2 AND status IN ('ACCEPTED','PARTIALLY_RECEIVED') FOR UPDATE",[match[1],auth.tenantId]);if(!po.rowCount)fail(409,'PURCHASE_ORDER_NOT_RECEIVABLE','Only accepted or partially received purchase orders can receive goods.');
  const ids=b.items.map(x=>x.procurementOrderItemId);const lines=await c.query('SELECT * FROM procurement_order_items WHERE tenant_id=$1 AND procurement_order_id=$2 AND id=ANY($3::uuid[]) FOR UPDATE',[auth.tenantId,match[1],ids]);if(lines.rowCount!==ids.length)fail(422,'PO_ITEM_INVALID','One or more receipt lines do not belong to this purchase order.');
  const gr=await c.query('INSERT INTO goods_receipts(tenant_id,receipt_number,procurement_order_id,received_by,notes) VALUES($1,$2,$3,$4,$5) RETURNING *',[auth.tenantId,b.receiptNumber.trim(),match[1],auth.userId,b.notes?.trim()||null]);
  for(const item of b.items){
   const line=lines.rows.find(x=>x.id===item.procurementOrderItemId);const received=milli(item.quantityReceived),accepted=milli(item.quantityQualityAccepted),rejected=milli(item.quantityRejected),remaining=milli(line.quantity_accepted)-milli(line.quantity_received);
   if(received>remaining)fail(409,'RECEIPT_QUANTITY_EXCEEDED','Received quantity exceeds the remaining farmer-accepted quantity for this PO line.');
   const receiptItem=await c.query('INSERT INTO goods_receipt_items(tenant_id,goods_receipt_id,procurement_order_item_id,product_id,quantity_received,quantity_quality_accepted,quantity_rejected,rejection_reason,lot_code) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',[auth.tenantId,gr.rows[0].id,line.id,line.product_id,Number(received)/1000,Number(accepted)/1000,Number(rejected)/1000,item.rejectionReason?.trim()||null,item.lotCode?.trim()||null]);
   await c.query('UPDATE procurement_order_items SET quantity_received=quantity_received+$1,quantity_quality_accepted=quantity_quality_accepted+$2,quantity_rejected=quantity_rejected+$3 WHERE id=$4 AND tenant_id=$5',[Number(received)/1000,Number(accepted)/1000,Number(rejected)/1000,line.id,auth.tenantId]);
   if(accepted>0n)await c.query("INSERT INTO inventory_lots(tenant_id,product_id,goods_receipt_item_id,lot_code,quantity_received,quantity_available,status) VALUES($1,$2,$3,$4,$5,$5,'AVAILABLE')",[auth.tenantId,line.product_id,receiptItem.rows[0].id,item.lotCode.trim(),Number(accepted)/1000]);
  }
  const totals=await c.query('SELECT bool_and(quantity_received>=quantity_accepted) AS complete FROM procurement_order_items WHERE tenant_id=$1 AND procurement_order_id=$2',[auth.tenantId,match[1]]);
  const status=totals.rows[0].complete?'RECEIVED':'PARTIALLY_RECEIVED';
  await c.query('UPDATE procurement_orders SET status=$1,updated_at=now() WHERE id=$2 AND tenant_id=$3',[status,match[1],auth.tenantId]);
  await audit(c,auth,cid,'goods_receipt.posted','goods_receipt',gr.rows[0].id,{receiptNumber:b.receiptNumber.trim(),lineCount:b.items.length,procurementOrderId:match[1],purchaseOrderStatus:status});
  return {id:gr.rows[0].id,receiptNumber:gr.rows[0].receipt_number,procurementOrderId:match[1],purchaseOrderStatus:status,replayed:false};
 });
 return send(res,result,cid),true;
}
