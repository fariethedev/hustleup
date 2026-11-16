import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile('mobile/src/utils/subscriptions.js', 'utf8');
const { isPremiumActive, isAllAccessActive, currentTier } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const now = Date.parse('2026-10-09T12:00:00Z');
for (const subscription of [null, {}, { plan: 'FREE' }, { plan: 'PLUS', status: 'CANCELLED' }, { plan: 'VERIFIED', expiresAt: '2026-10-08T12:00:00Z' }, { plan: 'VERIFIED', expiresAt: 'invalid' }]) {
  assert.equal(isPremiumActive(subscription, now), false);
  assert.equal(isAllAccessActive(subscription, now), false);
}
assert.equal(isPremiumActive({ plan: 'PLUS', status: 'ACTIVE', expiresAt: '2026-11-09T12:00:00Z' }, now), true);
assert.equal(isAllAccessActive({ plan: 'PLUS' }, now), false);
assert.equal(isAllAccessActive({ plan: 'VERIFIED', status: 'ACTIVE' }, now), true);
assert.equal(currentTier({ plan: 'PLUS' }), 'MONTHLY');
assert.equal(currentTier({ plan: 'VERIFIED' }), 'ALL_ACCESS');
assert.equal(currentTier({ plan: 'FREE' }), 'FREE');
console.log('PASS: Free, Plus and All Access entitlements; cancellation, expiry, invalid dates, and legacy active plans.');
