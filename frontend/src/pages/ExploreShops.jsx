import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useShops } from '../hooks/useShops';
import ShopCard from '../components/ShopCard';
import { ExploreShell, ExploreSelect, ExploreChip, ExploreResults } from '../components/ExploreUI';
import { matchesSearch, useExploreParams } from '../components/explore/useExploreData';

export default function ExploreShops() {
  const { params, setParam, clear } = useExploreParams();
  const { shops, loading, error, reload } = useShops();
  const q = params.get('q') || '';
  const city = params.get('city') || '';
  const category = params.get('category') || '';
  const categories = useMemo(() => [...new Set(shops.map((s) => s.category).filter(Boolean))].sort(), [shops]);
  const cities = useMemo(() => [...new Set([...shops.map((s) => s.city), city].filter(Boolean))].sort(), [shops, city]);
  const visible = shops.filter((s) => (!city || s.city === city) && (!category || s.category === category) && matchesSearch(q, s.name, s.category, s.tagline, s.description, s.city, s.ownerName));
  const hasFilters = !!(q || city || category);
  return (
    <ExploreShell title="Small shops. Big ideas." description="Discover the people putting their own stamp on campus life." query={q} onQueryChange={(v) => setParam('q', v)} searchLabel="Search shops…" filters={<>
      <div className="discover-chip-row" aria-label="Shop categories">
        <ExploreChip active={!category} onClick={() => setParam('category', '')}>All shops</ExploreChip>
        {[...new Set([...categories, category].filter(Boolean))].map((c) => <ExploreChip key={c} active={category === c} onClick={() => setParam('category', category === c ? '' : c)}>{c}</ExploreChip>)}
      </div>
      <div className="discover-filter-row"><ExploreSelect label="Filter shops by city" value={city} onChange={(v) => setParam('city', v)}><option value="">All of Poland</option>{cities.map((c) => <option key={c}>{c}</option>)}</ExploreSelect>{hasFilters && <button className="discover-clear" onClick={clear}>Reset</button>}</div>
    </>}>
      <div className="discover-results-heading"><h2>{category || 'Independent storefronts'}</h2><span role="status">{loading ? 'Loading shops…' : error ? 'Unavailable' : `${visible.length} shops`}</span></div>
      <ExploreResults key={params.toString()} variant="shops" items={visible} loading={loading} error={error} onRetry={reload} onReset={hasFilters ? clear : undefined} emptyTitle="No shops here yet" emptyMessage={hasFilters ? undefined : 'Make room for your ideas. Open a storefront from your dashboard.'} emptyAction={!hasFilters && <Link to="/dashboard" className="discover-button">Open your shop</Link>} renderItem={(shop, i) => <ShopCard shop={shop} index={i} />} />
    </ExploreShell>
  );
}
