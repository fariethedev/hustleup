import { useEffect, useRef, useState } from 'react';
import { Plus, X, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { shopsApi } from '../api/client';
import { invalidateShops } from '../hooks/useShops';
import HighlightVideo from './HighlightVideo';
import { uploadUrl } from '../config';

export default function ShopHighlights({ shop, isOwner }) {
  const [collections, setCollections] = useState(shop.highlights || []);
  const [active, setActive] = useState(null);
  const [slide, setSlide] = useState(0);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [items, setItems] = useState([]);
  const [editId, setEditId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [paused, setPaused] = useState(false);
  const dialog = useRef(null);
  const open = editing || active !== null;
  useEffect(() => {
    if (!open) return;
    const el = dialog.current;
    el.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { el.close(); document.body.style.overflow = previous; };
  }, [open]);
  const close = () => { if (!busy) { setActive(null); setEditing(false); setError(''); } };
  const edit = (collection) => {
    setEditId(collection?.id || null); setTitle(collection?.title || '');
    setItems(collection?.items || []); setEditing(true); setActive(null); setError('');
  };
  const save = async (next) => {
    setBusy(true); setError('');
    try {
      const { data } = await shopsApi.update(shop.id, { highlights: next });
      setCollections(data.highlights || next); invalidateShops(); setActive(null); setEditing(false);
    } catch (e) { setError(e.response?.data?.message || 'Could not save highlights. Please retry.'); }
    finally { setBusy(false); }
  };
  const upload = async (files) => {
    if (!files.length) return;
    if (files.length + items.length > 20) { setError('Use at most 20 photos or videos per collection.'); return; }
    if (files.some(f => !/^(image|video)\//.test(f.type) || f.size > 20 * 1024 * 1024)) {
      setError('Choose photos or videos up to 20 MB each.'); return;
    }
    setBusy(true); setError('');
    try {
      for (const file of files) {
        const { data } = await shopsApi.uploadMedia(shop.id, file);
        setItems(previous => [...previous, { url: data.url, type: file.type.startsWith('video/') ? 'video' : 'image' }]);
      }
    } catch (e) { setError(e.response?.data?.message || e.response?.data?.error || 'Some uploads failed. Uploaded media is kept; retry the remaining files.'); }
    finally { setBusy(false); }
  };
  const collection = collections.find(c => c.id === active);
  const media = collection?.items[slide];
  useEffect(() => {
    if (editing || paused || media?.type !== 'image' || slide >= collection.items.length - 1) return;
    const timer = setTimeout(() => setSlide(n => n + 1), 5000);
    return () => clearTimeout(timer);
  }, [editing, paused, media, slide, collection]);
  return <section className="mb-8" aria-label="Shop highlights">
    {(isOwner || collections.length > 0) && <h2 className="text-lg font-bold mb-3">Highlights</h2>}
    <div className="flex gap-4 overflow-x-auto pb-2">
      {collections.map(c => <button key={c.id} onClick={() => { setActive(c.id); setSlide(0); setPaused(false); }} className="w-20 shrink-0 text-center" aria-label={`View ${c.title} highlight`}>
        <span className="flex w-20 h-20 rounded-full p-1 border-2 border-[#CDFF00] overflow-hidden bg-white/5">
          {c.items[0]?.type === 'video' ? <video src={uploadUrl(c.items[0].url)} muted playsInline preload="metadata" className="w-full h-full object-cover rounded-full" /> : <img src={uploadUrl(c.items[0]?.url)} alt="" className="w-full h-full object-cover rounded-full" />}
        </span><span className="block text-xs mt-2 truncate">{c.title}</span>
      </button>)}
      {isOwner && collections.length < 12 && <button onClick={() => edit(null)} className="w-20 shrink-0 text-xs"><span className="flex items-center justify-center w-20 h-20 rounded-full border border-white/20"><Plus /></span><span className="block mt-2">New highlight</span></button>}
    </div>
    {open && <dialog ref={dialog} onCancel={e => { e.preventDefault(); close(); }} className="media-overlay m-auto w-[calc(100%-2rem)] max-w-lg max-h-[90dvh] overflow-y-auto rounded-2xl p-5 bg-[#111] text-white border border-white/15 backdrop:bg-black/80" aria-label={editing ? 'Edit highlight' : collection?.title} onKeyDown={e => {
      if (editing || e.target.closest('input, video')) return;
      if (e.key === 'ArrowRight') setSlide(n => Math.min(n + 1, collection.items.length - 1));
      if (e.key === 'ArrowLeft') setSlide(n => Math.max(0, n - 1));
    }}>
      <div className="flex items-center justify-between gap-3 mb-4"><h2 className="text-lg font-bold">{editing ? 'Edit highlight' : collection?.title}</h2><button onClick={close} disabled={busy} aria-label="Close highlights" className="min-h-11 min-w-11 flex items-center justify-center"><X /></button></div>
      {error && <p role="alert" className="text-red-400 text-sm mb-3">{error}</p>}
      {editing ? <form onSubmit={e => { e.preventDefault(); const next = { id: editId || crypto.randomUUID(), title: title.trim(), items }; save(editId ? collections.map(c => c.id === editId ? next : c) : [...collections, next]); }}>
        <label className="block text-sm">Collection name<input required maxLength={40} value={title} onChange={e => setTitle(e.target.value)} disabled={busy} className="block w-full rounded-xl border border-white/20 bg-white/5 p-3 mt-2 mb-4" placeholder="New arrivals, offers, behind the scenes…" /></label>
        <div className="grid grid-cols-3 gap-2 mb-4">{items.map((item, i) => <div key={`${item.url}-${i}`} className="relative aspect-square rounded-xl overflow-hidden bg-black/40">
          {item.type === 'video' ? <video src={uploadUrl(item.url)} muted playsInline preload="metadata" className="w-full h-full object-cover" /> : <img src={uploadUrl(item.url)} alt={`Slide ${i + 1}`} className="w-full h-full object-cover" />}
          <button type="button" disabled={busy} onClick={() => setItems(items.filter((_, index) => i !== index))} aria-label={`Remove slide ${i + 1}`} className="absolute top-0 right-0 min-h-11 min-w-11 bg-black/70 text-white flex items-center justify-center"><X size={16} /></button>
        </div>)}</div>
        <label className="block text-sm mb-5">Add photos or videos (20 MB each)<input type="file" multiple accept="image/*,video/*" disabled={busy || items.length >= 20} className="block w-full mt-2 text-sm" onChange={e => { upload([...e.target.files]); e.target.value = ''; }} /></label>
        <p className="text-xs text-gray-400 mb-4">For reliable video playback, use MP4 (H.264) or WebM. Slides play in upload order. Highlights stay on your storefront until you remove them.</p>
        <button disabled={busy || !title.trim() || !items.length} className="w-full min-h-11 rounded-xl bg-[#CDFF00] text-black font-bold disabled:opacity-50">{busy ? 'Saving…' : 'Save highlight'}</button>
        {editId && <button type="button" disabled={busy} onClick={() => { if (window.confirm('Delete this highlight collection?')) save(collections.filter(c => c.id !== editId)); }} className="flex items-center justify-center gap-2 w-full min-h-11 text-red-400 mt-2"><Trash2 size={16} />Delete collection</button>}
      </form> : <>
        <div className="flex gap-1 mb-3" aria-label={`Slide ${slide + 1} of ${collection?.items.length}`}>{collection?.items.map((_, i) => <button key={i} onClick={() => setSlide(i)} aria-label={`Go to slide ${i + 1}`} className={`h-2 flex-1 rounded-full ${i === slide ? 'bg-[#CDFF00]' : 'bg-gray-500'}`} />)}</div>
        <div className="aspect-[9/16] max-h-[60dvh] bg-black rounded-xl overflow-hidden flex justify-center">
          {media?.type === 'video' ? <HighlightVideo key={`${active}-${slide}-${media.url}`} url={media.url} onEnded={() => setSlide(n => Math.min(n + 1, collection.items.length - 1))} /> : <img src={uploadUrl(media?.url)} alt={`${collection?.title}, slide ${slide + 1}`} className="w-full h-full object-contain" />}
        </div>
        <div className="flex items-center justify-between mt-3"><button aria-label="Previous slide" disabled={slide === 0} onClick={() => setSlide(n => n - 1)} className="min-h-11 min-w-11 disabled:opacity-30"><ChevronLeft /></button><span className="text-sm">{slide + 1} / {collection?.items.length}</span><button aria-label="Next slide" disabled={slide === collection?.items.length - 1} onClick={() => setSlide(n => n + 1)} className="min-h-11 min-w-11 disabled:opacity-30"><ChevronRight /></button></div>
        {media?.type === 'image' && <button onClick={() => setPaused(p => !p)} className="min-h-11 w-full text-sm" aria-pressed={paused}>{paused ? 'Resume slideshow' : 'Pause slideshow'}</button>}
        {isOwner && <button onClick={() => edit(collection)} className="min-h-11 w-full border border-white/20 rounded-xl mt-2 text-sm">Edit collection</button>}
      </>}
    </dialog>}
  </section>;
}
