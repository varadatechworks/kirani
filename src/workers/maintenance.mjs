export async function runInventoryExpirySweep(pool){
 if(!pool)return {expiredReservations:0,skipped:true};
 const client=await pool.connect();
 let locked=false,transactionOpen=false;
 try{
  const lock=await client.query("SELECT pg_try_advisory_lock(hashtext('kirani:inventory-reservation-expiry')) AS locked");
  locked=lock.rows[0]?.locked===true;
  if(!locked)return {expiredReservations:0,skipped:true};
  await client.query('BEGIN');transactionOpen=true;
  const expired=await client.query("SELECT * FROM inventory_reservations WHERE status='ACTIVE' AND reference_type<>'PROCESSING_JOB' AND expires_at IS NOT NULL AND expires_at<=now() ORDER BY expires_at,id LIMIT 500 FOR UPDATE SKIP LOCKED");
  let released=0;
  for(const reservation of expired.rows){
   const items=await client.query('SELECT * FROM inventory_reservation_items WHERE tenant_id=$1 AND reservation_id=$2 ORDER BY lot_id',[reservation.tenant_id,reservation.id]);
   for(const item of items.rows){
    const lot=await client.query('UPDATE inventory_lots SET quantity_available=quantity_available+$1,quantity_reserved=quantity_reserved-$1 WHERE id=$2 AND tenant_id=$3 AND quantity_reserved>=$1 RETURNING location_id',[item.quantity,item.lot_id,reservation.tenant_id]);
    if(!lot.rowCount)throw new Error('Reservation expiry found an inconsistent reserved stock balance.');
    await client.query("INSERT INTO inventory_ledger(tenant_id,lot_id,product_id,location_id,event_type,quantity_reserved_delta,quantity_available_delta,reference_type,reference_id,reason,actor_id,actor_type,correlation_id) VALUES($1,$2,$3,$4,'RELEASE',$5,$6,'INVENTORY_RESERVATION',$7,'Reservation expired automatically',NULL,'SYSTEM',$8)",[reservation.tenant_id,item.lot_id,item.product_id,lot.rows[0].location_id,-Number(item.quantity),Number(item.quantity),reservation.id,'maintenance:'+reservation.id]);
   }
   await client.query("UPDATE inventory_reservations SET status='RELEASED',released_by=NULL,release_reason='Reservation expiry policy',released_at=now() WHERE id=$1 AND tenant_id=$2",[reservation.id,reservation.tenant_id]);
   released++;
  }
  await client.query('COMMIT');transactionOpen=false;
  return {expiredReservations:released,skipped:false};
 }catch(error){
  if(transactionOpen)await client.query('ROLLBACK');
  throw error;
 }finally{
  if(locked)await client.query("SELECT pg_advisory_unlock(hashtext('kirani:inventory-reservation-expiry'))").catch(()=>{});
  client.release();
 }
}
