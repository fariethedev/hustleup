import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// These pure helpers are shared by the native screens; no production calls.
const load = async path => import('data:text/javascript;base64,' + Buffer.from(await readFile(new URL(path, import.meta.url), 'utf8')).toString('base64'));
const { orderState, deliverySteps } = await load('../mobile/src/utils/orderState.js');
const { stripeUrl } = await load('../mobile/src/utils/secureLinks.js');
const order = { id: 'order', kind: 'booking', buyerId: 'buyer', sellerId: 'seller', status: 'BOOKED', paymentStatus: 'PAID' };
assert.equal(orderState(order, 'buyer').canReceive, true);
assert.equal(orderState(order, 'seller').canReceive, false);
assert.equal(orderState(order, 'seller').canTrack, true);
assert.equal(orderState({ ...order, paymentStatus: 'PENDING' }, 'buyer').canReceive, false);
assert.equal(orderState({ ...order, paymentStatus: 'PENDING' }, 'seller').canTrack, false);
assert.equal(orderState(order, 'buyer', { status: 'OPEN' }).canReceive, false);
assert.equal(orderState(order, 'buyer', { status: 'OPEN' }).payout, 'On hold · problem reported');
assert.equal(orderState({ ...order, fulfilment: { buyerConfirmedAt: '2026-10-05' } }, 'buyer').canReceive, false);
assert.equal(orderState({ ...order, paymentStatus: 'REFUNDED' }, 'buyer').canPay, false);
const negotiating = { ...order, status: 'NEGOTIATING', lastOfferBy: 'seller' };
assert.equal(orderState(negotiating, 'buyer').canRespond, true);
assert.equal(orderState(negotiating, 'seller').canRespond, false);
assert.equal(orderState({ ...negotiating, lastOfferBy: 'buyer' }, 'seller').canRespond, true);
assert.equal(orderState({ ...order, kind: 'shop', status: 'PAID', paymentStatus: undefined, payoutStatus: 'RELEASED' }, 'buyer').payout, 'Released to seller');
assert.deepEqual(deliverySteps.DIGITAL, ['CONFIRMED', 'DELIVERED']);
assert.deepEqual(deliverySteps.PICKUP, ['CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'COLLECTED']);
assert.equal(stripeUrl('https://checkout.stripe.com/c/pay/test'), 'https://checkout.stripe.com/c/pay/test');
assert.equal(stripeUrl('https://stripe.com/express/test', 'dashboard'), 'https://stripe.com/express/test');
for (const link of ['http://checkout.stripe.com/test', 'https://checkout.stripe.com.evil.test/test', 'https://user@checkout.stripe.com/test', 'javascript:alert(1)']) assert.throws(() => stripeUrl(link));
assert.throws(() => stripeUrl('https://stripe.com/unrelated', 'dashboard'));
console.log('PASS native order permissions, negotiation turns, delivery tracks, payout state and secure payment links');
