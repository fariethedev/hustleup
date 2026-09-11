import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, SlidersHorizontal, X } from 'lucide-react';

/**
 * Mobile-only search and filter controls, collapsed behind two icons.
 *
 * Browse pages were spending three or four full-width rows on a search field and filter
 * chips before a phone showed a single result. This puts both behind icons and expands them
 * inline on demand.
 *
 * Renders nothing above `sm` — pages keep their existing desktop layout, wrapped in
 * `hidden sm:block`. That way the desktop design is untouched rather than reflowed into a
 * shape it wasn't built for.
 *
 * @param {string}   query             current search text
 * @param {Function} onQueryChange     called with the new search text
 * @param {string}   placeholder       search field placeholder
 * @param {number}   [activeFilters]   how many filters are set; drives the badge dot
 * @param {string}   [resultLabel]     e.g. "12 results", shown inside the filter panel
 * @param {Function} [onClear]         clears everything; the button only renders when given
 * @param {Node}     children          the filter controls, shown in the expanded panel
 */
export default function MobileFilterBar({
  query,
  onQueryChange,
  placeholder = 'Search…',
  activeFilters = 0,
  resultLabel,
  onClear,
  children,
}) {
  const [panel, setPanel] = useState(null); // 'search' | 'filters' | null
  const toggle = (which) => setPanel((p) => (p === which ? null : which));

  return (
    <div className="sm:hidden mb-4">
      <div className="flex items-center gap-2">
        {/* The label carries the state a collapsed panel would otherwise hide. */}
        <span className="flex-1 min-w-0 text-[10px] font-black tracking-widest text-gray-500 truncate">
          {query ? `“${query}”` : resultLabel}
        </span>

        <button
          onClick={() => toggle('search')}
          aria-label="Search"
          aria-expanded={panel === 'search'}
          className={`shrink-0 w-9 h-9 rounded-xl border flex items-center justify-center transition-colors ${
            panel === 'search' || query
              ? 'bg-[#CDFF00] text-black border-[#CDFF00]'
              : 'bg-white/5 border-white/10 text-gray-300'
          }`}
        >
          <Search className="w-4 h-4" />
        </button>

        <button
          onClick={() => toggle('filters')}
          aria-label="Filters"
          aria-expanded={panel === 'filters'}
          className={`relative shrink-0 w-9 h-9 rounded-xl border flex items-center justify-center transition-colors ${
            panel === 'filters' || activeFilters > 0
              ? 'bg-[#CDFF00] text-black border-[#CDFF00]'
              : 'bg-white/5 border-white/10 text-gray-300'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          {activeFilters > 0 && panel !== 'filters' && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#00FFFF] border border-black" />
          )}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {panel === 'search' && (
          <motion.div
            key="search"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="relative pt-2.5">
              <Search className="absolute left-4 top-1/2 mt-1 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="search"
                autoFocus
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                placeholder={placeholder}
                className="w-full pl-11 pr-10 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 outline-none focus:border-[#CDFF00]/50 transition-colors"
              />
              {query && (
                <button
                  onClick={() => onQueryChange('')}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 mt-1 -translate-y-1/2 w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center text-gray-400"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </motion.div>
        )}

        {panel === 'filters' && (
          <motion.div
            key="filters"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pt-2.5 space-y-2.5">
              {children}
              {(resultLabel || onClear) && (
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold tracking-widest text-gray-500">
                    {resultLabel}
                  </span>
                  {onClear && activeFilters > 0 && (
                    <button
                      onClick={onClear}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[9px] font-black tracking-widest bg-white/5 border border-white/10 text-gray-300"
                    >
                      <X className="w-3 h-3" /> Clear
                    </button>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
