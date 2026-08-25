import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck, Users, Briefcase, Newspaper, Package, Search, Loader2, CheckCircle2,
  XCircle, ShieldAlert, Clock, ExternalLink, BadgeCheck, RefreshCw, AlertCircle,
  FileText, LayoutDashboard, Wrench
} from 'lucide-react';
import { adminApi, publishersApi, dispatchToast } from '../api/client';
import { useSelector } from 'react-redux';
import { selectIsAuthenticated } from '../store/authSlice';

const TABS = [
  { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
  { id: 'publishers', name: 'Verification', icon: BadgeCheck },
  { id: 'orders', name: 'Orders', icon: Package },
  { id: 'users', name: 'Users', icon: Users },
  { id: 'jobs', name: 'Jobs', icon: Briefcase },
];

const STATUS_TONE = {
  PENDING:   'text-amber-400 bg-amber-400/10 border-amber-400/20',
  APPROVED:  'text-[#CDFF00] bg-[#CDFF00]/10 border-[#CDFF00]/20',
  REJECTED:  'text-red-400 bg-red-400/10 border-red-400/20',
  SUSPENDED: 'text-red-400 bg-red-400/10 border-red-400/20',
};

const BOOKING_STATUSES = ['POSTED', 'INQUIRED', 'NEGOTIATING', 'BOOKED', 'COMPLETED', 'CANCELLED'];

/**
 * Admin back-office: verification review, order tracking, user support, job moderation.
 *
 * <p>Guarded twice. This component redirects a non-admin away, but that is only a
 * courtesy — the real enforcement is server-side, where {@code /api/v1/admin/**} requires
 * ROLE_ADMIN. Someone who forces this route open simply sees every panel fail with 403.
 */
export default function Admin() {
  const navigate = useNavigate();
  const isAuthenticated = useSelector(selectIsAuthenticated);

  const [allowed, setAllowed] = useState(null); // null = still checking
  const [tab, setTab] = useState('dashboard');

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return; }
    publishersApi.me()
      .then((res) => {
        if (res.data?.isAdmin) setAllowed(true);
        else { setAllowed(false); navigate('/'); }
      })
      .catch(() => { setAllowed(false); navigate('/'); });
  }, [isAuthenticated, navigate]);

  if (allowed !== true) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#CDFF00]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <div className="flex items-center gap-3 mb-1">
        <ShieldCheck className="w-7 h-7 text-[#CDFF00]" />
        <h1 className="text-2xl font-black uppercase tracking-tight">Admin console</h1>
      </div>
      <p className="text-sm text-gray-500 mb-7">Review verifications, track orders, and fix accounts.</p>

      <div className="flex flex-wrap gap-2 mb-7">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
              tab === t.id
                ? 'bg-[#CDFF00] text-black border-[#CDFF00]'
                : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:border-white/20'
            }`}
          >
            <t.icon className="w-4 h-4" /> {t.name}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
        >
          {tab === 'dashboard' && <DashboardTab onJump={setTab} />}
          {tab === 'publishers' && <PublishersTab />}
          {tab === 'orders' && <OrdersTab />}
          {tab === 'users' && <UsersTab />}
          {tab === 'jobs' && <JobsTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ── Dashboard ─────────────────────────────────────────────────────────────── */

function DashboardTab({ onJump }) {
  const [stats, setStats] = useState(null);
  const [market, setMarket] = useState(null);

  useEffect(() => {
    adminApi.stats().then((r) => setStats(r.data)).catch(() => setStats({}));
    adminApi.marketplaceStats().then((r) => setMarket(r.data)).catch(() => setMarket({}));
  }, []);

  if (!stats || !market) return <Skeleton rows={2} />;

  const cards = [
    { label: 'Awaiting review', value: stats.pendingPublishers ?? 0, icon: Clock, jump: 'publishers', hot: (stats.pendingPublishers ?? 0) > 0 },
    { label: 'Verified publishers', value: stats.approvedPublishers ?? 0, icon: BadgeCheck },
    { label: 'Total users', value: stats.totalUsers ?? 0, icon: Users, jump: 'users' },
    { label: 'Orders', value: market.totalOrders ?? 0, icon: Package, jump: 'orders' },
    { label: 'Listings', value: market.totalListings ?? 0, icon: FileText },
    { label: 'Open jobs', value: market.openJobs ?? 0, icon: Briefcase, jump: 'jobs' },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {cards.map((c) => (
          <button
            key={c.label}
            onClick={() => c.jump && onJump(c.jump)}
            className={`text-left p-4 rounded-2xl border transition-all ${
              c.hot
                ? 'bg-amber-400/10 border-amber-400/30 hover:border-amber-400/50'
                : 'bg-white/[0.02] border-white/10 hover:border-white/20'
            } ${c.jump ? 'cursor-pointer' : 'cursor-default'}`}
          >
            <c.icon className={`w-5 h-5 mb-2 ${c.hot ? 'text-amber-400' : 'text-[#CDFF00]'}`} />
            <div className="text-2xl font-black text-white leading-none">{c.value}</div>
            <div className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mt-1.5">{c.label}</div>
          </button>
        ))}
      </div>

      {market.ordersByStatus && (
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3">Orders by status</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(market.ordersByStatus).map(([k, v]) => (
              <span key={k} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                {k} <span className="text-white ml-1">{v}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Verification queue ────────────────────────────────────────────────────── */

function PublishersTab() {
  const [status, setStatus] = useState('PENDING');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [noteFor, setNoteFor] = useState(null);
  const [note, setNote] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    adminApi.publishers(status)
      .then((r) => setRows(r.data || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [status]);

  useEffect(load, [load]);

  const decide = async (profileId, next, withNote) => {
    setBusy(profileId);
    try {
      await adminApi.decide(profileId, next, withNote);
      dispatchToast(`Marked ${next.toLowerCase()}`, 'success');
      setNoteFor(null);
      setNote('');
      load();
    } catch (e) {
      dispatchToast(e.response?.data?.error || 'Could not save decision', 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED', 'ALL'].map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`px-3.5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${
              status === s ? 'bg-white text-black border-white' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? <Skeleton rows={3} /> : rows.length === 0 ? (
        <Empty icon={BadgeCheck} title="Nothing here" hint={`No ${status.toLowerCase()} applications`} />
      ) : rows.map((row) => {
        const p = row.profile;
        return (
          <div key={p.id} className="p-4 rounded-2xl bg-white/[0.02] border border-white/10">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-black/40 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
                {p.logoUrl
                  ? <img src={p.logoUrl} alt="" className="w-full h-full object-contain p-1" />
                  : (p.type === 'NEWS_OUTLET' ? <Newspaper className="w-5 h-5 text-gray-600" /> : <Briefcase className="w-5 h-5 text-gray-600" />)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h3 className="text-sm font-black text-white">{p.companyName}</h3>
                  <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border ${STATUS_TONE[p.status]}`}>
                    {p.status}
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500">
                    {p.type === 'NEWS_OUTLET' ? 'News outlet' : 'Hiring company'}
                  </span>
                </div>

                <p className="text-xs text-gray-400 mb-1">
                  {row.applicantName} · {row.applicantEmail}
                  {row.applicantIdVerified && <BadgeCheck className="w-3 h-3 text-[#CDFF00] inline ml-1" />}
                </p>

                {p.description && <p className="text-xs text-gray-500 leading-relaxed my-2">{p.description}</p>}

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-bold uppercase tracking-widest text-gray-600">
                  {p.registrationNumber && <span>Reg: {p.registrationNumber}</span>}
                  {p.website && (
                    <a href={p.website} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-[#CDFF00] flex items-center gap-1">
                      Website <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {p.documentUrl && (
                    <a href={p.documentUrl} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-[#CDFF00] flex items-center gap-1">
                      Proof document <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                {p.reviewNote && (
                  <p className="text-[11px] text-gray-500 mt-2 italic">Previous note: {p.reviewNote}</p>
                )}

                {noteFor === p.id ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <input
                      autoFocus value={note} onChange={(e) => setNote(e.target.value)}
                      placeholder="Reason (sent to the applicant)"
                      className="flex-1 min-w-[200px] bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 outline-none focus:border-[#CDFF00]/60"
                    />
                    <button onClick={() => decide(p.id, 'REJECTED', note)} disabled={busy === p.id}
                            className="px-3 py-2 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-[10px] font-black uppercase tracking-widest">
                      Confirm reject
                    </button>
                    <button onClick={() => { setNoteFor(null); setNote(''); }}
                            className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 text-[10px] font-black uppercase tracking-widest">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {p.status !== 'APPROVED' && (
                      <button onClick={() => decide(p.id, 'APPROVED')} disabled={busy === p.id}
                              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#CDFF00] text-black text-[10px] font-black uppercase tracking-widest disabled:opacity-50">
                        {busy === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Approve
                      </button>
                    )}
                    {p.status !== 'REJECTED' && (
                      <button onClick={() => setNoteFor(p.id)}
                              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-300 text-[10px] font-black uppercase tracking-widest">
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </button>
                    )}
                    {p.status === 'APPROVED' && (
                      <button onClick={() => decide(p.id, 'SUSPENDED', 'Suspended by an administrator')} disabled={busy === p.id}
                              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-[10px] font-black uppercase tracking-widest">
                        <ShieldAlert className="w-3.5 h-3.5" /> Suspend
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Orders ────────────────────────────────────────────────────────────────── */

function OrdersTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('ALL');
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState({ status: '', paymentStatus: '', note: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    adminApi.orders({ q: q || undefined, status })
      .then((r) => setRows(r.data || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [q, status]);

  useEffect(() => {
    const t = setTimeout(load, q ? 350 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const save = async () => {
    setBusy(true);
    try {
      await adminApi.fixOrder(editing.id, draft);
      dispatchToast('Order updated', 'success');
      setEditing(null);
      load();
    } catch (e) {
      dispatchToast(e.response?.data?.error || 'Could not update order', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="flex-1 min-w-[220px] flex items-center gap-2.5 bg-white/5 border border-white/10 focus-within:border-[#CDFF00]/50 rounded-xl px-4 py-2.5">
          <Search className="w-4 h-4 text-gray-500 shrink-0" />
          <input value={q} onChange={(e) => setQ(e.target.value)}
                 placeholder="Buyer, seller, listing, payment id…"
                 className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 outline-none" />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white outline-none">
          <option value="ALL">All statuses</option>
          {BOOKING_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={load} className="px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {loading ? <Skeleton rows={4} /> : rows.length === 0 ? (
        <Empty icon={Package} title="No orders found" hint="Try a different search or status" />
      ) : rows.map((o) => (
        <div key={o.id} className="p-4 rounded-2xl bg-white/[0.02] border border-white/10">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-white/10 border border-white/10 text-gray-300">
                  {o.status}
                </span>
                {o.paymentStatus && (
                  <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border ${
                    o.paymentStatus === 'PAID'
                      ? 'text-[#CDFF00] bg-[#CDFF00]/10 border-[#CDFF00]/20'
                      : 'text-gray-400 bg-white/5 border-white/10'
                  }`}>
                    {o.paymentStatus}
                  </span>
                )}
                <span className="text-[10px] font-mono text-gray-600">{String(o.id).slice(0, 8)}</span>
              </div>
              <p className="text-sm font-black text-white mb-1">{o.listingTitle || 'Listing removed'}</p>
              <p className="text-xs text-gray-400">
                {o.buyerName || '—'} <span className="text-gray-600">→</span> {o.sellerName || '—'}
              </p>
              <p className="text-[10px] text-gray-600 mt-1">
                {o.buyerEmail} · {o.agreedPrice ?? o.offeredPrice ?? '—'}
                {o.cancelReason ? ` · note: ${o.cancelReason}` : ''}
              </p>
            </div>
            <button
              onClick={() => {
                setEditing(o);
                setDraft({ status: o.status || '', paymentStatus: o.paymentStatus || '', note: '' });
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:border-[#CDFF00]/40 text-[10px] font-black uppercase tracking-widest shrink-0"
            >
              <Wrench className="w-3.5 h-3.5" /> Fix
            </button>
          </div>
        </div>
      ))}

      <AnimatePresence>
        {editing && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[900] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setEditing(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-[#0a0a0a] border border-white/10 rounded-3xl p-5 space-y-4"
            >
              <h3 className="text-base font-black uppercase tracking-tight">Override order</h3>
              <div className="p-3 rounded-xl bg-amber-400/10 border border-amber-400/20 flex gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-200/90 leading-relaxed">
                  This bypasses the normal booking rules. Every change is logged against your account.
                </p>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1.5 block">Booking status</label>
                <select value={draft.status} onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))}
                        className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none">
                  {BOOKING_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1.5 block">Payment status</label>
                <input value={draft.paymentStatus} onChange={(e) => setDraft((d) => ({ ...d, paymentStatus: e.target.value }))}
                       placeholder="PAID / UNPAID / REFUNDED"
                       className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-600 outline-none" />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1.5 block">Support note</label>
                <input value={draft.note} onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
                       placeholder="Why you changed this"
                       className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-600 outline-none" />
              </div>

              <div className="flex gap-2 pt-1">
                <button onClick={() => setEditing(null)}
                        className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-[10px] font-black uppercase tracking-widest">
                  Cancel
                </button>
                <button onClick={save} disabled={busy}
                        className="flex-1 py-2.5 rounded-xl bg-[#CDFF00] text-black text-[10px] font-black uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-2">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save override'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Users ─────────────────────────────────────────────────────────────────── */

function UsersTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    adminApi.users(q)
      .then((r) => setRows(r.data || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [q]);

  useEffect(() => {
    const t = setTimeout(load, q ? 350 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const patch = async (id, body) => {
    setBusy(id);
    try {
      await adminApi.updateUser(id, body);
      dispatchToast('User updated', 'success');
      load();
    } catch (e) {
      dispatchToast(e.response?.data?.error || 'Could not update user', 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5 bg-white/5 border border-white/10 focus-within:border-[#CDFF00]/50 rounded-xl px-4 py-2.5">
        <Search className="w-4 h-4 text-gray-500 shrink-0" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email…"
               className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 outline-none" />
      </div>

      {loading ? <Skeleton rows={4} /> : rows.length === 0 ? (
        <Empty icon={Users} title="No users found" hint="Try another search" />
      ) : rows.map((u) => (
        <div key={u.id} className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 flex flex-wrap items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-black border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
            {u.avatarUrl
              ? <img src={u.avatarUrl} alt="" className="w-full h-full object-cover" />
              : <span className="text-[#CDFF00] font-black uppercase text-sm">{(u.fullName || 'U')[0]}</span>}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-white truncate flex items-center gap-1.5">
              {u.fullName}
              {u.idVerified && <BadgeCheck className="w-3.5 h-3.5 text-[#CDFF00]" />}
            </p>
            <p className="text-xs text-gray-500 truncate">{u.email}{u.phone ? ` · ${u.phone}` : ''}</p>
            {(u.city || u.country) && (
              <p className="text-[10px] text-gray-600 truncate">{[u.city, u.country].filter(Boolean).join(', ')}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md bg-white/5 border border-white/10 text-gray-400">
              {u.role}
            </span>
            <button onClick={() => patch(u.id, { idVerified: !u.idVerified })} disabled={busy === u.id}
                    className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:border-[#CDFF00]/40 text-[10px] font-black uppercase tracking-widest disabled:opacity-50">
              {u.idVerified ? 'Un-verify ID' : 'Verify ID'}
            </button>
            <select
              value={u.role}
              onChange={(e) => patch(u.id, { role: e.target.value })}
              disabled={busy === u.id}
              className="bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-[10px] font-black uppercase tracking-widest text-gray-300 outline-none disabled:opacity-50"
            >
              {['BUYER', 'SELLER', 'ADMIN'].map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Jobs moderation ───────────────────────────────────────────────────────── */

function JobsTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.jobs()
      .then((r) => setRows(r.data || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Skeleton rows={4} />;
  if (rows.length === 0) return <Empty icon={Briefcase} title="No job adverts yet" hint="Verified companies post here" />;

  return (
    <div className="space-y-3">
      {rows.map((j) => (
        <div key={j.id} className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-white truncate">{j.title}</p>
            <p className="text-xs text-gray-500 truncate">{j.companyName}</p>
          </div>
          <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-gray-500">
            <span>{j.applicationsCount} applied</span>
            <span>{j.viewsCount} views</span>
            <span className="px-2 py-1 rounded-md bg-white/5 border border-white/10 text-gray-400">{j.status}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Shared bits ───────────────────────────────────────────────────────────── */

function Skeleton({ rows = 3 }) {
  return (
    <div className="space-y-3">
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="h-24 rounded-2xl bg-white/[0.03] border border-white/5 animate-pulse" />
      ))}
    </div>
  );
}

function Empty({ icon: Icon, title, hint }) {
  return (
    <div className="py-16 text-center flex flex-col items-center gap-3 bg-white/[0.02] border border-white/10 rounded-2xl">
      <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
        <Icon className="w-5 h-5 text-gray-600" />
      </div>
      <div>
        <h3 className="text-sm font-black uppercase tracking-tight">{title}</h3>
        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">{hint}</p>
      </div>
    </div>
  );
}
