import test from 'node:test';
import assert from 'node:assert/strict';
import {createRateLimiter} from '../src/security/rate-limit.mjs';

test('rate limiter allows configured requests then returns retry window',()=>{
 const limiter=createRateLimiter({limit:2,windowMs:10_000});
 const req={headers:{},socket:{remoteAddress:'127.0.0.1'}};
 assert.equal(limiter.consume(req,1000).allowed,true);
 assert.equal(limiter.consume(req,1001).remaining,0);
 const blocked=limiter.consume(req,1002);
 assert.equal(blocked.allowed,false);assert.equal(blocked.retryAfterSeconds,10);
 assert.equal(limiter.consume(req,11_001).allowed,true);
});
test('rate limiter keys trusted forwarded addresses only when proxy trust is enabled',()=>{
 const req={headers:{'x-forwarded-for':'203.0.113.8, 10.0.0.1'},socket:{remoteAddress:'10.0.0.2'}};
 const trusted=createRateLimiter({limit:1,windowMs:1000,trustProxy:true});
 const untrusted=createRateLimiter({limit:1,windowMs:1000,trustProxy:false});
 assert.equal(trusted.consume(req,1000).allowed,true);
 assert.equal(trusted.consume({...req,socket:{remoteAddress:'10.0.0.3'}},1001).allowed,false);
 assert.equal(untrusted.consume(req,1000).allowed,true);
 assert.equal(untrusted.consume({...req,socket:{remoteAddress:'10.0.0.3'}},1001).allowed,true);
 assert.equal(untrusted.consume({...req,socket:{remoteAddress:'10.0.0.2'}},1002).allowed,false);
});
