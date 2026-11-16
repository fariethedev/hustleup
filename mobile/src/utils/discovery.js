export function storeListing(shop, product) {
  return {
    ...product, id: `shop:${shop.id}:${product.id}`, productId: product.id,
    shopId: shop.id, shopName: shop.name, shopSlug: shop.slug || shop.id,
    title: product.name, sellerId: shop.ownerId, sellerName: shop.name,
    sellerPremium: shop.ownerPremium, locationCity: shop.city,
    listingType: /fashion|clothing/i.test(shop.businessType || shop.category) ? 'FASHION' : /food|bakery/i.test(shop.businessType || shop.category) ? 'FOOD' : 'GOODS',
    mediaUrls: product.imageUrl ? [product.imageUrl] : [],
    status: product.stockQuantity != null && product.stockQuantity <= 0 ? 'SOLD' : 'ACTIVE',
    avgRating: shop.rating || 0,
  };
}
export function discoveryCartItem(item) {
  return item.shopId ? { ...item, id: item.productId, kind: 'product', name: item.title } : { ...item, kind: 'listing' };
}
export const normalized = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/ł/g, 'l');
export function filterListings(listings, { query = '', category = '', city = '', sort = 'latest' } = {}) {
  const result = listings.filter(item => (!item.status || item.status === 'ACTIVE') && (!category || item.listingType === category)
    && normalized(item.locationCity).includes(normalized(city))
    && normalized([item.title, item.description, item.sellerName, item.locationCity].join(' ')).includes(normalized(query.trim())));
  // Keep different currencies separate rather than implying an unverified exchange rate.
  return result.sort((a, b) => sort.startsWith('price')
    ? (a.currency || 'PLN').localeCompare(b.currency || 'PLN') || (Number(a.price) - Number(b.price)) * (sort === 'price-high' ? -1 : 1)
    : sort === 'rating' ? Number(b.avgRating || 0) - Number(a.avgRating || 0)
    : (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
}
