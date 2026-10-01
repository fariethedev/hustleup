import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronDown, MapPin, Search, SlidersHorizontal, X } from 'lucide-react';
import ExploreNav from './ExploreNav';
import '../styles/discover.css';

export function ExploreShell({ title, description, query, onQueryChange, searchLabel, filters, children }) {
  return (
    <div className="discover-page">
      <div className="discover-container">
        <header className="discover-heading">
          <div><span className="discover-eyebrow">The student marketplace</span><h1>{title}</h1><p>{description}</p></div>
          <Link to="/create" className="discover-button discover-button-secondary discover-sell">Start selling <ArrowRight size={16} /></Link>
        </header>
        <div className="discover-toolbar">
          <div className="discover-search" role="search">
            <Search size={19} aria-hidden="true" />
            <input type="search" aria-label={searchLabel} placeholder={searchLabel} value={query} onChange={(e) => onQueryChange(e.target.value)} />
            {query && <button type="button" className="discover-icon-button" aria-label="Clear search" onClick={() => onQueryChange('')}><X size={17} /></button>}
          </div>
          <ExploreNav />
        </div>
        {filters && <div className="discover-filters">{filters}</div>}
        <div className="discover-content">{children}</div>
      </div>
    </div>
  );
}

export function ExploreSelect({ label, value, onChange, children, sort = false }) {
  const Icon = sort ? SlidersHorizontal : MapPin;
  return (
    <label className={`discover-select${value && value !== 'latest' ? ' is-filtered' : ''}`}>
      <Icon size={15} aria-hidden="true" />
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>{children}</select>
      <ChevronDown size={13} aria-hidden="true" />
    </label>
  );
}

export function ExploreChip({ active, onClick, children }) {
  return <button type="button" className={`discover-chip${active ? ' is-active' : ''}`} aria-pressed={!!active} onClick={onClick}>{children}</button>;
}

export function ExploreSection({ title, subtitle, to, children }) {
  return (
    <section className="discover-section">
      <div className="discover-section-heading">
        <div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
        {to && <Link to={to} className="discover-text-link">View all <ArrowRight size={16} /></Link>}
      </div>
      {children}
    </section>
  );
}

export function ExploreEmpty({ title = 'Nothing here just yet', message = 'Try another search or give your filters a little more room.', onReset, error = false, action }) {
  return (
    <div className="discover-empty" role={error ? 'alert' : 'status'}>
      <Search size={28} aria-hidden="true" />
      <h2>{title}</h2><p>{message}</p>
      {onReset && <button type="button" className="discover-button discover-button-secondary" onClick={onReset}>{error ? 'Try again' : 'Clear filters'}</button>}
      {action}
    </div>
  );
}

// Callers key this component by filters so changing a collection resets its visible page.
export function ExploreResults({ items, renderItem, loading, error, onRetry, onReset, variant = 'products', emptyTitle, emptyMessage, emptyAction }) {
  const [limit, setLimit] = useState(24);
  if (loading) return (
    <div className={`discover-grid discover-grid-${variant}`} role="status" aria-label="Loading results" aria-busy="true">
      {Array.from({ length: variant === 'products' ? 8 : 6 }, (_, i) => <div key={i} className="discover-skeleton"><div /><span /><span /></div>)}
    </div>
  );
  if (error) return <ExploreEmpty error title="Couldn't load this collection" message="Please try again in a moment." onReset={onRetry} />;
  if (!items.length) return <ExploreEmpty title={emptyTitle} message={emptyMessage} onReset={onReset} action={emptyAction} />;
  return (
    <>
      <div className={`discover-grid discover-grid-${variant}`}>
        {items.slice(0, limit).map((item, i) => <div key={item.id} className="discover-grid-item">{renderItem(item, i)}</div>)}
      </div>
      {items.length > limit && <div className="discover-pagination"><button type="button" className="discover-button discover-button-secondary" onClick={() => setLimit((n) => n + 24)}>Show more <ChevronDown size={16} /></button><p>Showing {Math.min(limit, items.length)} of {items.length}</p></div>}
    </>
  );
}
