import test from 'node:test';
import assert from 'node:assert/strict';
import { addCartItem, canPurchaseListing, cartGroup, checkoutPrompts, money } from './marketplace.js';
import { filterListings } from './discovery.js';
import { currentTier, isAllAccessActive, isPremiumActive } from './subscriptions.js';
import { stripeUrl } from './secureLinks.js';
import { isValidPassword, passwordError } from './password.js';
import { deliverySteps, orderState } from './orderState.js';
import { ticketIsPast, ticketStatus } from './tickets.js';

test('mobile membership checks expire safely and map plans to feature tiers', () => {
  const future = new Date(Date.now() + 60_000).toISOString();
  assert.equal(currentTier(null), 'FREE');
  assert.equal(isPremiumActive({ plan: 'PLUS', status: 'CANCELLED' }), false);
  assert.equal(currentTier({ plan: 'PLUS', status: 'ACTIVE', expiresAt: future }), 'MONTHLY');
  assert.equal(isAllAccessActive({ plan: 'VERIFIED', status: 'ACTIVE', expiresAt: future }), true);
});

test('mobile checkout links allow Stripe destinations and reject spoofed hosts', () => {
  assert.equal(stripeUrl('https://checkout.stripe.com/c/pay/session'), 'https://checkout.stripe.com/c/pay/session');
  assert.throws(() => stripeUrl('https://checkout.stripe.com.evil.test/c/pay/session'));
  assert.throws(() => stripeUrl('http://checkout.stripe.com/c/pay/session'));
});

test('mobile password policy accepts strong input and describes missing requirements', () => {
  assert.equal(isValidPassword('Winter!2026safe'), true);
  assert.equal(isValidPassword('Password1!'), false);
  assert.match(passwordError('short'), /at least 10 characters/);
});

test('marketplace filtering, cart identity, stock and checkout prompts compose correctly', () => {
  const source = [
    { id: '1', title: 'Żakiet', description: 'warm coat', locationCity: 'Łódź', listingType: 'FASHION', price: 100, currency: 'PLN', status: 'ACTIVE' },
    { id: '2', title: 'Hidden', locationCity: 'Warsaw', listingType: 'FASHION', status: 'SOLD' },
  ];
  assert.deepEqual(filterListings(source, { query: 'zakiet', city: 'lodz' }).map(x => x.id), ['1']);
  assert.equal(canPurchaseListing({ listingType: 'RENTAL', payOnPlatform: false }), false);
  assert.deepEqual(checkoutPrompts({ checkoutFields: 'Name\n\n  Size  ' }), ['Name', 'Size']);
  assert.equal(cartGroup({ kind: 'product', shopId: 's', currency: 'PLN' }), 'shop:s:PLN');
  const cart = addCartItem([], { id: 'x', kind: 'listing', quantity: 1 });
  assert.equal(addCartItem(cart, { id: 'x', kind: 'listing' })[0].quantity, 2);
  assert.equal(money(0, 'PLN').length > 0, true);
});

test('order actions follow payment, fulfilment and claims', () => {
  const order = { kind: 'booking', status: 'BOOKED', paymentStatus: 'PAID', buyerId: 'buyer', sellerId: 'seller', fulfilment: {} };
  const buyerState = orderState(order, 'buyer');
  assert.equal(buyerState.canPay, false);
  assert.equal(buyerState.canReport, true);
  assert.equal(orderState({ ...order, status: 'CANCELLED' }, 'buyer').canReport, false);
  assert.equal(orderState({ ...order, kind: 'booking', status: 'NEGOTIATING', paymentStatus: null, lastOfferBy: 'seller' }, 'buyer').canRespond, true);
  assert.deepEqual(deliverySteps.PARCEL_LOCKER, ['CONFIRMED', 'PREPARING', 'SHIPPED', 'READY_FOR_PICKUP', 'COLLECTED']);
});

test('ticket status and event time determine whether a ticket is past', () => {
  const now = Date.parse('2026-01-01T00:00:00Z');
  assert.equal(ticketIsPast({ status: 'VALID', eventStartsAt: '2025-12-31T23:59:00Z' }, now), true);
  assert.equal(ticketIsPast({ status: 'VALID', eventStartsAt: '2026-01-02T00:00:00Z' }, now), false);
  assert.equal(ticketIsPast({ status: 'CHECKED_IN' }, now), true);
  assert.equal(ticketStatus('VALID'), 'Ready to go');
});
