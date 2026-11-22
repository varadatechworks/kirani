import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';

const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
test('inline browser application script parses successfully',()=>{
  const scripts=html.split('<script>').slice(1).map(part=>part.split('</script>')[0]);
  assert.equal(scripts.length,1,'expected one application script');
  assert.doesNotThrow(()=>new Script(scripts[0]));
});
test('frontend calls tenant-scoped APIs and does not persist access tokens',()=>{
  assert.ok(html.includes("fetch('/api/v1'+path)"));
  assert.ok(html.includes('/customers/me/recurring-basket'));
  assert.ok(html.includes('/farmers/me/listings'));
  assert.ok(!html.includes('localStorage'));
  assert.ok(!html.includes('sessionStorage'));
});
