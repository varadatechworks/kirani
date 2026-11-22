export async function runNotificationEmailSweep(pool,{apiKey=process.env.RESEND_API_KEY,from=process.env.NOTIFICATION_FROM_EMAIL,fetchImpl=globalThis.fetch}={}){
 if(!pool||!apiKey||!from||typeof fetchImpl!=='function')return {sent:0,failed:0,skipped:true};
 const client=await pool.connect();let locked=false,open=false;
 try{
  const lock=await client.query("SELECT pg_try_advisory_lock(hashtext('kirani:notification-email-delivery')) AS locked");
  locked=lock.rows[0]?.locked===true;if(!locked)return {sent:0,failed:0,skipped:true};
  await client.query('BEGIN');open=true;
  const claimed=await client.query("WITH due AS (SELECT id FROM notification_email_outbox WHERE attempts<5 AND ((status='PENDING' AND next_attempt_at<=now()) OR (status='SENDING' AND locked_at<=now()-interval '5 minutes')) ORDER BY next_attempt_at,created_at LIMIT 25 FOR UPDATE SKIP LOCKED) UPDATE notification_email_outbox o SET status='SENDING',attempts=o.attempts+1,locked_at=now() FROM due WHERE o.id=due.id RETURNING o.*");
  await client.query('COMMIT');open=false;
  let sent=0,failed=0;
  for(const job of claimed.rows){
   try{
    const response=await fetchImpl('https://api.resend.com/emails',{method:'POST',headers:{authorization:'Bearer '+apiKey,'content-type':'application/json'},body:JSON.stringify({from,to:[job.recipient_email],subject:job.subject,text:job.body_text})});
    let data={};try{data=await response.json()}catch{}
    if(!response.ok||typeof data.id!=='string')throw new Error('EMAIL_PROVIDER_HTTP_'+response.status);
    await client.query("UPDATE notification_email_outbox SET status='SENT',provider_message_id=$1,last_error=NULL,locked_at=NULL,sent_at=now() WHERE id=$2 AND status='SENDING'",[data.id,job.id]);sent++;
   }catch(error){
    const exhausted=job.attempts>=5,delaySeconds=Math.min(3600,30*2**Math.max(0,job.attempts-1));
    await client.query("UPDATE notification_email_outbox SET status=$1,next_attempt_at=now()+make_interval(secs=>$2),last_error=$3,locked_at=NULL WHERE id=$4 AND status='SENDING'",[exhausted?'FAILED':'PENDING',delaySeconds,String(error?.message||'EMAIL_DELIVERY_FAILED').slice(0,120),job.id]);failed++;
   }
  }
  return {sent,failed,skipped:false,claimed:claimed.rowCount};
 }catch(error){if(open)await client.query('ROLLBACK');throw error;}
 finally{if(locked)await client.query("SELECT pg_advisory_unlock(hashtext('kirani:notification-email-delivery'))").catch(()=>{});client.release();}
}
