import test from 'node:test';
import assert from 'node:assert/strict';
import { isAllAccessActive, isPremiumActive, isPremiumRequiredError, PLAN_IDS } from './premium.js';

test('premium and All Access access checks fail closed for missing, inactive, or expired plans', () => {
  const future = new Date(Date.now() + 60_000).toISOString();
  assert.equal(isPremiumActive(null), false);
  assert.equal(isPremiumActive({ plan: 'PLUS', status: 'CANCELLED' }), false);
  assert.equal(isPremiumActive({ plan: 'PLUS', expiresAt: '2000-01-01T00:00:00Z' }), false);
  assert.equal(isPremiumActive({ plan: 'PLUS', status: 'ACTIVE', expiresAt: future }), true);
  assert.equal(isAllAccessActive({ plan: 'PLUS', status: 'ACTIVE', expiresAt: future }), false);
  assert.equal(isAllAccessActive({ plan: 'VERIFIED', status: 'ACTIVE', expiresAt: future }), true);
});

test('plan identifiers and premium required API errors remain explicit', () => {
  assert.deepEqual(PLAN_IDS, ['MONTHLY', 'ALL_ACCESS']);
  assert.equal(isPremiumRequiredError({ response: { status: 403, data: { code: 'PREMIUM_REQUIRED' } } }), true);
  assert.equal(isPremiumRequiredError({ response: { status: 403, data: { code: 'FORBIDDEN' } } }), false);
});
