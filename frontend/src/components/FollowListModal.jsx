import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CircleX, UserRound, ShieldCheck, Navigation } from 'lucide-react';
import { followsApi, dispatchToast } from '../api/client';
import { lockBodyScroll } from '../utils/lockBodyScroll';
import { uploadUrl } from '../config';

/**
 * Who follows you, and who you follow.
 *
 * <h3>Why it is only ever your own</h3>
 * The endpoints behind this are {@code GET /follows/followers} and {@code /following}, both
 * of which answer for the signed-in user and take no id. They have existed since follows
 * were added and nothing has ever called them — the profile header could tell you that
 * eleven people follow you and offered no way to find out who. So this is the missing read
 * side, not a new capability.
 *
 * <p>It follows that another person's follower list cannot be shown here, because the API
 * cannot answer that question. The counts on somebody else's profile stay as plain text
 * rather than becoming buttons that would have to fail.
 *
 * @param {'followers'|'following'} mode
 * @param {Function} onClose
 * @param {Function} [onCountChange] called with the signed delta when a follow is toggled,
 *        so the profile behind the modal can keep its "following" chip honest without refetching
 */
export default function FollowListModal({ mode, onClose, onCountChange }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  // Ids with a follow/unfollow in flight, so a double tap cannot fire two writes.
  const [busy, setBusy] = useState(() => new Set());

  useEffect(() => lockBodyScroll(), []);

  useEffect(() => {
    let cancelled = false;
    const load = mode === 'followers' ? followsApi.followers : followsApi.following;
    load()
      .then((r) => { if (!cancelled) { setRows(r.data || []); setFailed(false); } })
      .catch(() => { if (!cancelled) { setRows([]); setFailed(true); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [mode]);

  /**
   * Follow or unfollow somebody from the list.
   *
   * <p>Optimistic, and the row stays put either way. Dropping an unfollowed person out of
   * the "following" list mid-tap would move everything under the finger and make an
   * accidental unfollow impossible to undo without closing and reopening.
   */
  const toggle = async (person) => {
    if (busy.has(person.id)) return;
    const wasFollowing = !!person.isFollowing;
    setBusy((b) => new Set(b).add(person.id));
    setRows((list) => list.map((p) => (p.id === person.id ? { ...p, isFollowing: !wasFollowing } : p)));
    onCountChange?.(wasFollowing ? -1 : 1);
    try {
      if (wasFollowing) await followsApi.unfollow(person.id);
      else await followsApi.follow(person.id);
    } catch {
      setRows((list) => list.map((p) => (p.id === person.id ? { ...p, isFollowing: wasFollowing } : p)));
      onCountChange?.(wasFollowing ? 1 : -1);
      dispatchToast('Could not update that — try again', 'error');
    } finally {
      setBusy((b) => { const next = new Set(b); next.delete(person.id); return next; });
    }
  };

  const title = mode === 'followers' ? 'Followers' : 'Following';

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 24 }}
        className="relative w-full max-w-sm bg-[#0A0A0A] border border-white/10 rounded-3xl shadow-2xl flex flex-col max-h-[70vh] overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between shrink-0">
          <h3 className="text-white font-bold text-sm flex items-center gap-2">
            <UserRound className="w-4 h-4 text-[#CDFF00]" />
            {title}{!loading && !failed ? ` · ${rows.length}` : ''}
          </h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-full hover:bg-white/10 text-gray-500 hover:text-white transition-colors"
          >
            <CircleX className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {loading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 animate-pulse">
                  <div className="w-10 h-10 rounded-full bg-white/5" />
                  <div className="h-3 w-32 bg-white/5 rounded" />
                </div>
              ))}
            </div>
          ) : failed ? (
            /* Says it could not be read rather than that it is empty — "nobody follows you"
               is a much worse thing to show someone incorrectly. */
            <p className="py-12 px-6 text-center text-sm text-gray-400">
              Could not load this list. Close and try again.
            </p>
          ) : rows.length === 0 ? (
            <p className="py-12 px-6 text-center text-sm text-gray-500">
              {mode === 'followers' ? 'Nobody follows you yet.' : 'You are not following anyone yet.'}
            </p>
          ) : (
            rows.map((u) => (
              <div key={u.id} className="flex items-center gap-3 px-5 py-2.5 hover:bg-white/5 transition-colors">
                <Link to={`/profile/${u.id}`} onClick={onClose} className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-full bg-black border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
                    {u.avatarUrl
                      ? <img src={uploadUrl(u.avatarUrl)} alt="" className="w-full h-full object-cover" />
                      : <span className="text-[#CDFF00] font-black text-sm">{(u.fullName || 'U')[0]}</span>}
                  </div>
                  <div className="min-w-0">
                    <span className="text-sm font-bold text-white flex items-center gap-1.5 min-w-0">
                      <span className="truncate">{u.fullName || u.username}</span>
                      {u.role === 'ADMIN' && <ShieldCheck className="w-3.5 h-3.5 text-[#CDFF00] shrink-0" />}
                    </span>
                    <span className="flex items-center gap-1.5 text-[11px] text-gray-500 truncate">
                      {u.username && <span className="truncate">@{u.username}</span>}
                      {u.city && (
                        <>
                          <Navigation className="w-2.5 h-2.5 shrink-0" />
                          <span className="truncate">{u.city}</span>
                        </>
                      )}
                    </span>
                  </div>
                </Link>

                {/* The whole reason the followers list is worth opening: it is where you find
                    out who you have not followed back. */}
                <button
                  onClick={() => toggle(u)}
                  disabled={busy.has(u.id)}
                  className={`shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-black tracking-widest transition-colors disabled:opacity-50 ${
                    u.isFollowing
                      ? 'bg-white/5 border border-white/10 text-gray-400 hover:text-white'
                      : 'bg-[#CDFF00] text-black hover:bg-[#d9ff33]'
                  }`}
                >
                  {/* "Follow back" only means anything about somebody who follows you. In the
                      following list the same state is just "follow", usually after an
                      accidental unfollow a moment earlier. */}
                  {u.isFollowing ? 'FOLLOWING' : mode === 'followers' ? 'FOLLOW BACK' : 'FOLLOW'}
                </button>
              </div>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
}
