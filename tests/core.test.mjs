import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeIdentifier,transitionUser,assertActiveUser} from '../src/shared/skeleton/identity.mjs';
import {allowedSimple} from '../src/shared/skeleton/authorization.mjs';
import {normalizeEventLocation} from '../src/shared/skeleton/geo.mjs';
import {redact} from '../src/shared/skeleton/audit.mjs';
import {calculateQuote} from '../src/shared/skeleton/billing.mjs';
import {submitApproval,decideApproval} from '../src/shared/skeleton/approvals.mjs';
import {validateBasketItems,assertCycleOpen} from '../src/domain/baskets.mjs';
import {transitionListing,customerVisibleListing} from '../src/domain/listings.mjs';
test('normalizes email and rejects invalid identifier',()=>{assert.equal(normalizeIdentifier(' A@B.com '),'a@b.com');assert.throws(()=>normalizeIdentifier('bad'))});
test('normalizes phone identifiers to canonical digits with optional country prefix',()=>{assert.equal(normalizeIdentifier('98442 74556'),'9844274556');assert.equal(normalizeIdentifier('+91 (98442)-74556'),'+919844274556');assert.throws(()=>normalizeIdentifier('123-abc-7890'));assert.throws(()=>normalizeIdentifier('123456'));});
test('account transitions require actor and reason',()=>{assert.equal(transitionUser({id:'u',status:'pending'},'active',{actorId:'a',reason:'verified'}).status,'active');assert.throws(()=>transitionUser({id:'u',status:'pending'},'active',{}));assert.throws(()=>assertActiveUser({id:'u',status:'suspended'}))});
test('authorization denies missing grants',()=>{assert.equal(allowedSimple({roles:['farmer'],roleGrants:{farmer:{listings:['view']}},resource:'listings',action:'approve'}),false)});
test('location validates coordinates and unavailable reason',()=>{assert.throws(()=>normalizeEventLocation({source:'DEVICE_GPS',latitude:91,longitude:0,consentStatus:'GRANTED',capturedAt:new Date().toISOString()}));assert.throws(()=>normalizeEventLocation({source:'UNAVAILABLE',consentStatus:'DENIED'}))});
test('audit redacts secrets recursively',()=>{assert.equal(redact({password:'x',nested:{accessToken:'y'}}).password,'[REDACTED]');assert.equal(redact({nested:{accessToken:'y'}}).nested.accessToken,'[REDACTED]')});
test('billing uses integer minor units and basis points',()=>{const q=calculateQuote({tenantId:'t',unitPriceMinor:10000,quantity:2,taxes:[{tenantId:'t',component:'CGST',rateBps:900},{tenantId:'t',component:'SGST',rateBps:900}]});assert.equal(q.totalMinor,23600);assert.throws(()=>calculateQuote({tenantId:'t',unitPriceMinor:10,quantity:1,taxes:[{tenantId:'other',component:'IGST',rateBps:100}]}))});
test('approval maker cannot approve own request',()=>{const req=submitApproval({id:'1',entityType:'listing',entityId:'l',makerId:'m',tenantId:'t'});assert.throws(()=>decideApproval(req,{reviewerId:'m',reviewerTenantId:'t',decision:'approve',canApprove:true,expectedVersion:1}))});
test('basket rejects duplicate products and closed cycles',()=>{assert.throws(()=>validateBasketItems([{productId:'p',quantity:1},{productId:'p',quantity:2}]));assert.throws(()=>assertCycleOpen({status:'CLOSED',cutoffAt:new Date(Date.now()+60000).toISOString()}))});
test('farmer listings are invisible until approved by admin',()=>{const l={id:'l',status:'UNDER_REVIEW'};assert.equal(customerVisibleListing(l),false);assert.equal(transitionListing(l,'APPROVED',{actorId:'admin',reason:'verified',admin:true}).status,'APPROVED');assert.throws(()=>transitionListing(l,'APPROVED',{actorId:'farmer',reason:'self',admin:false}))});

test('authorization uses own grants only and safely denies prototype keys and malformed grants',()=>{
  const grants={farmer:{listings:['view']}};
  assert.equal(allowedSimple({roles:['farmer'],roleGrants:grants,resource:'listings',action:'view'}),true);
  for(const resource of ['toString','constructor','__proto__'])assert.equal(allowedSimple({roles:['farmer'],roleGrants:grants,resource,action:'view'}),false);
  assert.equal(allowedSimple({roles:['toString'],roleGrants:{},resource:'listings',action:'view'}),false);
  assert.equal(allowedSimple({roles:['farmer'],roleGrants:{farmer:{listings:'view'}},resource:'listings',action:'view'}),false);
  assert.equal(allowedSimple({roles:['farmer'],roleGrants:Object.create({farmer:{listings:['view']}}),resource:'listings',action:'view'}),false);
});
test('authorization rejects unknown actions and requireSimple returns a stable forbidden error',()=>{
  assert.equal(allowedSimple({roles:['admin'],roleGrants:{admin:{orders:['view']}},resource:'orders',action:'execute'}),false);
  assert.throws(()=>requireSimple({roles:['customer'],roleGrants:{customer:{orders:['view']}},resource:'orders',action:'delete'}),error=>error.status===403&&error.code==='FORBIDDEN');
});
