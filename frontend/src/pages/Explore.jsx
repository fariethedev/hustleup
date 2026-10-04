import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { Store } from 'lucide-react';
import { selectUser } from '../store/authSlice';
import { LISTING_TYPES, POLISH_CITIES } from '../utils/constants';
import { useShops } from '../hooks/useShops';
import ListingCard from '../components/ListingCard';
import ShopCard from '../components/ShopCard';
import CreatorCard from '../components/CreatorCard';
import SmartImage from '../components/SmartImage';
import { ExploreShell, ExploreSelect, ExploreChip, ExploreResults, ExploreSection } from '../components/ExploreUI';
import { listingSorts, matchesSearch, useExploreParams, useExploreListings, useExploreCreators } from '../components/explore/useExploreData';

export default function Explore() {
  const currentUser = useSelector(selectUser);
  const { params, setParam, clear } = useExploreParams();
  const q = params.get('q') || '';
  const city = params.get('city') || '';
  const type = params.get('type') || '';
  const sort = params.get('sort') || 'latest';
  const listings = useExploreListings({ q, city, type, sort });
  const creators = useExploreCreators(currentUser?.id);
  const { shops: allShops, loading: shopsLoading, error: shopsError, reload: reloadShops } = useShops();
  const shops = allShops.filter((s) => (!city || s.city === city) && matchesSearch(q, s.name, s.category, s.tagline, s.city, s.ownerName));
  const people = creators.items.filter((u) => (!city || u.city === city) && matchesSearch(q, u.fullName, u.username, u.city, u.bio));
  const hasFilters = !!(q || city || type || sort !== 'latest');
  const collectionLink = (collection) => {
    const next = new URLSearchParams(params);
    if (collection !== 'listings') { next.delete('type'); next.delete('sort'); }
    return `/explore/${collection}${next.size ? `?${next}` : ''}`;
  };
  return (
    <ExploreShell title="A little discovery goes a long way." description="Find your next favourite. Meet the people behind it." query={q} onQueryChange={(v) => setParam('q', v)} searchLabel="Search listings, shops, people…" filters={<>
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
      <ExploreSection title={q ? `Listings for “${q}”` : 'Discover something good'} subtitle={city ? `From your community in ${city}` : 'Fresh finds from the student community'} to={collectionLink('listings')}>
        {!listings.loading && listings.partialError && <p role="status" className="text-sm text-gray-400 mb-3">Some listings could not be loaded. Showing available results. <button onClick={listings.reload} className="underline min-h-11">Retry</button></p>}
        <ExploreResults key={params.toString()} items={listings.items.slice(0, 12)} loading={listings.loading} error={listings.error} onRetry={listings.reload} onReset={hasFilters ? clear : undefined} emptyTitle="No listings found" renderItem={(listing, i) => <ListingCard listing={listing} index={i} />} />
      </ExploreSection>
      {!hasFilters && shops.length > 0 && <div className="discover-shop-stories" aria-label="Discover student shops">
        {shops.slice(0, 12).map((shop) => <Link key={shop.id} to={`/shop/${shop.slug || shop.id}`} className="discover-shop-story"><div><SmartImage src={shop.logoUrl || shop.bannerUrl} alt="" fallbackIcon={Store} /></div><span>{shop.name}</span></Link>)}
        <Link className="discover-shop-story" to="/explore/shops"><div className="discover-story-all"><Store size={24} /></div><span>All shops</span></Link>
      </div>}
      <ExploreSection title="Shops with a point of view" subtitle="Small businesses worth getting to know" to={collectionLink('shops')}>
        <ExploreResults key={`shops:${params}`} variant="shops" items={shops.slice(0, 3)} loading={shopsLoading} error={shopsError} onRetry={reloadShops} onReset={hasFilters ? clear : undefined} emptyTitle="No shops found" renderItem={(shop, i) => <ShopCard shop={shop} index={i} />} />
      </ExploreSection>
      <ExploreSection title="Your kind of people" subtitle="A community built on doing your own thing" to={collectionLink('creators')}>
        <ExploreResults key={`creators:${params}`} variant="creators" items={people.slice(0, 4)} loading={creators.loading} error={creators.error} onRetry={creators.reload} onReset={hasFilters ? clear : undefined} emptyTitle="No creators found" renderItem={(user, i) => <CreatorCard user={user} index={i} variant="full" />} />
      </ExploreSection>
    </ExploreShell>
  );
}
