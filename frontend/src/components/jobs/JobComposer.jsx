import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { X, Plus, Loader2, AlertCircle, Image as ImageIcon, Trash2 } from 'lucide-react';
import { jobsApi } from '../../api/client';
import { lockBodyScroll } from '../../utils/lockBodyScroll';

const JOB_TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'TEMPORARY', 'INTERNSHIP', 'GIG'];
const PERIODS = ['HOUR', 'DAY', 'MONTH', 'YEAR', 'PROJECT'];
const MAX_MEDIA = 6;

/**
 * Compose a job advert.
 *
 * <p>Only rendered when the server has said {@code canPostJobs}. That is a UX affordance,
 * not the security boundary — {@code PublisherGuard} rejects the POST regardless, so a
 * user who forces this open still cannot publish.
 */
export default function JobComposer({ categories = [], onClose, onPosted }) {
  const [form, setForm] = useState({
    title: '', description: '', category: '', location: '', remote: false,
    jobType: 'FULL_TIME', salaryMin: '', salaryMax: '', salaryCurrency: 'PLN',
    salaryPeriod: 'MONTH', tags: '', expiresInDays: '',
  });
  const [media, setMedia] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    const unlock = lockBodyScroll();
    return () => unlock();
  }, []);

  // Object URLs are leaked memory until revoked; tie their lifetime to the previews array.
  useEffect(() => () => previews.forEach((p) => URL.revokeObjectURL(p.url)), [previews]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const addFiles = (e) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = '';
    const room = MAX_MEDIA - media.length;
    if (room <= 0) { setError(`Up to ${MAX_MEDIA} files`); return; }
    const accepted = picked
      .filter((f) => f.type.startsWith('image/') || f.type.startsWith('video/'))
      .slice(0, room);
    if (!accepted.length) { setError('Only images and video can be attached'); return; }
    setMedia((m) => [...m, ...accepted]);
    setPreviews((p) => [...p, ...accepted.map((f) => ({
      url: URL.createObjectURL(f), video: f.type.startsWith('video/'),
    }))]);
    setError(null);
  };

  const removeAt = (i) => {
    URL.revokeObjectURL(previews[i].url);
    setMedia((m) => m.filter((_, x) => x !== i));
    setPreviews((p) => p.filter((_, x) => x !== i));
  };

  const submit = async () => {
    if (!form.title.trim() || !form.description.trim()) {
      setError('Title and description are required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await jobsApi.create({ ...form, media });
      onPosted?.(res.data);
    } catch (err) {
      // The server sends {error}; fall back to the status so a failure is never silent.
      const data = err.response?.data;
      setError(data?.error || data?.message
        || (err.response?.status ? `Could not post (server said ${err.response.status})` : 'Could not reach the server'));
    } finally {
      setSubmitting(false);
    }
  };

  const field = 'w-full bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-[#CDFF00]/60 transition-colors';
  const label = 'text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1.5 block';

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[900] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="w-full sm:max-w-xl bg-[#0a0a0a] border border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[85vh]"
      >
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between shrink-0">
          <h2 className="text-base font-black text-white uppercase tracking-tight">Post a job</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
          <div>
            <label className={label}>Role title *</label>
            <input className={field} value={form.title} onChange={(e) => set('title', e.target.value)}
                   placeholder="Senior Assembly Specialist" />
          </div>

          <div>
            <label className={label}>Description *</label>
            <textarea className={`${field} min-h-[110px] resize-none`} value={form.description}
                      onChange={(e) => set('description', e.target.value)}
                      placeholder="What the role involves, who it suits, what the shift looks like…" />
          </div>

          {/* Media — the feature that makes a card worth looking at. */}
          <div>
            <label className={label}>Photos / clips ({media.length}/{MAX_MEDIA})</label>
            <div className="flex flex-wrap gap-2">
              {previews.map((p, i) => (
                <div key={p.url} className="relative w-24 h-20 rounded-xl overflow-hidden border border-white/10 group">
                  {p.video
                    ? <video src={p.url} className="w-full h-full object-cover" muted playsInline />
                    : <img src={p.url} alt="" className="w-full h-full object-cover" />}
                  <button onClick={() => removeAt(i)}
                          className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              ))}
              {media.length < MAX_MEDIA && (
                <button onClick={() => fileRef.current?.click()}
                        className="w-24 h-20 rounded-xl border-2 border-dashed border-white/15 hover:border-[#CDFF00]/50 flex flex-col items-center justify-center gap-1 text-gray-500 hover:text-[#CDFF00] transition-colors">
                  <ImageIcon className="w-4 h-4" />
                  <span className="text-[9px] font-bold uppercase tracking-widest">Add</span>
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*,video/*" multiple hidden onChange={addFiles} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Category</label>
              <select className={field} value={form.category} onChange={(e) => set('category', e.target.value)}>
                <option value="">Choose…</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>Type</label>
              <select className={field} value={form.jobType} onChange={(e) => set('jobType', e.target.value)}>
                {JOB_TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Location</label>
              <input className={field} value={form.location} onChange={(e) => set('location', e.target.value)}
                     placeholder="Warsaw, Industrial Zone A" />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input type="checkbox" checked={form.remote}
                       onChange={(e) => set('remote', e.target.checked)}
                       className="w-4 h-4 accent-[#CDFF00]" />
                <span className="text-xs font-bold text-gray-300">Fully remote</span>
              </label>
            </div>
          </div>

          <div>
            <label className={label}>Pay range</label>
            <div className="grid grid-cols-4 gap-2">
              <input className={field} type="number" min="0" placeholder="Min" value={form.salaryMin}
                     onChange={(e) => set('salaryMin', e.target.value)} />
              <input className={field} type="number" min="0" placeholder="Max" value={form.salaryMax}
                     onChange={(e) => set('salaryMax', e.target.value)} />
              <input className={field} placeholder="PLN" value={form.salaryCurrency}
                     onChange={(e) => set('salaryCurrency', e.target.value.toUpperCase())} />
              <select className={field} value={form.salaryPeriod} onChange={(e) => set('salaryPeriod', e.target.value)}>
                {PERIODS.map((p) => <option key={p} value={p}>{p.toLowerCase()}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Highlights (comma separated)</label>
              <input className={field} value={form.tags} onChange={(e) => set('tags', e.target.value)}
                     placeholder="Night shift, Sign-on bonus" />
            </div>
            <div>
              <label className={label}>Expires in (days)</label>
              <input className={field} type="number" min="1" placeholder="Never" value={form.expiresInDays}
                     onChange={(e) => set('expiresInDays', e.target.value)} />
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2 text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="text-xs font-medium">{error}</span>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-white/10 shrink-0">
          <button onClick={submit} disabled={submitting}
                  className="w-full py-3 rounded-xl bg-[#CDFF00] text-black font-black text-[11px] uppercase tracking-widest hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            {submitting
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Posting…</>
              : <><Plus className="w-4 h-4" /> Publish advert</>}
          </button>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
}
