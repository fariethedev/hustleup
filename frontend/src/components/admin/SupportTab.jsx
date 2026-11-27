import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { LifeBuoy, Star, Banknote, CircleSlash, Loader, MessagesSquare, Snowflake } from 'lucide-react';
import { feedbackApi } from '../../api/client';
import { labelize } from '../../utils/constants';
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
  const [section, setSection] = useState('feedback');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {[
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

      {section === 'feedback' && <FeedbackList />}
      <p className="text-xs text-gray-500">Buyer disputes, appeals and chargebacks are handled in the Trust &amp; Safety tab.</p>
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
