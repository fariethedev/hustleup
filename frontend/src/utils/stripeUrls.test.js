import test from 'node:test';
import assert from 'node:assert/strict';
import { stripeHostedUrl } from './stripeUrls.js';

test('accepts both documented Stripe Express dashboard link hosts', () => {
  for (const url of ['https://connect.stripe.com/express/acct_test/login', 'https://stripe.com/express/login']) {
    assert.equal(stripeHostedUrl(url, 'dashboard'), url);
  }
});

test('rejects unsafe dashboard destinations and non-Express paths', () => {
  for (const url of [
    undefined, '/express/login', 'javascript:alert(1)',
    'http://connect.stripe.com/express/login',
    'https://connect.stripe.com.evil.example/express/login',
    'https://evil.example/express/login',
    'https://user:password@connect.stripe.com/express/login',
    'https://connect.stripe.com:444/express/login',
    'https://connect.stripe.com/setup/login',
    'https://stripe.com/express/../elsewhere',
  ]) assert.throws(() => stripeHostedUrl(url, 'dashboard'));
});

test('keeps checkout and onboarding destination checks separate', () => {
  assert.equal(stripeHostedUrl('https://checkout.stripe.com/c/pay/test', 'checkout'), 'https://checkout.stripe.com/c/pay/test');
  assert.equal(stripeHostedUrl('https://connect.stripe.com/setup/test'), 'https://connect.stripe.com/setup/test');
  assert.throws(() => stripeHostedUrl('https://stripe.com/express/login', 'checkout'));
  assert.throws(() => stripeHostedUrl('https://checkout.stripe.com/c/pay/test', 'connect'));
  assert.throws(() => stripeHostedUrl('https://connect.stripe.com/express/login', 'unknown'));
});
