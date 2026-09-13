import { MessageCircleMore } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatPrice } from '../../utils/constants';
import { TONE } from './format';

/**
 * Pieces shared by the admin console's tabs.
 *
 * <p>Extracted from Admin.jsx when the console grew a sales report and two moderation
 * queues. They live here rather than being exported from Admin.jsx itself because the tabs
 * import them and Admin.jsx imports the tabs — exporting from there would be a cycle.
 */

export function Skeleton({ rows = 3 }) {
  return (
    <div className="space-y-3">
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="h-24 rounded-2xl bg-white/[0.03] border border-white/5 animate-pulse" />
      ))}
    </div>
  );
}

export function Empty({ icon: Icon, title, hint }) {
  return (
    <div className="py-16 text-center flex flex-col items-center gap-3 bg-white/[0.02] border border-white/10 rounded-2xl">
      <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
        <Icon className="w-5 h-5 text-gray-600" />
      </div>
      <div>
        <h3 className="text-sm font-black tracking-tight">{title}</h3>
        <p className="text-[10px] text-gray-500 font-bold tracking-widest mt-1">{hint}</p>
      </div>
    </div>
  );
}

/**
 * A per-currency total, printed as the currencies it is actually in.
 *
 * <p>The server sends totals as `{PLN: 1200, EUR: 30}` and does not convert, because there
 * is no rate table behind the API worth reporting revenue against. So neither does this:
 * two currencies print as two figures. {@link plnEquivalent} exists for the one place a
 * single comparable number is genuinely needed, and says so where it is used.
 */
export function Money({ totals, className = '' }) {
  const entries = Object.entries(totals || {}).filter(([, v]) => Number(v) !== 0);
  if (entries.length === 0) return <span className={className}>—</span>;
  return (
    <span className={className}>
      {entries.map(([code, value], i) => (
        <span key={code}>
          {i > 0 && <span className="text-gray-600 mx-1">+</span>}
          {formatPrice(Number(value), code)}
        </span>
      ))}
    </span>
  );
}

export function Pill({ tone = 'neutral', children }) {
  return (
    <span className={`text-[9px] font-black tracking-widest px-2 py-1 rounded-md border ${TONE[tone]}`}>
      {children}
    </span>
  );
}

/**
 * The reply half of customer service.
 *
 * <p>Deliberately a link into the existing DM thread rather than a support inbox of its
 * own. The conversation then lives where every other conversation with that person lives,
 * and they receive it the normal way — a separate admin mailbox would be a second place to
 * check that nobody would check.
 */
export function MessageUser({ userId, name, label }) {
  if (!userId) return null;
  return (
    <Link
      to={`/dm/${userId}`}
      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:text-white hover:border-[#CDFF00]/40 text-[10px] font-black tracking-widest transition-colors"
    >
      <MessageCircleMore className="w-3.5 h-3.5" />
      {label || `Message ${name || 'user'}`}
    </Link>
  );
}
