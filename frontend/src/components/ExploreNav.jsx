import { NavLink, useSearchParams } from 'react-router-dom';
import { Compass, ShoppingBag, Store, Users } from 'lucide-react';
import '../styles/discover.css';

const tabs = [
  { to: '/explore', label: 'For you', icon: Compass },
  { to: '/explore/listings', label: 'Listings', icon: ShoppingBag },
  { to: '/explore/shops', label: 'Shops', icon: Store },
  { to: '/explore/creators', label: 'Creators', icon: Users },
];

export default function ExploreNav() {
  const [params] = useSearchParams();
  const shared = new URLSearchParams();
  for (const key of ['q', 'city']) {
    if (params.get(key)) shared.set(key, params.get(key));
  }
  const search = shared.size ? `?${shared}` : '';
  return (
    <nav className="discover-tabs" aria-label="Explore collections">
      {tabs.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={`${to}${search}`} end className={({ isActive }) => `discover-tab${isActive ? ' is-active' : ''}`}>
          {Icon && <Icon size={17} aria-hidden="true" />}{label}
        </NavLink>
      ))}
    </nav>
  );
}
