import { Star } from 'lucide-react';

/** Paid membership, deliberately distinct from identity verification and ratings. */
export default function PremiumBadge({ active }) {
  if (!active) return null;
  return <span role="img" aria-label="Premium member" title="Premium member · active paid plan" className="premium-badge inline-flex shrink-0 items-center justify-center align-middle rounded-full p-1">
    <Star size={13} fill="currentColor" aria-hidden="true" />
  </span>;
}
