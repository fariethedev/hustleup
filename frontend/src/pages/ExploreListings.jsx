import { LISTING_TYPES, POLISH_CITIES } from '../utils/constants';
import ListingCard from '../components/ListingCard';
import { ExploreShell, ExploreSelect, ExploreChip, ExploreResults } from '../components/ExploreUI';
import { listingSorts, useExploreParams, useExploreListings } from '../components/explore/useExploreData';

export default function ExploreListings() {
  const { params, setParam, clear } = useExploreParams();
  const q = params.get('q') || '';
  const type = params.get('type') || '';
  const city = params.get('city') || '';
  const sort = params.get('sort') || 'latest';
  const { items, loading, error, reload } = useExploreListings({ q, type, city, sort });
  const hasFilters = !!(q || type || city || sort !== 'latest');
  return (
    <ExploreShell title="Find your next good thing." description="Everyday finds. Independent sellers. A little closer to you." query={q} onQueryChange={(value) => setParam('q', value)} searchLabel="Search listings…" filters={<>
      <div className="discover-chip-row" aria-label="Listing categories">
        <ExploreChip active={!type} onClick={() => setParam('type', '')}>All categories</ExploreChip>
        {LISTING_TYPES.map((t) => <ExploreChip key={t.value} active={type === t.value} onClick={() => setParam('type', type === t.value ? '' : t.value)}><t.icon size={15} />{t.label}</ExploreChip>)}
      </div>
      <div className="discover-filter-row">
        <ExploreSelect label="Filter by city" value={city} onChange={(v) => setParam('city', v)}><option value="">All of Poland</option>{POLISH_CITIES.map((c) => <option key={c}>{c}</option>)}</ExploreSelect>
        <ExploreSelect sort label="Sort listings" value={sort} onChange={(v) => setParam('sort', v === 'latest' ? '' : v)}>{listingSorts.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</ExploreSelect>
        {hasFilters && <button className="discover-clear" onClick={clear}>Reset</button>}
      </div>
    </>}>
      <div className="discover-results-heading"><h2>{LISTING_TYPES.find((t) => t.value === type)?.label || 'All listings'}</h2><span role="status">{loading ? 'Finding your next favourite…' : error ? 'Unavailable' : `${items.length} results`}</span></div>
      <ExploreResults key={params.toString()} items={items} loading={loading} error={error} onRetry={reload} onReset={hasFilters ? clear : undefined} emptyTitle="No listings found" renderItem={(listing, i) => <ListingCard listing={listing} index={i} />} />
    </ExploreShell>
  );
}
