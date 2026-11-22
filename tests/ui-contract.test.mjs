import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';

const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
test('inline browser application script parses successfully',()=>{
  const scripts=[...html.matchAll(/<script>([\\s\\S]*?)<\\/script>/g)];
  assert.equal(scripts.length,1,'expected one application script');
  assert.doesNotThrow(()=>new Script(scripts[0][1]));
});
test('frontend calls the tenant-scoped API and does not persist access tokens',()=>{
  assert.match(html,/fetch\('\/api\/v1'/);
  assert.match(html,/\/customers\/me\/recurring-basket/);
  assert.match(html,/\/farmers\/me\/listings/);
  assert.doesNotMatch(html,/localStorage|sessionStorage/);
});
