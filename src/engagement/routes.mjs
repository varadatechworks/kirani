const validId=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const categories=['ORDER','DELIVERY','PAYMENT','PRODUCT','ACCOUNT','OTHER'];
export async function handleEngagementRoutes(ctx){
 const {req,res,cid,path,method,auth,db,bodyJson,transaction,audit,send,fail,requireRole}=ctx;
 if(!path.startsWith('/api/v1/admin/notifications')&&!path.startsWith('/api/v1/customers/me/notifications')&&!path.startsWith('/api/v1/admin/support')&&!path.startsWith('/api/v1/customers/me/support')&&!path.startsWith('/api/v1/admin/reports'))return false;
 const admin=auth.roles.includes('admin');
 if(path.startsWith('/api/v1/admin/'))requireRole(auth,'admin');else requireRole(auth,'customer');
 if(method==='GET'&&path==='/api/v1/customers/me/notifications'){
  const q=await db.query('SELECT id,category,title,body,resource_type,resource_id,read_at,created_at FROM app_notifications WHERE tenant_id=$1 AND user_id=$2 ORDER BY created_at DESC LIMIT 100',[auth.tenantId,auth.userId]);
  return send(res,q.rows.map(x=>({id:x.id,category:x.category,title:x.title,body:x.body,resourceType:x.resource_type,resourceId:x.resource_id,readAt:x.read_at,createdAt:x.created_at})),cid),true;
 }
 const read=path.match(/^\/api\/v1\/customers\/me\/notifications\/([0-9a-f-]+)\/read$/i);
 if(method==='POST'&&read){if(!validId.test(read[1]))fail(404,'NOTIFICATION_NOT_FOUND','Notification was not found.');const q=await db.query('UPDATE app_notifications SET read_at=COALESCE(read_at,now()) WHERE id=$1 AND tenant_id=$2 AND user_id=$3 RETURNING id,read_at',[read[1],auth.tenantId,auth.userId]);if(!q.rowCount)fail(404,'NOTIFICATION_NOT_FOUND','Notification was not found.');return send(res,{id:q.rows[0].id,readAt:q.rows[0].read_at},cid),true;}
 if(method==='GET'&&path==='/api/v1/customers/me/notifications/preferences'){
  const q=await db.query('SELECT category,in_app_enabled,email_enabled,sms_enabled FROM notification_preferences WHERE tenant_id=$1 AND user_id=$2 ORDER BY category',[auth.tenantId,auth.userId]);return send(res,q.rows,cid),true;
 }
 if(method==='PUT'&&path==='/api/v1/customers/me/notifications/preferences'){
  const b=await bodyJson(req);if(!Array.isArray(b.preferences)||b.preferences.length>8||b.preferences.some(x=>!['ORDER','DELIVERY','PAYMENT','PROCUREMENT','LOYALTY','SUPPORT','SYSTEM','CAMPAIGN'].includes(x.category)||typeof x.inAppEnabled!=='boolean'||typeof x.emailEnabled!=='boolean'||typeof x.smsEnabled!=='boolean'))fail(422,'NOTIFICATION_PREFERENCES_INVALID','Provide valid notification channel preferences.');const rows=await transaction(async c=>{const out=[];for(const p of b.preferences){if(p.smsEnabled||p.emailEnabled){}const q=await c.query('INSERT INTO notification_preferences(tenant_id,user_id,category,in_app_enabled,email_enabled,sms_enabled) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(tenant_id,user_id,category) DO UPDATE SET in_app_enabled=EXCLUDED.in_app_enabled,email_enabled=EXCLUDED.email_enabled,sms_enabled=EXCLUDED.sms_enabled,updated_at=now() RETURNING category,in_app_enabled,email_enabled,sms_enabled',[auth.tenantId,auth.userId,p.category,p.inAppEnabled,p.emailEnabled,p.smsEnabled]);out.push(q.rows[0]);}return out;});return send(res,rows,cid),true;
 }
 if(method==='GET'&&path==='/api/v1/admin/notifications/config'){
  return send(res,{emailDeliveryConfigured:Boolean(process.env.RESEND_API_KEY&&process.env.NOTIFICATION_FROM_EMAIL)},cid),true;
 }
 if(method==='GET'&&path==='/api/v1/admin/notifications/delivery'){
  const q=await db.query('SELECT id,recipient_email,subject,status,attempts,next_attempt_at,provider_message_id,last_error,created_at,sent_at FROM notification_email_outbox WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 200',[auth.tenantId]);
  return send(res,q.rows.map(x=>{const [local,domain]=x.recipient_email.split('@');return {id:x.id,recipientMasked:local?local.slice(0,1)+'***@'+domain:'***',subject:x.subject,status:x.status,attempts:x.attempts,nextAttemptAt:x.next_attempt_at,providerMessageId:x.provider_message_id,lastError:x.last_error,createdAt:x.created_at,sentAt:x.sent_at};}),cid),true;
 }
 if(method==='POST'&&path==='/api/v1/admin/notifications'){
  const b=await bodyJson(req);if(!['ORDER','DELIVERY','PAYMENT','PROCUREMENT','LOYALTY','SUPPORT','SYSTEM','CAMPAIGN'].includes(b.category)||typeof b.title!=='string'||b.title.trim().length<2||b.title.trim().length>140||typeof b.body!=='string'||b.body.trim().length<2||b.body.trim().length>2000||b.userId!==undefined&&!validId.test(b.userId)||b.roles!==undefined&&(!Array.isArray(b.roles)||b.roles.some(x=>!['customer','farmer','mill_operator','delivery_operator','admin'].includes(x))))fail(422,'NOTIFICATION_INVALID','Provide a category, title, message and valid audience.');
  const result=await transaction(async client=>{
   let recipients;
   if(b.userId)recipients=await client.query("SELECT id,email FROM users WHERE id=$1 AND tenant_id=$2 AND status='active'",[b.userId,auth.tenantId]);
   else if(Array.isArray(b.roles)&&b.roles.length)recipients=await client.query('SELECT DISTINCT u.id,u.email FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id AND r.tenant_id=u.tenant_id WHERE u.tenant_id=$1 AND u.status=$2 AND r.code=ANY($3::text[])',[auth.tenantId,'active',b.roles]);
   else recipients=await client.query("SELECT id,email FROM users WHERE tenant_id=$1 AND status='active' AND id<>$2",[auth.tenantId,auth.userId]);
   let created=0,inAppCreated=0,queuedEmails=0;
   for(const user of recipients.rows){
    const pref=await client.query('SELECT in_app_enabled,email_enabled FROM notification_preferences WHERE tenant_id=$1 AND user_id=$2 AND category=$3',[auth.tenantId,user.id,b.category]);
    const inApp=pref.rowCount?pref.rows[0].in_app_enabled:true;
    const email=Boolean(pref.rowCount&&pref.rows[0].email_enabled&&user.email);
    if(!inApp&&!email)continue;
    let notificationId=null;
    if(inApp){const n=await client.query('INSERT INTO app_notifications(tenant_id,user_id,category,title,body,resource_type,resource_id) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id',[auth.tenantId,user.id,b.category,b.title.trim(),b.body.trim(),b.resourceType??null,b.resourceId??null]);notificationId=n.rows[0].id;inAppCreated++;}
    if(email){await client.query("INSERT INTO notification_email_outbox(tenant_id,notification_id,user_id,recipient_email,subject,body_text) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(tenant_id,notification_id) DO NOTHING",[auth.tenantId,notificationId,user.id,user.email,b.title.trim(),b.body.trim()]);queuedEmails++;}
    created++;
   }
   await audit(client,auth,cid,'notification.broadcast_created','app_notification',b.resourceId??'',{category:b.category,recipientCount:created,queuedEmailCount:queuedEmails});
   return {recipientCount:created,inAppRecipients:inAppCreated,queuedEmailCount:queuedEmails,channels:[...(inAppCreated?['IN_APP']:[]),...(queuedEmails?['EMAIL']:[])]};
  });
  return send(res,result,cid),true;
 }
 if(method==='GET'&&path==='/api/v1/customers/me/support'){
  const q=await db.query('SELECT t.*,count(m.id)::int AS message_count FROM support_tickets t LEFT JOIN support_messages m ON m.ticket_id=t.id AND m.tenant_id=t.tenant_id AND m.internal_note=false WHERE t.tenant_id=$1 AND t.customer_id=$2 GROUP BY t.id ORDER BY t.created_at DESC LIMIT 100',[auth.tenantId,auth.userId]);return send(res,q.rows.map(x=>({id:x.id,ticketNumber:x.ticket_number,category:x.category,subject:x.subject,status:x.status,priority:x.priority,messageCount:x.message_count,createdAt:x.created_at,updatedAt:x.updated_at})),cid),true;
 }
 if(method==='POST'&&path==='/api/v1/customers/me/support'){
  const b=await bodyJson(req);if(!categories.includes(b.category)||typeof b.subject!=='string'||b.subject.trim().length<4||b.subject.trim().length>160||typeof b.message!=='string'||b.message.trim().length<1||b.message.trim().length>4000||b.orderId!==undefined&&b.orderId!==null&&!validId.test(b.orderId))fail(422,'SUPPORT_TICKET_INVALID','Provide a category, subject and message.');const result=await transaction(async c=>{if(b.orderId){const o=await c.query('SELECT id FROM orders WHERE id=$1 AND tenant_id=$2 AND customer_id=$3',[b.orderId,auth.tenantId,auth.userId]);if(!o.rowCount)fail(404,'ORDER_NOT_FOUND','Related order was not found.');}const num='KT-'+new Date().toISOString().slice(0,10).replaceAll('-','')+'-'+Math.random().toString(36).slice(2,7).toUpperCase();const t=await c.query("INSERT INTO support_tickets(tenant_id,ticket_number,customer_id,category,subject,order_id) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",[auth.tenantId,num,auth.userId,b.category,b.subject.trim(),b.orderId??null]);await c.query('INSERT INTO support_messages(tenant_id,ticket_id,sender_id,message) VALUES($1,$2,$3,$4)',[auth.tenantId,t.rows[0].id,auth.userId,b.message.trim()]);await audit(c,auth,cid,'support.ticket_created','support_ticket',t.rows[0].id,{category:b.category});return {id:t.rows[0].id,ticketNumber:t.rows[0].ticket_number,status:t.rows[0].status};});return send(res,result,cid),true;
 }
 const ticket=path.match(/^\/api\/v1\/(admin\/support|customers\/me\/support)\/([0-9a-f-]+)(?:\/(messages|decision))?$/i);
 if(ticket){
  const [,scope,ticketId,action]=ticket;if(!validId.test(ticketId))fail(404,'SUPPORT_TICKET_NOT_FOUND','Support ticket was not found.');const isAdmin=scope==='admin/support';const where=isAdmin?'tenant_id=$2':'tenant_id=$2 AND customer_id=$3';const args=isAdmin?[ticketId,auth.tenantId]:[ticketId,auth.tenantId,auth.userId];
  if(method==='GET'&&!action){const q=await db.query('SELECT * FROM support_tickets WHERE id=$1 AND '+where,args);if(!q.rowCount)fail(404,'SUPPORT_TICKET_NOT_FOUND','Support ticket was not found.');const m=await db.query('SELECT id,sender_id,message,internal_note,created_at FROM support_messages WHERE tenant_id=$1 AND ticket_id=$2 AND ($3::boolean OR internal_note=false) ORDER BY created_at',[auth.tenantId,ticketId,isAdmin]);return send(res,{id:ticketId,ticketNumber:q.rows[0].ticket_number,status:q.rows[0].status,messages:m.rows.map(x=>({id:x.id,senderId:x.sender_id,message:x.message,internalNote:x.internal_note,createdAt:x.created_at}))},cid),true;}
  if(method==='POST'&&action==='messages'){const b=await bodyJson(req);if(typeof b.message!=='string'||b.message.trim().length<1||b.message.trim().length>4000||isAdmin&&b.internalNote!==undefined&&typeof b.internalNote!=='boolean')fail(422,'SUPPORT_MESSAGE_INVALID','Enter a message up to 4,000 characters.');const result=await transaction(async c=>{const q=await c.query('SELECT * FROM support_tickets WHERE id=$1 AND '+where+' FOR UPDATE',args);if(!q.rowCount)fail(404,'SUPPORT_TICKET_NOT_FOUND','Support ticket was not found.');if(['CLOSED','RESOLVED'].includes(q.rows[0].status))fail(409,'SUPPORT_TICKET_CLOSED','Reopen this ticket through support before adding a message.');const internal=isAdmin&&Boolean(b.internalNote);const m=await c.query('INSERT INTO support_messages(tenant_id,ticket_id,sender_id,message,internal_note) VALUES($1,$2,$3,$4,$5) RETURNING *',[auth.tenantId,ticketId,auth.userId,b.message.trim(),internal]);await c.query("UPDATE support_tickets SET status=CASE WHEN $1 AND NOT $2 THEN 'WAITING_CUSTOMER' WHEN NOT $1 AND status='WAITING_CUSTOMER' THEN 'IN_PROGRESS' ELSE status END,updated_at=now() WHERE id=$3 AND tenant_id=$4",[isAdmin,internal,ticketId,auth.tenantId]);await audit(c,auth,cid,'support.message_added','support_ticket',ticketId,{internalNote:internal});return {id:m.rows[0].id,createdAt:m.rows[0].created_at};});return send(res,result,cid),true;}
  if(method==='POST'&&action==='decision'&&isAdmin){const b=await bodyJson(req);if(!['IN_PROGRESS','WAITING_CUSTOMER','RESOLVED','CLOSED','OPEN'].includes(b.status)||!['LOW','NORMAL','HIGH','URGENT'].includes(b.priority??'NORMAL')||typeof b.reason!=='string'||b.reason.trim().length<5||b.assignedTo!==undefined&&b.assignedTo!==null&&!validId.test(b.assignedTo))fail(422,'SUPPORT_DECISION_INVALID','Choose a valid ticket status, priority and assignee.');const result=await transaction(async c=>{if(b.assignedTo){const u=await c.query("SELECT 1 FROM users WHERE id=$1 AND tenant_id=$2 AND status='active'",[b.assignedTo,auth.tenantId]);if(!u.rowCount)fail(422,'SUPPORT_ASSIGNEE_INVALID','Assignee must be an active user in this tenant.');}const q=await c.query('UPDATE support_tickets SET status=$1,priority=$2,assigned_to=$3,resolved_at=CASE WHEN $1 IN (\'RESOLVED\',\'CLOSED\') THEN now() ELSE NULL END,updated_at=now() WHERE id=$4 AND tenant_id=$5 RETURNING id,status,priority,assigned_to',[b.status,b.priority??'NORMAL',b.assignedTo??null,ticketId,auth.tenantId]);if(!q.rowCount)fail(404,'SUPPORT_TICKET_NOT_FOUND','Support ticket was not found.');await audit(c,auth,cid,'support.ticket_updated','support_ticket',ticketId,{status:b.status,priority:b.priority??'NORMAL',reason:b.reason.trim()});return q.rows[0];});return send(res,result,cid),true;}
 }
 if(method==='GET'&&path==='/api/v1/admin/support'){
  const q=await db.query('SELECT t.*,u.display_name AS customer_name,count(m.id)::int AS message_count FROM support_tickets t JOIN users u ON u.id=t.customer_id LEFT JOIN support_messages m ON m.ticket_id=t.id AND m.tenant_id=t.tenant_id WHERE t.tenant_id=$1 GROUP BY t.id,u.display_name ORDER BY CASE t.priority WHEN \'URGENT\' THEN 0 WHEN \'HIGH\' THEN 1 ELSE 2 END,t.created_at DESC LIMIT 200',[auth.tenantId]);return send(res,q.rows.map(x=>({id:x.id,ticketNumber:x.ticket_number,customerName:x.customer_name,category:x.category,subject:x.subject,status:x.status,priority:x.priority,assignedTo:x.assigned_to,messageCount:x.message_count,createdAt:x.created_at})),cid),true;
 }
 if(method==='GET'&&path==='/api/v1/admin/reports/finance'){
  const [payments,refunds,payables,settlements]=await Promise.all([
   db.query("SELECT COALESCE(sum(amount_minor) FILTER(WHERE entry_type='CAPTURE'),0)::text AS captured_minor,COALESCE(sum(amount_minor) FILTER(WHERE entry_type='REFUND'),0)::text AS refunded_minor,count(DISTINCT order_id) FILTER(WHERE entry_type='CAPTURE')::int AS paid_orders FROM payment_ledger WHERE tenant_id=$1",[auth.tenantId]),
   db.query("SELECT count(*) FILTER(WHERE status='REQUESTED')::int AS requested,count(*) FILTER(WHERE status='APPROVED')::int AS approved,count(*) FILTER(WHERE status='PROCESSED')::int AS processed FROM refund_requests WHERE tenant_id=$1",[auth.tenantId]),
   db.query("SELECT count(*) FILTER(WHERE status='OPEN')::int AS open_count,COALESCE(sum(net_minor) FILTER(WHERE status='OPEN'),0)::text AS open_minor,count(*) FILTER(WHERE status='IN_SETTLEMENT')::int AS in_settlement_count,COALESCE(sum(net_minor) FILTER(WHERE status='IN_SETTLEMENT'),0)::text AS in_settlement_minor,count(*) FILTER(WHERE status='SETTLED')::int AS settled_count,COALESCE(sum(net_minor) FILTER(WHERE status='SETTLED'),0)::text AS settled_minor FROM farmer_payables WHERE tenant_id=$1",[auth.tenantId]),
   db.query("SELECT count(*) FILTER(WHERE status='DRAFT')::int AS draft,count(*) FILTER(WHERE status='APPROVED')::int AS approved,count(*) FILTER(WHERE status='PAID')::int AS paid,COALESCE(sum(net_minor) FILTER(WHERE status='PAID'),0)::text AS paid_minor FROM farmer_settlement_batches WHERE tenant_id=$1",[auth.tenantId])
  ]);return send(res,{payments:payments.rows[0],refunds:refunds.rows[0],farmerPayables:payables.rows[0],farmerSettlements:settlements.rows[0],generatedAt:new Date().toISOString()},cid),true;
 }
 if(method==='GET'&&path==='/api/v1/admin/reports/traceability'){
  const [lots,packages,recalls,processing]=await Promise.all([
   db.query("SELECT count(*)::int AS total,count(*) FILTER(WHERE status='QUARANTINED')::int AS quarantined,count(*) FILTER(WHERE status='RECALLED')::int AS recalled,count(*) FILTER(WHERE expires_on IS NOT NULL AND expires_on<CURRENT_DATE)::int AS expired FROM inventory_lots WHERE tenant_id=$1",[auth.tenantId]),
   db.query("SELECT count(*)::int AS total,count(*) FILTER(WHERE status='RECALLED')::int AS recalled,count(*) FILTER(WHERE status='DELIVERED')::int AS delivered FROM packages WHERE tenant_id=$1",[auth.tenantId]),
   db.query("SELECT count(*)::int AS total,count(*) FILTER(WHERE status='OPEN')::int AS open,count(*) FILTER(WHERE status='CLOSED')::int AS closed FROM inventory_recalls WHERE tenant_id=$1",[auth.tenantId]),
   db.query("SELECT count(*)::int AS jobs,count(*) FILTER(WHERE status='COMPLETED')::int AS completed,count(*) FILTER(WHERE status IN ('QC_PENDING','RECONCILIATION_PENDING','REJECTED'))::int AS blocked FROM processing_jobs WHERE tenant_id=$1",[auth.tenantId])
  ]);return send(res,{inventoryLots:lots.rows[0],packages:packages.rows[0],recalls:recalls.rows[0],processing:processing.rows[0],generatedAt:new Date().toISOString()},cid),true;
 }
 if(method==='GET'&&path==='/api/v1/admin/reports/export'){
  const params=new URL(req.url,'http://kirani.local').searchParams,type=params.get('type')||'operations';
  const from=params.get('from')||new Date(Date.now()-29*86400000).toISOString().slice(0,10),to=params.get('to')||new Date().toISOString().slice(0,10);
  const validDate=x=>/^\\d{4}-\\d{2}-\\d{2}$/.test(x)&&!Number.isNaN(Date.parse(x+'T00:00:00Z'))&&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
  if(!['operations','finance','traceability'].includes(type)||!validDate(from)||!validDate(to)||from>to)fail(422,'REPORT_EXPORT_FILTER_INVALID','Choose a supported report and a valid date range.');
  let columns,rows;
  if(type==='operations'){
   columns=['order_id','delivery_date','created_at','fulfilment_status','payment_status','subtotal_minor','discount_minor','tax_minor','total_minor','currency'];
   const q=await db.query('SELECT id,delivery_date::text,created_at,fulfilment_status,payment_status,subtotal_minor::text,discount_minor::text,tax_minor::text,total_minor::text,currency FROM orders WHERE tenant_id=$1 AND created_at >= $2::date AND created_at < $3::date + interval \'1 day\' ORDER BY created_at',[auth.tenantId,from,to]);rows=q.rows;
  }else if(type==='finance'){
   columns=['entry_id','order_id','transaction_id','entry_type','amount_minor','external_reference','reason','created_at'];
   const q=await db.query('SELECT id AS entry_id,order_id,payment_transaction_id AS transaction_id,entry_type,amount_minor::text,external_reference,reason,created_at FROM payment_ledger WHERE tenant_id=$1 AND created_at >= $2::date AND created_at < $3::date + interval \'1 day\' ORDER BY created_at',[auth.tenantId,from,to]);rows=q.rows;
  }else{
   columns=['package_number','order_id','package_status','packed_at','product_name','quantity','unit_code','lot_code','lot_status','allocated_quantity'];
   const q=await db.query('SELECT p.package_number,p.order_id,p.status AS package_status,p.packed_at,pr.name AS product_name,pi.quantity::text,pi.unit_code,il.lot_code,il.status AS lot_status,pba.quantity::text AS allocated_quantity FROM packages p JOIN package_items pi ON pi.package_id=p.id AND pi.tenant_id=p.tenant_id JOIN products pr ON pr.id=pi.product_id AND pr.tenant_id=pi.tenant_id LEFT JOIN package_batch_allocations pba ON pba.package_item_id=pi.id AND pba.tenant_id=pi.tenant_id LEFT JOIN inventory_lots il ON il.id=pba.inventory_lot_id AND il.tenant_id=pba.tenant_id WHERE p.tenant_id=$1 AND p.packed_at >= $2::date AND p.packed_at < $3::date + interval \'1 day\' ORDER BY p.packed_at,p.package_number',[auth.tenantId,from,to]);rows=q.rows;
  }
  const cell=value=>'"'+String(value??'').replace(/"/g,'""')+'"';
  const csv=[columns.join(','),...rows.map(row=>columns.map(key=>cell(row[key])).join(','))].join('\\r\\n');
  res.writeHead(200,{'content-type':'text/csv; charset=utf-8','content-disposition':'attachment; filename="kirani-'+type+'-'+from+'-'+to+'.csv"','cache-control':'no-store','x-content-type-options':'nosniff'});
  res.end(csv);return true;
 }
 if(method==='GET'&&path==='/api/v1/admin/reports/operations'){
  const [orders,procurement,inventory,delivery,tickets]=await Promise.all([
   db.query('SELECT count(*)::int AS total,count(*) FILTER(WHERE fulfilment_status NOT IN (\'CANCELLED\',\'DELIVERED\'))::int AS open,count(*) FILTER(WHERE fulfilment_status=\'DELIVERED\')::int AS delivered,COALESCE(sum(total_minor) FILTER(WHERE fulfilment_status<>\'CANCELLED\'),0)::text AS order_value_minor FROM orders WHERE tenant_id=$1',[auth.tenantId]),
   db.query('SELECT count(*)::int AS total,count(*) FILTER(WHERE status=\'ISSUED\')::int AS awaiting_farmer FROM procurement_orders WHERE tenant_id=$1',[auth.tenantId]),
   db.query("SELECT count(*)::int AS lots,COALESCE(sum(quantity_available),0)::text AS available FROM inventory_lots WHERE tenant_id=$1 AND status='AVAILABLE'",[auth.tenantId]),
   db.query('SELECT count(*)::int AS total,count(*) FILTER(WHERE status=\'DELIVERED\')::int AS delivered,count(*) FILTER(WHERE status=\'PARTIALLY_DELIVERED\')::int AS partial FROM delivery_assignments WHERE tenant_id=$1',[auth.tenantId]),
   db.query("SELECT count(*)::int AS open FROM support_tickets WHERE tenant_id=$1 AND status NOT IN ('RESOLVED','CLOSED')",[auth.tenantId])
  ]);return send(res,{orders:orders.rows[0],procurement:procurement.rows[0],inventory:inventory.rows[0],delivery:delivery.rows[0],support:tickets.rows[0],generatedAt:new Date().toISOString()},cid),true;
 }
 return false;
}
