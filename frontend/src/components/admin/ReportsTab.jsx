import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ShieldBan, CircleCheck, CircleSlash, Undo, TriangleAlert, Loader } from 'lucide-react';
import { adminApi, dispatchToast } from '../../api/client';
import { uploadUrl } from '../../config';
import { timeAgo } from '../../utils/time';
import { Skeleton, Empty, Pill, MessageUser } from './shared';

/**
 * The safety report queue.
 *
 * <p>These rows have been accumulating since reporting was added and nobody has ever seen
 * one: {@code user_reports} was written by the report button and read by nothing, so every
 * report ever filed went into a table with no reader. The backlog is intact, which means
 * this tab opens onto real complaints that have been waiting, not an empty queue.
 *
 * <p>Resolving a report deliberately does nothing to the reported account. Suspending,
 * verifying and role changes live on the Users tab, and a moderator recording "I looked at
 * this" should not silently carry a punishment — they are separate judgements and stay
 * separate actions.
 */

const FILTERS = [
  { id: 'OPEN', label: 'Open' },
  { id: 'ACTIONED', label: 'Actioned' },
  { id: 'DISMISSED', label: 'Dismissed' },
  { id: 'ALL', label: 'All' },
];

export default function ReportsTab() {
  const [status, setStatus] = useState('OPEN');
  const [rows, setRows] = useState([]);
  const [openCount, setOpenCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  // Per-row moderator note, keyed by report id. Kept out of the row objects so a reload
  // does not wipe a note somebody is halfway through typing.
  const [notes, setNotes] = useState({});

  const load = useCallback(() => {
    setLoading(true);
    adminApi.reports(status)
      .then((r) => {
        setRows(r.data?.reports || []);
        setOpenCount(r.data?.openCount ?? 0);
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [status]);

  useEffect(() => load(), [load]);

  const resolve = async (id, next) => {
    setBusy(id);
    try {
      await adminApi.resolveReport(id, next, notes[id] || '');
      dispatchToast(next === 'OPEN' ? 'Report reopened' : `Report ${next.toLowerCase()}`, 'success');
      setNotes((n) => { const copy = { ...n }; delete copy[id]; return copy; });
      load();
    } catch (e) {
      dispatchToast(e.response?.data?.error || 'Could not update report', 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setStatus(f.id)}
            className={`px-3.5 py-2 rounded-lg text-[10px] font-black tracking-widest border transition-all ${
              status === f.id
                ? 'bg-white/10 border-white/25 text-white'
                : 'bg-white/[0.02] border-white/10 text-gray-500 hover:text-white'
            }`}
          >
            {f.label}
            {f.id === 'OPEN' && openCount > 0 && (
              <span className="ml-1.5 text-amber-400">{openCount}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? <Skeleton rows={3} /> : rows.length === 0 ? (
        <Empty
          icon={ShieldBan}
          title={status === 'OPEN' ? 'Nothing waiting' : 'No reports here'}
          hint={status === 'OPEN' ? 'Open reports appear here' : 'Try another filter'}
        />
      ) : rows.map((r) => (
        <div key={r.id} className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3">

          {/* Who did what to whom — the only question this queue is ever asked. */}
          <div className="flex flex-wrap items-center gap-3">
            <Person id={r.reportedId} name={r.reportedName} email={r.reportedEmail}
                    avatarUrl={r.reportedAvatarUrl} caption="Reported" />
            <div className="flex items-center gap-2 ml-auto">
              {r.reportsAgainstReported > 1 && (
                <span className="flex items-center gap-1 text-[9px] font-black tracking-widest px-2 py-1 rounded-md border text-amber-400 bg-amber-400/10 border-amber-400/25">
                  <TriangleAlert className="w-3 h-3" />
                  {r.reportsAgainstReported} REPORTS
                </span>
              )}
              <Pill tone={r.status === 'OPEN' ? 'open' : r.status === 'ACTIONED' ? 'bad' : 'neutral'}>
                {r.status}
              </Pill>
            </div>
          </div>

          <div className="pl-1 border-l-2 border-white/10">
            <p className="text-sm text-gray-200 leading-relaxed pl-3 whitespace-pre-wrap break-words">
              {r.reason?.trim() || <span className="text-gray-600 italic">No reason given</span>}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[10px] text-gray-500 font-bold">
            <span>Filed by</span>
            {r.reporterId ? (
              <Link to={`/profile/${r.reporterId}`} className="text-gray-300 hover:text-[#CDFF00] transition-colors">
                {r.reporterName || 'Unknown'}
              </Link>
            ) : <span className="text-gray-400">Unknown</span>}
            <span>·</span>
            <span>{r.createdAt ? timeAgo(r.createdAt) : 'unknown date'}</span>
          </div>

          {/* A closed report keeps the reasoning visible — the next person to read this
              account's history needs to know what was decided and why. */}
          {r.status !== 'OPEN' && r.moderatorNote && (
            <p className="text-[11px] text-gray-400 bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2">
              <b className="text-gray-300">Decision:</b> {r.moderatorNote}
            </p>
          )}

          {r.status === 'OPEN' && (
            <input
              value={notes[r.id] || ''}
              onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
              placeholder="Note for the record (optional)…"
              className="w-full bg-white/5 border border-white/10 focus:border-[#CDFF00]/50 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-600 outline-none"
            />
          )}

          <div className="flex flex-wrap items-center gap-2">
            <MessageUser userId={r.reporterId} label="Message reporter" />
            <MessageUser userId={r.reportedId} label="Message reported" />
            <div className="ml-auto flex flex-wrap gap-2">
              {r.status === 'OPEN' ? (
                <>
                  <button
                    onClick={() => resolve(r.id, 'DISMISSED')}
                    disabled={busy === r.id}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:border-white/30 text-[10px] font-black tracking-widest disabled:opacity-50 transition-colors"
                  >
                    {busy === r.id ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <CircleSlash className="w-3.5 h-3.5" />}
                    DISMISS
                  </button>
                  <button
                    onClick={() => resolve(r.id, 'ACTIONED')}
                    disabled={busy === r.id}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#CDFF00] text-black text-[10px] font-black tracking-widest disabled:opacity-50 hover:bg-[#d9ff33] transition-colors"
                  >
                    {busy === r.id ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <CircleCheck className="w-3.5 h-3.5" />}
                    ACTIONED
                  </button>
                </>
              ) : (
                <button
                  onClick={() => resolve(r.id, 'OPEN')}
                  disabled={busy === r.id}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white text-[10px] font-black tracking-widest disabled:opacity-50 transition-colors"
                >
                  <Undo className="w-3.5 h-3.5" /> REOPEN
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Person({ id, name, email, avatarUrl, caption }) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <div className="w-9 h-9 rounded-full bg-black border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
        {avatarUrl
          ? <img src={uploadUrl(avatarUrl)} alt="" className="w-full h-full object-cover" />
          : <span className="text-[#CDFF00] font-black text-xs">{(name || 'U')[0]}</span>}
      </div>
      <div className="min-w-0">
        <p className="text-[9px] font-black tracking-widest text-gray-600">{caption}</p>
        {id ? (
          <Link to={`/profile/${id}`} className="text-sm font-black text-white truncate hover:text-[#CDFF00] transition-colors block">
            {name || 'Deleted account'}
          </Link>
        ) : (
          <p className="text-sm font-black text-gray-500 truncate">Deleted account</p>
        )}
        {email && <p className="text-[10px] text-gray-500 truncate">{email}</p>}
      </div>
    </div>
  );
}
