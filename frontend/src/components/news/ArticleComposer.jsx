import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { X, Loader2, AlertCircle, Image as ImageIcon, Send, FileText, Trash2 } from 'lucide-react';
import { newsApi } from '../../api/client';
import { lockBodyScroll } from '../../utils/lockBodyScroll';

const MAX_MEDIA = 6;

/**
 * Write and publish a news article.
 *
 * <p>Only rendered when the server reports {@code canPostNews}; the real gate is
 * {@code PublisherGuard} on the POST, so forcing this open still cannot publish.
 * Saving as a draft keeps the article private to the outlet until they publish it.
 */
export default function ArticleComposer({ sections = [], onClose, onPublished }) {
  const [form, setForm] = useState({ title: '', summary: '', body: '', category: '', tags: '' });
  const [cover, setCover] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);
  const [media, setMedia] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const coverRef = useRef(null);
  const mediaRef = useRef(null);

  useEffect(() => {
    const unlock = lockBodyScroll();
    return () => unlock();
  }, []);

  useEffect(() => () => {
    if (coverPreview) URL.revokeObjectURL(coverPreview);
  }, [coverPreview]);
  useEffect(() => () => previews.forEach((p) => URL.revokeObjectURL(p.url)), [previews]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const pickCover = (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!f.type.startsWith('image/')) { setError('The cover must be an image'); return; }
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCover(f);
    setCoverPreview(URL.createObjectURL(f));
    setError(null);
  };

  const addMedia = (e) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = '';
    const room = MAX_MEDIA - media.length;
    if (room <= 0) { setError(`Up to ${MAX_MEDIA} extra files`); return; }
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

  const submit = async (status) => {
    if (!form.title.trim() || !form.body.trim()) {
      setError('Headline and body are required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await newsApi.create({ ...form, status, coverImage: cover, media });
      onPublished?.(res.data);
    } catch (err) {
      const data = err.response?.data;
      setError(data?.error || data?.message
        || (err.response?.status ? `Could not publish (server said ${err.response.status})` : 'Could not reach the server'));
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
        className="w-full sm:max-w-2xl bg-[#0a0a0a] border border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[88vh]"
      >
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between shrink-0">
          <h2 className="text-base font-black text-white uppercase tracking-tight">Write an article</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
          {/* Cover */}
          <div>
            <label className={label}>Cover image</label>
            <button
              onClick={() => coverRef.current?.click()}
              className="relative w-full h-40 rounded-xl overflow-hidden border-2 border-dashed border-white/15 hover:border-[#CDFF00]/50 flex items-center justify-center transition-colors group"
            >
              {coverPreview ? (
                <>
                  <img src={coverPreview} alt="" className="w-full h-full object-cover" />
                  <span className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] font-black uppercase tracking-widest text-[#CDFF00] transition-opacity">
                    Change cover
                  </span>
                </>
              ) : (
                <span className="flex flex-col items-center gap-1.5 text-gray-500 group-hover:text-[#CDFF00] transition-colors">
                  <ImageIcon className="w-5 h-5" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Add a cover</span>
                </span>
              )}
            </button>
            <input ref={coverRef} type="file" accept="image/*" hidden onChange={pickCover} />
          </div>

          <div>
            <label className={label}>Headline *</label>
            <input className={field} value={form.title} onChange={(e) => set('title', e.target.value)}
                   placeholder="New licensing rules land next month" />
          </div>

          <div>
            <label className={label}>Standfirst</label>
            <textarea className={`${field} min-h-[70px] resize-none`} value={form.summary}
                      onChange={(e) => set('summary', e.target.value)}
                      placeholder="One paragraph summarising the story — shown on the card." />
          </div>

          <div>
            <label className={label}>Article *</label>
            <textarea className={`${field} min-h-[220px] resize-y`} value={form.body}
                      onChange={(e) => set('body', e.target.value)}
                      placeholder="Write the full story…" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Section</label>
              <select className={field} value={form.category} onChange={(e) => set('category', e.target.value)}>
                <option value="">Choose…</option>
                {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>Tags (comma separated)</label>
              <input className={field} value={form.tags} onChange={(e) => set('tags', e.target.value)}
                     placeholder="poland, freelance" />
            </div>
          </div>

          <div>
            <label className={label}>In-article media ({media.length}/{MAX_MEDIA})</label>
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
                <button onClick={() => mediaRef.current?.click()}
                        className="w-24 h-20 rounded-xl border-2 border-dashed border-white/15 hover:border-[#CDFF00]/50 flex flex-col items-center justify-center gap-1 text-gray-500 hover:text-[#CDFF00] transition-colors">
                  <ImageIcon className="w-4 h-4" />
                  <span className="text-[9px] font-bold uppercase tracking-widest">Add</span>
                </button>
              )}
            </div>
            <input ref={mediaRef} type="file" accept="image/*,video/*" multiple hidden onChange={addMedia} />
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2 text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="text-xs font-medium">{error}</span>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-white/10 shrink-0 flex gap-2">
          <button onClick={() => submit('DRAFT')} disabled={submitting}
                  className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-300 font-black text-[11px] uppercase tracking-widest hover:bg-white/10 transition-all disabled:opacity-50 flex items-center gap-2">
            <FileText className="w-4 h-4" /> Draft
          </button>
          <button onClick={() => submit('PUBLISHED')} disabled={submitting}
                  className="flex-1 py-3 rounded-xl bg-[#CDFF00] text-black font-black text-[11px] uppercase tracking-widest hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            {submitting
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Publishing…</>
              : <><Send className="w-4 h-4" /> Publish</>}
          </button>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
}
