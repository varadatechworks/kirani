export function createRateLimiter({limit=120,windowMs=60_000,maxKeys=10_000,trustProxy=false}={}){
 if(!Number.isSafeInteger(limit)||limit<1||!Number.isSafeInteger(windowMs)||windowMs<1000||!Number.isSafeInteger(maxKeys)||maxKeys<100)throw new TypeError('Invalid rate limiter configuration');
 const buckets=new Map();
 function consume(req,now=Date.now()){
  const forwarded=trustProxy&&typeof req.headers?.['x-forwarded-for']==='string'?req.headers['x-forwarded-for'].split(',')[0].trim():null;
  const key=forwarded||req.socket?.remoteAddress||'unknown';
  let bucket=buckets.get(key);
  if(!bucket||now-bucket.startedAt>=windowMs){bucket={startedAt:now,count:0};buckets.set(key,bucket);}
  if(bucket.count>=limit)return {allowed:false,limit,remaining:0,resetAt:bucket.startedAt+windowMs,retryAfterSeconds:Math.max(1,Math.ceil((bucket.startedAt+windowMs-now)/1000))};
  bucket.count++;
  if(buckets.size>maxKeys){for(const [k,v] of buckets){if(now-v.startedAt>=windowMs)buckets.delete(k);if(buckets.size<=maxKeys)break;}while(buckets.size>maxKeys)buckets.delete(buckets.keys().next().value);}
  return {allowed:true,limit,remaining:Math.max(0,limit-bucket.count),resetAt:bucket.startedAt+windowMs,retryAfterSeconds:0};
 }
 return Object.freeze({consume,clear:()=>buckets.clear(),size:()=>buckets.size});
}
