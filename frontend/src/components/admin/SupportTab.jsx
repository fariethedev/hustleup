import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { LifeBuoy, Star, Banknote, CircleSlash, Loader, MessagesSquare, Snowflake } from 'lucide-react';
import { adminApi, claimsApi, feedbackApi, dispatchToast } from '../../api/client';
import { formatPrice, labelize } from '../../utils/constants';
import { timeAgo } from '../../utils/time';
import { Skeleton, Empty, Pill, MessageUser } from './shared';

/**
 * Customer service: the things people send in, and what was done about them.
 *
 * <p>Two queues, both of which already existed server-side and neither of which had
 * anywhere to be read:
 * <ul>
 *   <li><b>Disputes</b> — buyer protection claims. An open one is freezing a seller's
 *       payout for as long as it stays open, so this half has a clock on it.</li>
 *   <li><b>Feedback</b> — what sellers say about the platform when a sale completes.</li>
 * </ul>
 *
 * <p>Replying happens through the normal DM thread rather than a support inbox of its own,
 * so the conversation lands where every other conversation with that person is and reaches
 * them the way anything else would.
 */

export default function SupportTab() {
  const [section, setSection] = useState('claims');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'claims', label: 'Disputes' },
          { id: 'feedback', label: 'Feedback' },
        ].map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={`px-3.5 py-2 rounded-lg text-[10px] font-black tracking-widest border transition-all ${
              section === s.id
                ? 'bg-white/10 border-white/25 text-white'
                : 'bg-white/[0.02] border-white/10 text-gray-500 hover:text-white'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {section === 'claims' ? <ClaimsQueue /> : <FeedbackList />}
    </div>
  );
}

/* ── Disputes ──────────────────────────────────────────────────────────────── */

const CLAIM_FILTERS = [
  { id: 'OPEN', label: 'Open' },
  { id: 'REFUNDED', label: 'Refunded' },
  { id: 'REJECTED', label: 'Rejected' },
  { id: 'ALL', label: 'All' },
];

function ClaimsQueue() {
  const [status, setStatus] = useState('OPEN');
  const [rows, setRows] = useState([]);
  const [openCount, setOpenCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [notes, setNotes] = useState({});

  const load = useCallback(() => {
    setLoading(true);
    adminApi.claims(status)
      .then((r) => {
        setRows(r.data?.claims || []);
        setOpenCount(r.data?.openCount ?? 0);
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [status]);

  useEffect(() => load(), [load]);

  /**
   * Closes a claim.
   *
   * `refund: true` returns the buyer's money and cancels the order; `false` lifts the freeze
   * and lets the seller's payout continue. Either way the money stops being held — which is
   * why this asks for confirmation first: both directions move real funds and neither is
   * undoable from this screen.
   */
  const resolve = async (claim, refund) => {
    const who = refund ? claim.buyerName || 'the buyer' : claim.sellerName || 'the seller';
    const money = claim.amount != null ? formatPrice(Number(claim.amount), claim.currency || 'PLN') : 'the held funds';
    const verb = refund ? `Refund ${money} to ${who}` : `Release ${money} to ${who}`;
    if (!window.confirm(`${verb}?\n\nThis closes the claim and cannot be undone here.`)) return;

    setBusy(claim.id);
    try {
      await claimsApi.resolve(claim.id, refund, notes[claim.id] || '');
      dispatchToast(refund ? 'Refunded and claim closed' : 'Payout released and claim closed', 'success');
      setNotes((n) => { const copy = { ...n }; delete copy[claim.id]; return copy; });
      load();
    } catch (e) {
      dispatchToast(e.response?.data?.message || e.response?.data?.error || 'Could not resolve claim', 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {CLAIM_FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setStatus(f.id)}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black tracking-widest border transition-all ${
              status === f.id
                ? 'bg-white/10 border-white/25 text-white'
                : 'bg-white/[0.02] border-white/10 text-gray-500 hover:text-white'
            }`}
          >
            {f.label}
            {f.id === 'OPEN' && openCount > 0 && <span className="ml-1.5 text-amber-400">{openCount}</span>}
          </button>
        ))}
      </div>

      {loading ? <Skeleton rows={3} /> : rows.length === 0 ? (
        <Empty
          icon={LifeBuoy}
          title={status === 'OPEN' ? 'No open disputes' : 'Nothing here'}
          hint={status === 'OPEN' ? 'Claims freeze a payout until resolved' : 'Try another filter'}
        />
      ) : rows.map((c) => (
        <div key={c.id} className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3">

          <div className="flex flex-wrap items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <Pill tone={c.status === 'OPEN' ? 'open' : c.status === 'REFUNDED' ? 'bad' : 'neutral'}>
                  {c.status}
                </Pill>
                <Pill>{labelize(c.reason)}</Pill>
                <span className="text-[9px] font-black tracking-widest text-gray-600">
                  {c.orderType === 'BOOKING' ? 'BOOKING' : 'SHOP ORDER'}
                </span>
                {c.status === 'OPEN' && (
                  <span className="flex items-center gap-1 text-[9px] font-black tracking-widest text-amber-400">
                    <Snowflake className="w-3 h-3" /> PAYOUT FROZEN
                  </span>
                )}
              </div>
              <p className="text-sm font-black text-white truncate">{c.orderTitle || 'Order'}</p>
              <p className="text-[10px] text-gray-500">
                {c.createdAt ? `Raised ${timeAgo(c.createdAt)}` : 'Raised'}
              </p>
            </div>
            {c.amount != null && (
              <div className="text-right shrink-0">
                <p className="text-lg font-black text-[#CDFF00] leading-none">
                  {formatPrice(Number(c.amount), c.currency || 'PLN')}
                </p>
                <p className="text-[9px] font-bold tracking-widest text-gray-600 mt-1">IN DISPUTE</p>
              </div>
            )}
          </div>

          {c.detail && (
            <div className="pl-1 border-l-2 border-white/10">
              <p className="text-sm text-gray-200 leading-relaxed pl-3 whitespace-pre-wrap break-words">{c.detail}</p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] font-bold text-gray-500">
            <span>
              Buyer:{' '}
              {c.buyerId
                ? <Link to={`/profile/${c.buyerId}`} className="text-gray-300 hover:text-[#CDFF00]">{c.buyerName || 'Unknown'}</Link>
                : 'Unknown'}
            </span>
            <span>
              Seller:{' '}
              {c.sellerId
                ? <Link to={`/profile/${c.sellerId}`} className="text-gray-300 hover:text-[#CDFF00]">{c.sellerName || 'Unknown'}</Link>
                : 'Unknown'}
            </span>
          </div>

          {c.status !== 'OPEN' && c.resolutionNote && (
            <p className="text-[11px] text-gray-400 bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2">
              <b className="text-gray-300">Decision:</b> {c.resolutionNote}
            </p>
          )}

          {c.status === 'OPEN' && (
            <input
              value={notes[c.id] || ''}
              onChange={(e) => setNotes((n) => ({ ...n, [c.id]: e.target.value }))}
              placeholder="Resolution note (optional)…"
              className="w-full bg-white/5 border border-white/10 focus:border-[#CDFF00]/50 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-600 outline-none"
            />
          )}

          <div className="flex flex-wrap items-center gap-2">
            <MessageUser userId={c.buyerId} label="Message buyer" />
            <MessageUser userId={c.sellerId} label="Message seller" />
            {c.status === 'OPEN' && (
              <div className="ml-auto flex flex-wrap gap-2">
                <button
                  onClick={() => resolve(c, false)}
                  disabled={busy === c.id}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:border-white/30 text-[10px] font-black tracking-widest disabled:opacity-50 transition-colors"
                >
                  {busy === c.id ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <CircleSlash className="w-3.5 h-3.5" />}
                  REJECT &amp; RELEASE
                </button>
                <button
                  onClick={() => resolve(c, true)}
                  disabled={busy === c.id}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/15 border border-red-500/40 text-red-300 hover:bg-red-500/25 text-[10px] font-black tracking-widest disabled:opacity-50 transition-colors"
                >
                  {busy === c.id ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Banknote className="w-3.5 h-3.5" />}
                  REFUND BUYER
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Platform feedback ─────────────────────────────────────────────────────── */

function FeedbackList() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    feedbackApi.all()
      .then((r) => { if (!cancelled) setData(r.data); })
      .catch(() => { if (!cancelled) setData(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) return <Skeleton rows={3} />;
  if (!data || !data.items || data.items.length === 0) {
    return <Empty icon={MessagesSquare} title="No feedback yet" hint="Sellers are asked once a sale completes" />;
  }

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <Star className="w-5 h-5 text-[#CDFF00]" fill="#CDFF00" />
          <span className="text-2xl font-black text-white leading-none">{data.average}</span>
        </div>
        <div>
          <p className="text-[9px] font-black tracking-widest text-gray-500">AVERAGE RATING</p>
          <p className="text-[10px] text-gray-500 font-bold mt-0.5">from {data.count} response{data.count === 1 ? '' : 's'}</p>
        </div>
      </div>

      {data.items.map((f) => (
        <div key={f.id} className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-2.5">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  className={`w-3.5 h-3.5 ${n <= f.rating ? 'text-[#CDFF00]' : 'text-gray-700'}`}
                  fill={n <= f.rating ? '#CDFF00' : 'none'}
                />
              ))}
            </div>
            {f.authorRole && <Pill>{labelize(f.authorRole)}</Pill>}
            <span className="text-[10px] text-gray-500 font-bold ml-auto">
              {f.createdAt ? timeAgo(f.createdAt) : ''}
            </span>
          </div>

          {f.improvement && (
            <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap break-words">{f.improvement}</p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-0">
              {f.userId ? (
                <Link to={`/profile/${f.userId}`} className="text-xs font-bold text-gray-300 hover:text-[#CDFF00] transition-colors">
                  {f.userName || 'Unknown'}
                </Link>
              ) : (
                <span className="text-xs font-bold text-gray-400">{f.userName || 'Unknown'}</span>
              )}
              {f.userEmail && <span className="text-[10px] text-gray-600 ml-2">{f.userEmail}</span>}
            </div>
            <div className="ml-auto">
              <MessageUser userId={f.userId} label="Reply" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
