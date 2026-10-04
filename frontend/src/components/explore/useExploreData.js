import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { listingsApi, usersApi } from '../../api/client';
import { convertToPLN } from '../../utils/constants';
import { useShops } from '../../hooks/useShops';
import { storeListing } from '../../utils/storeListings';

export const listingSorts = [
  { value: 'latest', label: 'Newest first' },
  { value: 'best_selling', label: 'Best selling' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'rating', label: 'Top rated' },
];

export function useExploreParams() {
  const [params, setParams] = useSearchParams();
  const setParam = (key, value) => setParams((previous) => {
    const next = new URLSearchParams(previous);
    if (value) next.set(key, value);
    else next.delete(key);
    return next;
  }, { replace: true });
  return { params, setParam, clear: () => setParams({}, { replace: true }) };
}

export function matchesSearch(query, ...fields) {
  const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/gi, 'l').toLowerCase();
  const needle = normalize(query.trim());
  return !needle || fields.some((field) => normalize(field).includes(needle));
}

export function useExploreListings({ q = '', type = '', city = '', sort = 'latest' } = {}) {
  const stores = useShops();
  const [retry, setRetry] = useState(0);
  const key = JSON.stringify([q, type, city, sort, retry]);
  const [result, setResult] = useState({ key: null, data: [], error: false });
  useEffect(() => {
    let active = true;
    // Debounce requests while keeping the input and URL immediately responsive.
    const timer = setTimeout(() => {
      listingsApi.browse({ ...(q && { q }), ...(type && { type }), ...(city && { city }), sort: ['latest', 'best_selling'].includes(sort) ? sort : 'latest' })
        .then((r) => { if (active) setResult({ key, data: r.data || [], error: false }); })
        .catch(() => { if (active) setResult({ key, data: [], error: true }); });
    }, q ? 300 : 0);
    return () => { active = false; clearTimeout(timer); };
  }, [q, type, city, sort, key]);
  const products = stores.shops.flatMap(shop => (shop.products || []).map(product => storeListing(shop, product)))
    .filter(item => item.status === 'ACTIVE' && (!city || item.locationCity === city) && (!type || item.listingType === type)
      && matchesSearch(q, item.title, item.description, item.sellerName, item.category));
  const items = [...result.data, ...products];
  if (sort === 'latest') items.sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
  if (sort === 'price_asc' || sort === 'price_desc') items.sort((a, b) => (convertToPLN(a.price, a.currency) - convertToPLN(b.price, b.currency)) * (sort === 'price_desc' ? -1 : 1));
  if (sort === 'rating') items.sort((a, b) => Number(b.avgRating || 0) - Number(a.avgRating || 0));
  const listingError = result.key === key && result.error;
  return { items, loading: result.key !== key || stores.loading, error: listingError && stores.error,
    partialError: listingError !== stores.error,
    reload: () => { setRetry((n) => n + 1); stores.reload(); } };
}

export function useExploreCreators(currentUserId) {
  const [retry, setRetry] = useState(0);
  const key = `${currentUserId || 'guest'}:${retry}`;
  const [result, setResult] = useState({ key: null, data: [], error: false });
  useEffect(() => {
    let active = true;
    usersApi.getAll()
      .then((r) => { if (active) setResult({ key, data: (r.data || []).filter((u) => u.id !== currentUserId), error: false }); })
      .catch(() => { if (active) setResult({ key, data: [], error: true }); });
    return () => { active = false; };
  }, [currentUserId, key]);
  return { items: result.data, loading: result.key !== key, error: result.key === key && result.error, reload: () => setRetry((n) => n + 1) };
}
