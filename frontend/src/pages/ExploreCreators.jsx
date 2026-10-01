import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { BadgeCheck } from 'lucide-react';
import { selectUser } from '../store/authSlice';
import CreatorCard from '../components/CreatorCard';
import { ExploreShell, ExploreSelect, ExploreChip, ExploreResults } from '../components/ExploreUI';
import { matchesSearch, useExploreParams, useExploreCreators } from '../components/explore/useExploreData';

const roles = [{ value: '', label: 'Everyone' }, { value: 'SELLER', label: 'Sellers' }, { value: 'BUYER', label: 'Hustlers' }];

export default function ExploreCreators() {
  const currentUser = useSelector(selectUser);
  const { params, setParam, clear } = useExploreParams();
  const { items, loading, error, reload } = useExploreCreators(currentUser?.id);
  const q = params.get('q') || '';
  const city = params.get('city') || '';
  const role = params.get('role') || '';
  const verified = params.get('verified') === '1';
  const cities = [...new Set([...items.map((u) => u.city), city].filter(Boolean))].sort();
  const visible = items.filter((u) => (!city || u.city === city) && (!role || (role === 'SELLER' ? u.role === 'SELLER' : u.role !== 'SELLER')) && (!verified || u.idVerified) && matchesSearch(q, u.fullName, u.username, u.city, u.bio));
  const hasFilters = !!(q || city || role || verified);
  return (
    <ExploreShell title="Good people. Great potential." description="Meet the makers, sellers and next big ideas in your community." query={q} onQueryChange={(v) => setParam('q', v)} searchLabel="Search people…" filters={<>
      <div className="discover-chip-row" aria-label="Creator filters">
        {roles.map((r) => <ExploreChip key={r.value} active={role === r.value} onClick={() => setParam('role', r.value)}>{r.label}</ExploreChip>)}
        <ExploreChip active={verified} onClick={() => setParam('verified', verified ? '' : '1')}><BadgeCheck size={15} />Verified only</ExploreChip>
      </div>
      <div className="discover-filter-row"><ExploreSelect label="Filter creators by city" value={city} onChange={(v) => setParam('city', v)}><option value="">All of Poland</option>{cities.map((c) => <option key={c}>{c}</option>)}</ExploreSelect>{hasFilters && <button className="discover-clear" onClick={clear}>Reset</button>}</div>
    </>}>
      <div className="discover-results-heading"><h2>People to know</h2><span role="status">{loading ? 'Finding your community…' : error ? 'Unavailable' : `${visible.length} people`}</span></div>
      <ExploreResults key={params.toString()} variant="creators" items={visible} loading={loading} error={error} onRetry={reload} onReset={hasFilters ? clear : undefined} emptyTitle="No creators found" emptyMessage={!currentUser && !hasFilters ? 'Sign in to discover more people building on HustleSpace.' : undefined} emptyAction={!currentUser && !hasFilters && <Link to="/login" className="discover-button">Sign in</Link>} renderItem={(user, i) => <CreatorCard user={user} index={i} variant="full" />} />
    </ExploreShell>
  );
}
