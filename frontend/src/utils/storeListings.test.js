import test from 'node:test';
import assert from 'node:assert/strict';
import { storeListing } from './storeListings.js';

test('store products retain checkout identity, seller, images and stock', () => {
  const listing = storeListing({ id: 'shop-1', slug: 'test-shop', ownerId: 'seller', name: 'Shop', city: 'Warsaw', businessType: 'FASHION' }, { id: 'product-1', name: 'Jacket', price: 90, currency: 'PLN', imageUrl: '/uploads/jacket.jpg', stockQuantity: 2 });
  assert.equal(listing.id, 'shop:shop-1:product-1');
  assert.equal(listing.productId, 'product-1');
  assert.equal(listing.shopSlug, 'test-shop');
  assert.equal(listing.title, 'Jacket');
  assert.equal(listing.sellerId, 'seller');
  assert.equal(listing.listingType, 'FASHION');
  assert.equal(listing.status, 'ACTIVE');
  assert.deepEqual(listing.mediaUrls, ['/uploads/jacket.jpg']);
});
test('sold-out products cannot be added as available stock', () => {
  assert.equal(storeListing({ id: 's' }, { id: 'p', stockQuantity: 0 }).status, 'SOLD');
  assert.equal(storeListing({ id: 's' }, { id: 'p', stockQuantity: null }).status, 'ACTIVE');
});
