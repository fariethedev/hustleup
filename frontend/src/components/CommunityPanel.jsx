import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Users, Plus, Check, MapPin, X, Loader, ImageUp, Search, ArrowUpRight } from 'lucide-react';
import { communitiesApi, dispatchToast } from '../api/client';
import SmartImage from './SmartImage';
import UploadPreview from './UploadPreview';
import ImageCropper from './ImageCropper';
import { lockBodyScroll } from '../utils/lockBodyScroll';

const TOPICS = ['Student life', 'Food & groceries', 'Hair & beauty', 'Fashion', 'Local business', 'Jobs & skills', 'Housing', 'Events & culture', 'Sport & wellbeing', 'Technology', 'Travel', 'Other'];
const control = 'w-full min-h-11 rounded-xl border border-white/15 bg-[#141414] px-3.5 py-3 text-sm text-white outline-none focus:border-[#CDFF00]';

export default function CommunityPanel({ onChanged, onSelect, selectedId }) {
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [busyIds, setBusyIds] = useState([]);
  const [query, setQuery] = useState('');
  const [view, setView] = useState('discover');
  const [expanded, setExpanded] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await communitiesApi.browse();
      setAll(Array.isArray(data) ? data : []);
    } catch {
      setError('Communities could not load. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const toggleMembership = async (community) => {
    if (busyIds.includes(community.id)) return;
    setBusyIds((ids) => [...ids, community.id]);
    try {
      const { data } = community.joinedByCurrentUser
        ? await communitiesApi.leave(community.id)
        : await communitiesApi.join(community.id);
      setAll((previous) => previous.map((item) => item.id === community.id ? data : item));
      dispatchToast(data.joinedByCurrentUser ? `You joined ${data.name}` : `You left ${data.name}`, 'success');
      onChanged?.(data);
    } catch (err) {
      dispatchToast(err.response?.data?.error || err.response?.data?.message || 'Could not update your membership. Try again.', 'error');
    } finally {
      setBusyIds((ids) => ids.filter((id) => id !== community.id));
    }
  };

  const joinedCount = all.filter((community) => community.joinedByCurrentUser).length;
  const search = query.trim().toLocaleLowerCase();
  const filtered = all.filter((community) => (
    (view !== 'joined' || community.joinedByCurrentUser)
    && (!search || [community.name, community.description, community.category, community.city].filter(Boolean).join(' ').toLocaleLowerCase().includes(search))
  )).sort((a, b) => (b.memberCount || 0) - (a.memberCount || 0));
  const visible = expanded || search ? filtered : filtered.slice(0, 4);

  return (
    <section aria-label="Find communities" className="mb-6 overflow-hidden rounded-2xl border border-white/10 bg-[#0c0c0c]">
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white">Find your people.</h2>
            <p className="mt-1 text-sm leading-relaxed text-gray-400">Local conversations, shared interests and a place to belong.</p>
          </div>
          <button type="button" onClick={() => setCreating(true)} className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-white/15 px-3 text-sm font-semibold text-white hover:bg-white/10"><Plus className="h-4 w-4" /> Create</button>
        </div>
        <label className="relative mt-4 block">
          <Search className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-gray-500" />
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by topic, name or city" aria-label="Search communities" className={`${control} pl-10`} />
        </label>
        <div className="mt-3 flex gap-2" role="group" aria-label="Community collections">
          {[['discover', 'Discover'], ['joined', `Joined · ${joinedCount}`]].map(([id, label]) => <button key={id} type="button" onClick={() => { setView(id); setExpanded(false); }} aria-pressed={view === id} className={`min-h-11 rounded-full px-4 text-sm font-semibold ${view === id ? 'bg-white text-black' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>{label}</button>)}
        </div>
      </div>
      {loading ? (
        <div className="space-y-3 px-4 pb-4" aria-label="Loading communities">{[0, 1, 2].map((id) => <div key={id} className="h-24 animate-pulse rounded-xl bg-white/5" />)}</div>
      ) : error ? (
        <div role="alert" className="p-5 text-center text-sm text-gray-300"><p>{error}</p><button type="button" onClick={load} className="mt-2 min-h-11 px-4 font-semibold text-[#CDFF00]">Try again</button></div>
      ) : filtered.length === 0 ? (
        <div className="px-5 pb-6 pt-2 text-center">
          <Users className="mx-auto mb-3 h-8 w-8 text-gray-500" />
          <p className="text-sm font-semibold text-white">{search ? 'No communities match your search' : view === 'joined' ? 'Your people are out there' : 'Start something local'}</p>
          <p className="mt-1 text-sm text-gray-400">{search ? 'Try a different name, topic or city.' : view === 'joined' ? 'Join a community to see its conversations here.' : 'Create a community and invite people who share your interests.'}</p>
          {view === 'joined' && !search && <button type="button" onClick={() => setView('discover')} className="mt-3 min-h-11 px-4 text-sm font-semibold text-[#CDFF00]">Discover communities</button>}
        </div>
      ) : (
        <div className="divide-y divide-white/10 border-t border-white/10">
          {visible.map((community) => (
            <article key={community.id} className={`p-4 sm:px-5 ${selectedId === community.id ? 'bg-[#CDFF00]/5' : ''}`}>
              <div className="flex items-start gap-3">
                <button type="button" onClick={() => onSelect?.(community)} aria-label={`Open ${community.name}`} className="h-12 w-12 shrink-0 overflow-hidden rounded-2xl bg-white/5"><SmartImage src={community.imageUrl} alt="" fallbackIcon={Users} className="h-full w-full object-cover" /></button>
                <div className="min-w-0 flex-1">
                  <button type="button" onClick={() => onSelect?.(community)} className="flex min-h-6 w-full items-center gap-1 text-left text-sm font-semibold text-white hover:underline"><span className="break-words">{community.name}</span><ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-gray-500" /></button>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400"><span>{community.memberCount || 0} {community.memberCount === 1 ? 'member' : 'members'}</span>{community.city && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{community.city}</span>}</div>
                </div>
                {community.ownedByCurrentUser ? <span className="flex min-h-11 items-center text-xs font-semibold text-[#CDFF00]">Your group</span> : (
                  <button type="button" disabled={busyIds.includes(community.id)} onClick={() => toggleMembership(community)} aria-label={`${community.joinedByCurrentUser ? 'Leave' : 'Join'} ${community.name}`} className={`flex min-h-11 min-w-20 shrink-0 items-center justify-center gap-1 rounded-full px-3 text-sm font-semibold disabled:opacity-50 ${community.joinedByCurrentUser ? 'border border-white/15 text-gray-300 hover:bg-white/5' : 'bg-[#CDFF00] text-black hover:bg-[#e0ff4d]'}`}>
                    {busyIds.includes(community.id) ? <Loader className="h-4 w-4 animate-spin" /> : community.joinedByCurrentUser ? <Check className="h-3.5 w-3.5" /> : null}{community.joinedByCurrentUser ? 'Joined' : 'Join'}
                  </button>
                )}
              </div>
              {community.description && <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-gray-400">{community.description}</p>}
              {community.category && <span className="mt-2 inline-block rounded-md bg-white/5 px-2 py-1 text-xs text-gray-400">{community.category}</span>}
            </article>
          ))}
          {filtered.length > 4 && !search && <button type="button" onClick={() => setExpanded((value) => !value)} className="min-h-12 w-full px-4 text-sm font-semibold text-gray-300 hover:bg-white/5">{expanded ? 'Show fewer' : `See all ${filtered.length} communities`}</button>}
        </div>
      )}
      {creating && <CreateCommunityModal onClose={() => setCreating(false)} onCreated={(community) => {
        setCreating(false); setAll((previous) => [community, ...previous]); setView('joined'); setQuery(''); onChanged?.(community); onSelect?.(community);
      }} />}
    </section>
  );
}

function CreateCommunityModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', description: '', city: '', category: '' });
  const [image, setImage] = useState(null);
  const [cropFile, setCropFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const dialog = useRef(null);
  useEffect(() => { dialog.current?.showModal(); return lockBodyScroll(); }, []);
  const set = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));
  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;
    if (form.name.trim().length < 3 || !form.category) { setError('Add a name of at least 3 characters and pick one topic.'); return; }
    setSaving(true); setError('');
    try {
      const { data } = await communitiesApi.create({ ...form, name: form.name.trim(), description: form.description.trim(), city: form.city.trim(), image });
      dispatchToast(`${data.name} created. You're its first member.`, 'success');
      onCreated(data);
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Could not create your community. Please try again.');
    } finally { setSaving(false); }
  };
  return createPortal(
    <dialog ref={dialog} aria-labelledby="new-community-title" onCancel={(event) => { event.preventDefault(); if (!saving && !cropFile) onClose(); }} className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-3xl border border-white/15 bg-[#0c0c0c] p-5 text-white backdrop:bg-black/80">
      <form onSubmit={submit}>
        <div className="mb-1 flex items-center justify-between gap-3"><h2 id="new-community-title" className="text-xl font-bold">Start a community</h2><button type="button" onClick={onClose} disabled={saving} aria-label="Close" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/10"><X className="h-5 w-5" /></button></div>
        <p className="mb-5 text-sm leading-relaxed text-gray-400">Give people a shared interest and a welcoming place to talk.</p>
        <div className="space-y-4">
          <label className="block space-y-2 text-sm font-medium">Name<input value={form.name} onChange={(event) => set('name', event.target.value)} minLength={3} maxLength={80} required autoFocus placeholder="e.g. Lublin food lovers" className={control} /></label>
          <label className="block space-y-2 text-sm font-medium">What is this community about?<textarea value={form.description} onChange={(event) => set('description', event.target.value)} maxLength={1000} rows={3} placeholder="A short introduction and what people can share." className={`${control} resize-none`} /></label>
          <label className="block space-y-2 text-sm font-medium">Topic — pick one<select required value={form.category} onChange={(event) => set('category', event.target.value)} className={control}><option value="" disabled>Select a topic</option>{TOPICS.map((topic) => <option key={topic}>{topic}</option>)}</select></label>
          <label className="block space-y-2 text-sm font-medium">City <span className="text-gray-500">(optional)</span><input value={form.city} onChange={(event) => set('city', event.target.value)} maxLength={100} placeholder="e.g. Lublin" className={control} /></label>
          <div className="flex items-center gap-3">
            <div className="h-16 w-16 overflow-hidden rounded-2xl bg-white/5">{image ? <UploadPreview file={image} alt="Community photo" className="h-full w-full object-cover" /> : <Users className="m-4 h-8 w-8 text-gray-500" />}</div>
            <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-white/15 px-4 text-sm font-semibold"><ImageUp className="h-4 w-4" />{image ? 'Change photo' : 'Add a photo'}<input type="file" accept="image/*" className="sr-only" onChange={(event) => {
              const file = event.target.files?.[0]; event.target.value = '';
              if (!file) return;
              if (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) { setError('Choose an image smaller than 10 MB.'); return; }
              setError(''); dialog.current?.close(); setCropFile(file);
            }} /></label>
          </div>
          {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
          <button type="submit" disabled={saving || !form.name.trim() || !form.category} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#CDFF00] text-sm font-bold text-black disabled:opacity-50">{saving && <Loader className="h-4 w-4 animate-spin" />}{saving ? 'Creating…' : 'Create community'}</button>
        </div>
      </form>
      {cropFile && <ImageCropper file={cropFile} lockAspect={1} onCancel={() => { setCropFile(null); dialog.current?.showModal(); }} onApply={(file) => { setImage(file); setCropFile(null); dialog.current?.showModal(); }} />}
    </dialog>, document.body,
  );
}
