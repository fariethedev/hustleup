import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Compass, LayoutGrid, ShoppingBag, Store, Users } from 'lucide-react';

/**
 * The tab bar shared by /explore and every /explore/* browse page.
 *
 * Keeping one component for all of them means the tabs never shift position or change
 * labels as you move between the overview and a full collection — you always know where
 * you are and how to get to the other three.
 */
const TABS = [
  { to: '/explore', label: 'Overview', icon: LayoutGrid },
  { to: '/explore/listings', label: 'Listings', icon: ShoppingBag },
  { to: '/explore/shops', label: 'Shops', icon: Store },
  { to: '/explore/creators', label: 'Creators', icon: Users },
];

export default function ExploreNav() {
  const { pathname } = useLocation();

  return (
    <div className="sticky top-14 md:top-16 z-[90] bg-black/85 backdrop-blur-md border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-center gap-2 sm:gap-3">
        <span className="hidden sm:flex items-center gap-1.5 text-sm font-black text-white tracking-tighter shrink-0">
          <Compass className="w-4 h-4 text-[#FF00FF]" /> Explore
        </span>
        <div className="hidden sm:block w-px h-5 bg-white/10 shrink-0" />

        <nav className="flex items-center justify-center gap-1.5 overflow-x-auto overscroll-x-contain scrollbar-hide">
          {TABS.map((tab) => {
            // Exact match on /explore so the overview tab doesn't stay lit on sub-pages.
            const active = tab.to === '/explore' ? pathname === '/explore' : pathname.startsWith(tab.to);
            return (
              <Link
                key={tab.to}
                to={tab.to}
                className={`relative flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-[10px] font-black tracking-widest whitespace-nowrap transition-colors ${
                  active ? 'text-black' : 'text-gray-400 hover:text-white'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="explore-tab-pill"
                    className="absolute inset-0 rounded-xl bg-[#00FFFF] shadow-[0_0_16px_rgba(0,255,255,0.35)]"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <tab.icon className="relative w-4 h-4" />
                <span className="relative">{tab.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
