import { useState } from 'react';
import { MapPin, Loader2 } from 'lucide-react';
import { distanceKm, formatDistance, getBrowserLocation } from '../utils/distance';

// Shows "≈3 km away" once the buyer opts in — never requests location automatically
// (browsers throttle/flag prompts that fire on page load, and it's a courtesy to ask).
// Renders nothing if the seller has no geocoded coordinates yet.
export default function DistanceBadge({ lat, lng, className = '' }) {
  const [state, setState] = useState('idle'); // idle | loading | shown | denied
  const [distance, setDistance] = useState(null);

  if (lat == null || lng == null) return null;

  const handleClick = async (e) => {
    e.stopPropagation();
    setState('loading');
    try {
      const buyer = await getBrowserLocation();
      setDistance(distanceKm(buyer.lat, buyer.lng, lat, lng));
      setState('shown');
    } catch {
      setState('denied');
    }
  };

  if (state === 'shown' && distance != null) {
    return (
      <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-[#CDFF00] ${className}`}>
        <MapPin className="w-3 h-3" /> {formatDistance(distance)}
      </span>
    );
  }

  if (state === 'denied') {
    return <span className={`text-[9px] text-gray-600 ${className}`}>Location unavailable</span>;
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={state === 'loading'}
      className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-gray-500 hover:text-[#CDFF00] transition-colors ${className}`}
    >
      {state === 'loading' ? <Loader2 className="w-3 h-3 animate-spin" /> : <MapPin className="w-3 h-3" />}
      {state === 'loading' ? 'Locating…' : 'Show distance'}
    </button>
  );
}
