export function storeListing(shop, product) {
  return {
    ...product,
    id: `shop:${shop.id}:${product.id}`,
    productId: product.id,
    shopId: shop.id,
    shopSlug: shop.slug || shop.id,
    title: product.name,
    sellerId: shop.ownerId,
    sellerName: shop.name,
    locationCity: shop.city,
    listingType: /fashion|clothing/i.test(shop.businessType || shop.category) ? 'FASHION' : /food|bakery/i.test(shop.businessType || shop.category) ? 'FOOD' : 'GOODS',
    mediaUrls: product.imageUrl ? [product.imageUrl] : [],
    status: product.stockQuantity != null && product.stockQuantity <= 0 ? 'SOLD' : 'ACTIVE',
    avgRating: shop.rating || 0,
  };
}
