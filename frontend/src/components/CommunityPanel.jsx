import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UsersRound, Plus, Check, MapPin, X, Loader2, ImagePlus } from 'lucide-react';
import { communitiesApi, dispatchToast } from '../api/client';
import SmartImage from './SmartImage';

/**
 * Browse, create and join communities — the header of the Communities feed.
 *
 * A community is a group with a subject and a membership ("Cars in Lublin"), not a
 * hashtag: joining is what puts its posts in your feed, and the server refuses posts into
 * one you haven't joined. This panel is the only place that membership is changed, which
 * is why it owns the join/leave calls and tells the feed to reload afterwards rather than
 * mutating its list itself.
 *
 * Membership state comes from the browse call itself (each row carries
 * `joinedByCurrentUser`), so this does not take the parent's list as a prop — two sources
 * for the same fact is how a Join button ends up disagreeing with the feed beside it.
 *
 * @param {Function} onChanged  called after any join/leave/create, so the feed refetches
 */
export default function CommunityPanel({ onChanged }) {
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [expanded, setExpanded] = useState(false);

  const load = () => {
    setLoading(true);
    communitiesApi.browse()
      .then((r) => setAll(r.data || []))
      .catch(() => setAll([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const toggleMembership = async (community) => {
    setBusyId(community.id);
    try {
      const res = community.joinedByCurrentUser
        ? await communitiesApi.leave(community.id)
        : await communitiesApi.join(community.id);
      // Swap in the server's version rather than flipping the flag locally: it carries the
      // recomputed member count, which is the number on the card.
      setAll((prev) => prev.map((c) => (c.id === community.id ? res.data : c)));
      onChanged?.();
    } catch (err) {
      dispatchToast(err.response?.data?.error || 'Could not update that membership', 'error');
    } finally {
      setBusyId(null);
    }
  };

  // Yours first — the ones whose posts you actually see — then everything else by size.
  const sorted = [...all].sort((a, b) => {
    if (a.joinedByCurrentUser !== b.joinedByCurrentUser) return a.joinedByCurrentUser ? -1 : 1;
    return b.memberCount - a.memberCount;
  });
  const visible = expanded ? sorted : sorted.slice(0, 4);

  return (
    <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="flex items-center gap-2 text-[11px] font-black tracking-[0.2em] text-gray-400">
          <UsersRound className="w-3.5 h-3.5" /> Communities
        </h3>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#CDFF00] text-black text-[10px] font-black tracking-widest hover:bg-[#E0FF4D] transition-colors"
        >
          <Plus className="w-3 h-3" /> New
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-[68px] rounded-xl bg-white/[0.03] animate-pulse" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <p className="text-sm text-gray-500 py-3">
          No communities yet. Start the first one — give it a subject and a city, and people can join.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {visible.map((community) => (
              <div
                key={community.id}
                className="flex items-center gap-3 p-2.5 rounded-xl border border-white/10 bg-black/40"
              >
                <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0 bg-white/5">
                  <SmartImage
                    src={community.imageUrl}
                    alt=""
                    fallbackIcon={UsersRound}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-white truncate">{community.name}</p>
                  <p className="flex items-center gap-2 text-[10px] font-bold tracking-widest text-gray-500 truncate">
                    {community.city && (
                      <span className="flex items-center gap-0.5 truncate">
                        <MapPin className="w-3 h-3 shrink-0" /> {community.city}
                      </span>
                    )}
                    <span className="shrink-0">
                      {community.memberCount === 1 ? '1 member' : `${community.memberCount} members`}
                    </span>
                  </p>
                </div>
                {/* The creator has no Leave: a community whose owner walked out has nobody
                    answerable for it, so the server refuses that and the button says why. */}
                {community.ownedByCurrentUser ? (
                  <span className="px-2.5 py-1.5 rounded-lg text-[9px] font-black tracking-widest text-[#CDFF00] shrink-0">
                    Yours
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => toggleMembership(community)}
                    disabled={busyId === community.id}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black tracking-widest transition-colors shrink-0 flex items-center gap-1 disabled:opacity-50 ${
                      community.joinedByCurrentUser
                        ? 'bg-white/5 border border-white/10 text-gray-300 hover:text-white'
                        : 'bg-[#CDFF00] text-black hover:bg-[#E0FF4D]'
                    }`}
                  >
                    {busyId === community.id
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : community.joinedByCurrentUser && <Check className="w-3 h-3" />}
                    {community.joinedByCurrentUser ? 'Joined' : 'Join'}
                  </button>
                )}
              </div>
            ))}
          </div>

          {sorted.length > 4 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="w-full mt-2 py-2 text-[10px] font-black tracking-widest text-gray-500 hover:text-white transition-colors"
            >
              {expanded ? 'Show fewer' : `Show all ${sorted.length}`}
            </button>
          )}
        </>
      )}

      <AnimatePresence>
        {creating && (
          <CreateCommunityModal
            onClose={() => setCreating(false)}
            onCreated={(community) => {
              setCreating(false);
              setAll((prev) => [community, ...prev]);
              onChanged?.();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Create a community ── */
function CreateCommunityModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', description: '', city: '', category: '' });
  const [image, setImage] = useState(null);
  const [saving, setSaving] = useState(false);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e) => {
    e.preventDefault();
    if (form.name.trim().length < 3) {
      dispatchToast('Give it a name of at least 3 characters', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await communitiesApi.create({ ...form, image });
      dispatchToast(`${res.data.name} created — you're its first member`, 'success');
      onCreated(res.data);
    } catch (err) {
      dispatchToast(err.response?.data?.error || 'Could not create that community', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center px-4">
      <div onClick={onClose} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-md bg-[#0A0A0A] border border-white/10 rounded-3xl p-5 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-black text-white tracking-tight">New community</h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-gray-500 hover:bg-white/10">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <Field
            label="Name"
            value={form.name}
            onChange={(v) => set('name', v)}
            placeholder="e.g. Cars in Lublin"
          />
          <div>
            <label className="block text-[10px] font-black tracking-widest text-gray-500 mb-1.5">
              What belongs here
            </label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="The rule people are joining up to — say what's on topic and what isn't."
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-[#CDFF00] resize-none placeholder-gray-600"
            />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="City" value={form.city} onChange={(v) => set('city', v)} placeholder="Lublin" />
            <Field label="Topic" value={form.category} onChange={(v) => set('category', v)} placeholder="Cars" />
          </div>

          <div>
            <label className="block text-[10px] font-black tracking-widest text-gray-500 mb-1.5">
              Banner
            </label>
            <div className="flex items-center gap-2.5">
              <div className="w-14 h-14 rounded-xl overflow-hidden bg-black border border-white/10 shrink-0">
                <SmartImage
                  src={image ? URL.createObjectURL(image) : null}
                  alt=""
                  fallbackIcon={UsersRound}
                  className="w-full h-full object-cover"
                />
              </div>
              <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-bold hover:border-white/30 transition-colors cursor-pointer">
                <ImagePlus className="w-4 h-4" />
                {image ? 'Change' : 'Upload'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setImage(e.target.files?.[0] || null)}
                />
              </label>
            </div>
          </div>
        </div>

        <div className="flex gap-2.5 mt-5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-white/10 text-white font-black tracking-widest text-[10px] hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 py-3 rounded-xl bg-[#CDFF00] text-black font-black tracking-widest text-[10px] hover:bg-[#E0FF4D] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {saving ? 'Creating' : 'Create'}
          </button>
        </div>
      </motion.form>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label className="block text-[10px] font-black tracking-widest text-gray-500 mb-1.5">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-[#CDFF00] placeholder-gray-600"
      />
    </div>
  );
}
