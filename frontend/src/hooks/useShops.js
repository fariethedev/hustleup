import { useCallback, useEffect, useState } from 'react';
import { shopsApi } from '../api/client';

/**
 * Data access for seller storefronts.
 *
 * Shops used to be a hardcoded array in `utils/shopData.js`, which meant nobody owned them
 * and nothing about them could be changed. They are now real records created and edited by
 * the seller who owns them, so every consumer reads through these hooks instead.
 */

// Home, Explore and GlobalSearch can all mount at once; without this they would each fire
// their own GET /shops. Callers share one in-flight request and a short-lived result.
let browseCache = null;
let browseCachedAt = 0;
const BROWSE_TTL_MS = 30_000;

/** Drops the cache so the next read refetches — call after a shop is created or edited. */
export function invalidateShops() {
  browseCache = null;
  browseCachedAt = 0;
}

function fetchShops() {
  const fresh = browseCache && Date.now() - browseCachedAt < BROWSE_TTL_MS;
  if (!fresh) {
    browseCachedAt = Date.now();
    browseCache = shopsApi.browse()
      .then((r) => r.data || [])
      .catch((err) => {
        invalidateShops(); // don't cache a failure — the next caller should retry
        throw err;
      });
  }
  return browseCache;
}

/**
 * Every published storefront.
 *
 * @returns {{shops: object[], loading: boolean, error: boolean, reload: Function}}
 */
export function useShops() {
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback((force = false) => {
    if (force) invalidateShops();
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetchShops()
      .then((data) => { if (!cancelled) setShops(data); })
      .catch(() => { if (!cancelled) { setShops([]); setError(true); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => load(), [load]);

  return { shops, loading, error, reload: () => load(true) };
}

/**
 * One storefront with its full product catalogue.
 *
 * @param {string} idOrSlug shop UUID or readable slug
 */
export function useShop(idOrSlug) {
  const [shop, setShop] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    if (!idOrSlug) { setLoading(false); setError(true); return undefined; }
    let cancelled = false;
    setLoading(true);
    setError(false);
    shopsApi.getById(idOrSlug)
      .then((r) => { if (!cancelled) setShop(r.data); })
      .catch(() => { if (!cancelled) { setShop(null); setError(true); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [idOrSlug]);

  useEffect(() => load(), [load]);

  return { shop, loading, error, reload: load };
}

/**
 * A single product on a storefront — the shape the negotiate/checkout/confirmation pages need.
 *
 * @returns {{shop: object|null, product: object|null, loading: boolean, notFound: boolean}}
 */
export function useShopProduct(idOrSlug, productId) {
  const { shop, loading, error } = useShop(idOrSlug);
  const product = shop ? (shop.products || []).find((p) => p.id === productId) || null : null;
  return { shop, product, loading, notFound: !loading && (error || !shop || !product) };
}

/**
 * A translucent wash of the shop's accent colour, for tinting product imagery.
 * Falls back to the brand lime when a seller hasn't picked a colour.
 */
export function accentWash(accentColor, alpha = '1A') {
  const hex = /^#[0-9a-f]{6}$/i.test(accentColor || '') ? accentColor : '#CDFF00';
  return `${hex}${alpha}`;
}
