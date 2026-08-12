import { algoliasearch } from 'algoliasearch';

const appId = import.meta.env.VITE_ALGOLIA_APP_ID;
const searchKey = import.meta.env.VITE_ALGOLIA_SEARCH_KEY;

export const algoliaEnabled = Boolean(appId && searchKey);

const client = algoliaEnabled ? algoliasearch(appId, searchKey) : null;

// Returns null (rather than throwing) whenever Algolia isn't configured or the request
// fails, so callers can fall back to the existing client-side listing filter.
export async function searchListings(query, hitsPerPage = 6) {
  if (!client || !query) return null;
  try {
    const { hits } = await client.searchSingleIndex({
      indexName: 'listings',
      searchParams: { query, hitsPerPage },
    });
    return hits;
  } catch {
    return null;
  }
}
