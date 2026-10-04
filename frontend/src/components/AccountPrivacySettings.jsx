import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { selectUser, loadUserProfile } from '../store/authSlice';
import { usersApi, followsApi } from '../api/client';

export default function AccountPrivacySettings() {
  const user = useSelector(selectUser), dispatch = useDispatch();
  const [requests, setRequests] = useState([]), [followers, setFollowers] = useState([]);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const refresh = async () => {
    try { const [r, f] = await Promise.all([followsApi.requests(), followsApi.followers()]); setRequests(r.data); setFollowers(f.data); }
    catch { setError('Could not load follow requests. Please retry.'); }
  };
  useEffect(() => { refresh(); }, []);
  const act = async callback => {
    setBusy(true); setError('');
    try { await callback(); await refresh(); }
    catch (e) { setError(e.response?.data?.message || 'Could not save this change.'); }
    finally { setBusy(false); }
  };
  return <section className="rounded-2xl border border-white/15 p-5 mb-6 space-y-5">
    <div><h2 className="font-bold text-lg">Your account, your audience</h2><p className="text-sm text-gray-400 mt-2">Private accounts require your approval to follow. Only approved followers can see your profile details, posts and stories. Your name, avatar, marketplace listings and storefront remain public. Existing followers keep access until removed.</p></div>
    <label className="flex items-center justify-between gap-4 min-h-11 font-semibold">Private account<input type="checkbox" checked={!!user?.privateAccount} disabled={busy} onChange={e => { const privateAccount = e.target.checked; act(async () => { await usersApi.updateProfile({ privateAccount }); await dispatch(loadUserProfile()); }); }} className="w-5 h-5 accent-[#CDFF00]" /></label>
    {error && <p role="alert" className="text-sm text-red-400">{error} <button className="underline" onClick={refresh}>Retry</button></p>}
    <div><h3 className="font-semibold mb-3">Follow requests ({requests.length})</h3>{requests.length === 0 && <p className="text-sm text-gray-400">No pending requests.</p>}{requests.map(person => <div key={person.id} className="flex flex-wrap items-center gap-2 py-2 border-b border-white/10"><span className="flex-1 text-sm">{person.fullName || person.username}</span><button disabled={busy} onClick={() => act(() => followsApi.approveRequest(person.id))} className="min-h-11 px-3 rounded-xl bg-[#CDFF00] text-black text-sm">Approve</button><button disabled={busy} onClick={() => act(() => followsApi.declineRequest(person.id))} className="min-h-11 px-3 text-sm">Decline</button></div>)}</div>
    <details><summary className="min-h-11 cursor-pointer text-sm font-semibold">Manage followers ({followers.length})</summary>{followers.map(person => <div key={person.id} className="flex items-center gap-3 py-2"><span className="flex-1 text-sm">{person.fullName || person.username}</span><button disabled={busy} onClick={() => { if (window.confirm('Remove this follower?')) act(() => followsApi.removeFollower(person.id)); }} className="min-h-11 text-sm text-red-400">Remove</button></div>)}</details>
  </section>;
}
