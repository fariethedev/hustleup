import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, Flag, Gavel, UserX, Landmark, CreditCard, Eye, Download, RefreshCcw, Loader } from 'lucide-react';
import { trustApi, claimsApi, adminApi, dispatchToast } from '../../api/client';
import { formatPrice, labelize } from '../../utils/constants';
import { timeAgo } from '../../utils/time';
import { uploadUrl } from '../../config';
import { Skeleton, Empty, Pill, MessageUser } from './shared';

/**
 * Trust & Safety console: everything that protects buyers from fraud and sellers from abuse.
 *
 *   Review     — listings held by the fraud screen (counterfeit wording, risky items from new
 *                sellers, prices far below market) waiting for a person.
 *   Reports    — users' reports of listings, shops and sellers (notice and action).
 *   Disputes   — buyer claims: seller response, full/partial refund or release, appeals.
 *   Sellers    — strikes, suspensions, accounts linked by payout bank account.
 *   Chargebacks— Stripe disputes and fund recovery.
 *   DAC7       — the annual seller report for the tax office.
 *
 * Every action that takes something from a user requires a reason, which is sent to them.
 */
const SECTIONS = [
  { id: 'review', label: 'Listing review', icon: Eye, count: 'listingsInReview' },
  { id: 'reports', label: 'Reports', icon: Flag, count: 'openReports' },
  { id: 'disputes', label: 'Disputes', icon: Gavel, count: 'openClaims' },
  { id: 'sellers', label: 'Sellers', icon: UserX, count: 'suspendedSellers' },
  { id: 'chargebacks', label: 'Chargebacks', icon: CreditCard },
  { id: 'dac7', label: 'DAC7 tax report', icon: Landmark },
];

const btn = 'px-3 py-2 rounded-lg text-[10px] font-black tracking-widest border transition-colors disabled:opacity-40';
const primary = `${btn} bg-[#CDFF00] text-black border-[#CDFF00] hover:bg-[#d8ff3d]`;
const danger = `${btn} bg-red-500/10 text-red-300 border-red-500/30 hover:bg-red-500/20`;
const ghost = `${btn} bg-white/5 text-gray-300 border-white/10 hover:text-white hover:border-white/25`;
const input = 'w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#CDFF00]/50';
const card = 'p-4 sm:p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3';

const errorText = (e, fallback) => e?.response?.data?.error || e?.response?.data?.message || fallback;
const img = (u) => (u ? (u.startsWith('http') ? u : uploadUrl(u)) : null);

export default function TrustTab() {
  const [section, setSection] = useState('review');
  const [overview, setOverview] = useState({});
  const refreshOverview = useCallback(() => trustApi.overview().then((r) => setOverview(r.data || {})).catch(() => {}), []);
  useEffect(() => { refreshOverview(); }, [refreshOverview, section]);

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 p-4 rounded-2xl bg-[#CDFF00]/[0.04] border border-[#CDFF00]/15">
        <ShieldAlert className="w-5 h-5 text-[#CDFF00] shrink-0 mt-0.5" />
        <p className="text-xs text-gray-400 leading-relaxed">
          Payments are held until buyers confirm receipt. Risky listings wait here before going live; reported listings
          hide after {3} independent reports; {3} strikes suspend a seller and any account paid to the same bank.
          Every removal, suspension and decision sends the user your stated reason.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {SECTIONS.map((s) => {
          const n = s.count ? Number(overview[s.count] || 0) : 0;
          return (
            <button key={s.id} onClick={() => setSection(s.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-[10px] font-black tracking-widest border transition-all ${
                section === s.id ? 'bg-white/10 border-white/25 text-white' : 'bg-white/[0.02] border-white/10 text-gray-500 hover:text-white'}`}>
              <s.icon className="w-3.5 h-3.5" /> {s.label}
              {n > 0 && <span className="ml-1 px-1.5 rounded bg-amber-400/20 text-amber-300">{n}</span>}
            </button>
          );
        })}
      </div>

      {section === 'review' && <ReviewQueue onChange={refreshOverview} />}
      {section === 'reports' && <ReportsQueue onChange={refreshOverview} />}
      {section === 'disputes' && <DisputesQueue onChange={refreshOverview} />}
      {section === 'sellers' && <SellersList onChange={refreshOverview} />}
      {section === 'chargebacks' && <Chargebacks />}
      {section === 'dac7' && <Dac7 />}
    </div>
  );
}

/* ── Listing review ────────────────────────────────────────────────────────── */

function ReviewQueue({ onChange }) {
  const [rows, setRows] = useState(null);
  const [notes, setNotes] = useState({});
  const [busy, setBusy] = useState(null);
  const load = useCallback(() => trustApi.reviewQueue().then((r) => setRows(r.data || [])).catch(() => setRows([])), []);
  useEffect(() => { load(); }, [load]);

  const act = async (l, kind, strike = false) => {
    const note = (notes[l.id] || '').trim();
    if (kind === 'remove' && !note) { dispatchToast('Write the reason the seller will see', 'error'); return; }
    setBusy(l.id);
    try {
      if (kind === 'approve') await trustApi.approveListing(l.id, note);
      else await trustApi.removeListing(l.id, note, strike);
      dispatchToast(kind === 'approve' ? 'Listing approved and live' : 'Listing removed — seller notified', 'success');
      await load(); onChange();
    } catch (e) { dispatchToast(errorText(e, 'Could not update the listing'), 'error'); }
    finally { setBusy(null); }
  };

  if (!rows) return <Skeleton />;
  if (!rows.length) return <Empty icon={Eye} title="Nothing waiting for review" hint="RISKY NEW LISTINGS APPEAR HERE BEFORE GOING LIVE" />;
  return (
    <div className="space-y-3">
      {rows.map((l) => (
        <div key={l.id} className={card}>
          <div className="flex gap-4">
            {img(l.image) ? <img src={img(l.image)} alt="" className="w-24 h-24 rounded-xl object-cover bg-white/5 shrink-0" />
              : <div className="w-24 h-24 rounded-xl bg-white/5 shrink-0" />}
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-black text-white truncate">{l.title}</h3>
                <span className="text-[#CDFF00] font-black text-sm">{l.price != null ? formatPrice(Number(l.price), l.currency) : '—'}</span>
              </div>
              <p className="text-xs text-amber-300">{l.reason}</p>
              <p className="text-xs text-gray-400 line-clamp-2">{l.description}</p>
              <p className="text-[10px] text-gray-500 font-bold tracking-widest">
                {(l.seller?.name || 'SELLER').toUpperCase()} · {l.seller?.email} · JOINED {timeAgo(l.seller?.createdAt)} · STRIKES {l.sellerStrikes} · LISTED {timeAgo(l.createdAt)}
              </p>
            </div>
          </div>
          <input className={input} placeholder="Note / reason (required to remove — the seller sees it)" value={notes[l.id] || ''}
            onChange={(e) => setNotes({ ...notes, [l.id]: e.target.value })} />
          <div className="flex flex-wrap gap-2">
            <button className={primary} disabled={busy === l.id} onClick={() => act(l, 'approve')}>APPROVE</button>
            <button className={ghost} disabled={busy === l.id} onClick={() => act(l, 'remove')}>REMOVE</button>
            <button className={danger} disabled={busy === l.id} onClick={() => act(l, 'remove', true)}>REMOVE + STRIKE</button>
            <Link to={`/listing/${l.id}`} className={ghost}>OPEN LISTING</Link>
            <MessageUser userId={l.seller?.id} name={l.seller?.name} label="Message seller" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Reports ───────────────────────────────────────────────────────────────── */

const REPORT_ACTIONS = [
  ['DISMISS', 'DISMISS', ghost],
  ['WARN_SELLER', 'WARN (STRIKE)', ghost],
  ['REMOVE_LISTING', 'REMOVE LISTING', danger],
  ['SUSPEND_SELLER', 'SUSPEND SELLER', danger],
];

function ReportsQueue({ onChange }) {
  const [status, setStatus] = useState('OPEN');
  const [rows, setRows] = useState(null);
  const [notes, setNotes] = useState({});
  const [busy, setBusy] = useState(null);
  const load = useCallback(() => { setRows(null); trustApi.reports(status).then((r) => setRows(r.data || [])).catch(() => setRows([])); }, [status]);
  useEffect(() => { load(); }, [load]);

  const act = async (r, action) => {
    const note = (notes[r.id] || '').trim();
    if (action !== 'DISMISS' && !note) { dispatchToast('Write the reason the seller will see', 'error'); return; }
    if (action === 'SUSPEND_SELLER' && !window.confirm('Suspend this seller? Their listings are hidden and open orders refunded.')) return;
    setBusy(r.id);
    try {
      await trustApi.resolveReport(r.id, action, note);
      dispatchToast('Report handled — reporter notified', 'success');
      await load(); onChange();
    } catch (e) { dispatchToast(errorText(e, 'Could not handle the report'), 'error'); }
    finally { setBusy(null); }
  };

  return (
    <div className="space-y-3">
      <Filters value={status} onChange={setStatus} options={['OPEN', 'ACTIONED', 'DISMISSED', 'ALL']} />
      {!rows ? <Skeleton /> : !rows.length ? <Empty icon={Flag} title="No reports" hint="USER REPORTS OF LISTINGS, SHOPS AND SELLERS" /> : rows.map((r) => (
        <div key={r.id} className={card}>
          <div className="flex gap-4">
            {img(r.listingImage) && <img src={img(r.listingImage)} alt="" className="w-20 h-20 rounded-xl object-cover bg-white/5 shrink-0" />}
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone={r.status === 'OPEN' ? 'open' : r.status === 'ACTIONED' ? 'bad' : 'neutral'}>{r.status}</Pill>
                <Pill tone="bad">{labelize(r.reason)}</Pill>
                <span className="text-[10px] text-gray-500 font-bold tracking-widest">{r.targetType} · {timeAgo(r.createdAt)}</span>
              </div>
              {r.listingTitle && <p className="font-black text-white">{r.listingTitle} <span className="text-[#CDFF00] text-sm">{r.listingPrice != null ? formatPrice(Number(r.listingPrice), r.listingCurrency) : ''}</span> <span className="text-[10px] text-gray-500">({r.listingStatus})</span></p>}
              {r.detail && <p className="text-sm text-gray-300">"{r.detail}"</p>}
              <p className="text-[10px] text-gray-500 font-bold tracking-widest">
                REPORTED BY {(r.reporter?.name || '?').toUpperCase()} · SELLER {(r.seller?.name || '?').toUpperCase()} ({r.seller?.email}) · {r.sellerOpenReports} OPEN REPORTS ON SELLER
              </p>
              {r.resolutionNote && <p className="text-xs text-gray-400">Decision: {labelize(r.actionTaken)} — {r.resolutionNote}</p>}
            </div>
          </div>
          {r.status === 'OPEN' && <>
            <input className={input} placeholder="Reason (required except to dismiss — the seller sees it)" value={notes[r.id] || ''}
              onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} />
            <div className="flex flex-wrap gap-2">
              {REPORT_ACTIONS.filter(([a]) => a !== 'REMOVE_LISTING' || r.targetType === 'LISTING').map(([a, label, cls]) => (
                <button key={a} className={cls} disabled={busy === r.id} onClick={() => act(r, a)}>{label}</button>
              ))}
              {r.targetType === 'LISTING' && <Link to={`/listing/${r.targetId}`} className={ghost}>OPEN LISTING</Link>}
            </div>
          </>}
        </div>
      ))}
    </div>
  );
}

/* ── Disputes ──────────────────────────────────────────────────────────────── */

function DisputesQueue({ onChange }) {
  const [status, setStatus] = useState('OPEN');
  const [rows, setRows] = useState(null);
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(null);
  const load = useCallback(() => {
    setRows(null);
    adminApi.claims(status).then((r) => setRows(r.data?.claims || [])).catch(() => setRows([]));
  }, [status]);
  useEffect(() => { load(); }, [load]);
  const f = (id) => form[id] || {};
  const set = (id, patch) => setForm({ ...form, [id]: { ...f(id), ...patch } });

  const decide = async (c, decision) => {
    const note = (f(c.id).note || '').trim();
    if (!note) { dispatchToast('Write the reasons both sides will see', 'error'); return; }
    const amount = f(c.id).amount;
    if (decision === 'PARTIAL_REFUND' && !(Number(amount) > 0)) { dispatchToast('Enter the amount to refund', 'error'); return; }
    setBusy(c.id);
    try {
      await claimsApi.decide(c.id, decision, note, decision === 'PARTIAL_REFUND' ? amount : undefined);
      dispatchToast('Decision recorded — both sides notified', 'success');
      await load(); onChange();
    } catch (e) { dispatchToast(errorText(e, 'Could not record the decision'), 'error'); }
    finally { setBusy(null); }
  };

  const decideAppeal = async (c, uphold) => {
    const note = (f(c.id).note || '').trim();
    if (!note) { dispatchToast('Write the reasons for the appeal decision', 'error'); return; }
    setBusy(c.id);
    try {
      await claimsApi.decideAppeal(c.id, uphold, note);
      dispatchToast('Appeal decided — final', 'success');
      await load(); onChange();
    } catch (e) { dispatchToast(errorText(e, 'Could not decide the appeal'), 'error'); }
    finally { setBusy(null); }
  };

  return (
    <div className="space-y-3">
      <Filters value={status} onChange={setStatus} options={['OPEN', 'APPEALED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'REJECTED', 'ALL']} />
      {!rows ? <Skeleton /> : !rows.length ? <Empty icon={Gavel} title="No disputes here" hint="BUYER CLAIMS FREEZE THE SELLER'S PAYOUT UNTIL DECIDED" /> : rows.map((c) => {
        const overdue = c.status === 'OPEN' && c.respondBy && !c.sellerResponse && new Date(c.respondBy) < new Date();
        return (
          <div key={c.id} className={card}>
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone={c.status === 'OPEN' || c.status === 'APPEALED' ? 'open' : c.status === 'REJECTED' ? 'neutral' : 'bad'}>{labelize(c.status)}</Pill>
              <Pill tone="bad">{labelize(c.reason)}</Pill>
              <span className="font-black text-white">{c.orderTitle || 'Order'}</span>
              <span className="text-[#CDFF00] font-black text-sm">{c.amount != null ? formatPrice(Number(c.amount), c.currency) : ''}</span>
              <span className="text-[10px] text-gray-500 font-bold tracking-widest">{labelize(c.paymentStatus || c.payoutStatus || '')} · OPENED {timeAgo(c.createdAt)}</span>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-black/30 border border-white/5">
                <p className="text-[10px] text-gray-500 font-black tracking-widest mb-1">BUYER · {c.buyerName || c.buyer?.name || ''}</p>
                <p className="text-sm text-gray-200 whitespace-pre-wrap">{c.detail}</p>
              </div>
              <div className={`p-3 rounded-xl bg-black/30 border ${overdue ? 'border-amber-400/40' : 'border-white/5'}`}>
                <p className="text-[10px] text-gray-500 font-black tracking-widest mb-1">
                  SELLER · {c.sellerName || c.seller?.name || ''} {c.respondBy && !c.sellerResponse ? `· RESPOND BY ${new Date(c.respondBy).toLocaleDateString()}` : ''}
                </p>
                <p className={`text-sm whitespace-pre-wrap ${c.sellerResponse ? 'text-gray-200' : overdue ? 'text-amber-300' : 'text-gray-500'}`}>
                  {c.sellerResponse || (overdue ? 'No response by the deadline — decide on the buyer’s evidence.' : 'Waiting for the seller’s response.')}
                </p>
              </div>
            </div>
            {c.resolutionNote && <p className="text-xs text-gray-400">Decision ({labelize(c.decision || '')}{c.refundAmount ? ` ${formatPrice(Number(c.refundAmount), c.currency)}` : ''}): {c.resolutionNote}</p>}
            {c.appealText && (
              <div className="p-3 rounded-xl bg-amber-400/[0.05] border border-amber-400/20">
                <p className="text-[10px] text-amber-300 font-black tracking-widest mb-1">APPEAL BY {c.appealBy} · {timeAgo(c.appealedAt)}</p>
                <p className="text-sm text-gray-200 whitespace-pre-wrap">{c.appealText}</p>
                {c.appealNote && <p className="text-xs text-gray-400 mt-2">Appeal decision: {c.appealNote}</p>}
              </div>
            )}
            {(c.status === 'OPEN' || c.status === 'APPEALED') && <>
              <input className={input} placeholder="Reasons — both sides see this" value={f(c.id).note || ''} onChange={(e) => set(c.id, { note: e.target.value })} />
              {c.status === 'OPEN' ? (
                <div className="flex flex-wrap items-center gap-2">
                  <button className={danger} disabled={busy === c.id} onClick={() => decide(c, 'FULL_REFUND')}>FULL REFUND</button>
                  <input className={`${input} w-28`} inputMode="decimal" placeholder="Amount" value={f(c.id).amount || ''} onChange={(e) => set(c.id, { amount: e.target.value })} />
                  <button className={ghost} disabled={busy === c.id} onClick={() => decide(c, 'PARTIAL_REFUND')}>PARTIAL REFUND</button>
                  <button className={primary} disabled={busy === c.id} onClick={() => decide(c, 'RELEASE')}>RELEASE TO SELLER</button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <button className={ghost} disabled={busy === c.id} onClick={() => decideAppeal(c, true)}>UPHOLD ORIGINAL</button>
                  <button className={danger} disabled={busy === c.id} onClick={() => decideAppeal(c, false)}>OVERTURN</button>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <MessageUser userId={c.buyerId} name="buyer" label="Message buyer" />
                <MessageUser userId={c.sellerId} name="seller" label="Message seller" />
              </div>
            </>}
          </div>
        );
      })}
    </div>
  );
}

/* ── Sellers ───────────────────────────────────────────────────────────────── */

function SellersList({ onChange }) {
  const [rows, setRows] = useState(null);
  const [reasons, setReasons] = useState({});
  const [busy, setBusy] = useState(null);
  const load = useCallback(() => trustApi.sellers().then((r) => setRows(r.data || [])).catch(() => setRows([])), []);
  useEffect(() => { load(); }, [load]);

  const act = async (s, kind) => {
    const reason = (reasons[s.sellerId] || '').trim();
    if (kind !== 'retry' && !reason) { dispatchToast('Write the reason the seller will see', 'error'); return; }
    if (kind === 'suspend' && !window.confirm('Suspend this seller and every account paid to the same bank? Open orders are refunded.')) return;
    setBusy(s.sellerId);
    try {
      if (kind === 'strike') await trustApi.strike(s.sellerId, reason);
      else if (kind === 'suspend') await trustApi.suspend(s.sellerId, reason);
      else await trustApi.retryRecovery(s.sellerId);
      dispatchToast('Done', 'success');
      await load(); onChange();
    } catch (e) { dispatchToast(errorText(e, 'Could not update the seller'), 'error'); }
    finally { setBusy(null); }
  };

  if (!rows) return <Skeleton />;
  if (!rows.length) return <Empty icon={UserX} title="No sellers need attention" hint="SUSPENDED, STRUCK, LINKED OR REPORTED SELLERS APPEAR HERE" />;
  return (
    <div className="space-y-3">
      {rows.map((s) => (
        <div key={s.sellerId} className={card}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-black text-white">{s.seller?.name || 'Seller'}</span>
            <span className="text-xs text-gray-500">{s.seller?.email}</span>
            {s.suspended ? <Pill tone="bad">SUSPENDED</Pill> : <Pill tone="good">ACTIVE</Pill>}
            <Pill tone={s.strikes >= 2 ? 'bad' : s.strikes ? 'open' : 'neutral'}>{s.strikes} / 3 STRIKES</Pill>
            {s.sellerType === 'BUSINESS' && <Pill tone="neutral">BUSINESS</Pill>}
            {s.linkedTo && <Pill tone="bad">LINKED TO SUSPENDED ACCOUNT</Pill>}
            {s.openReports > 0 && <Pill tone="open">{s.openReports} OPEN REPORTS</Pill>}
            {s.upheldClaims > 0 && <Pill tone="open">{s.upheldClaims} REFUNDED CLAIMS</Pill>}
          </div>
          {s.suspensionReason && <p className="text-xs text-red-300">Suspended {timeAgo(s.suspendedAt)}: {s.suspensionReason}</p>}
          <input className={input} placeholder="Reason (the seller sees it)" value={reasons[s.sellerId] || ''} onChange={(e) => setReasons({ ...reasons, [s.sellerId]: e.target.value })} />
          <div className="flex flex-wrap gap-2">
            {!s.suspended && <button className={ghost} disabled={busy === s.sellerId} onClick={() => act(s, 'strike')}>ADD STRIKE</button>}
            {!s.suspended && <button className={danger} disabled={busy === s.sellerId} onClick={() => act(s, 'suspend')}>SUSPEND</button>}
            {s.suspended && <button className={ghost} disabled={busy === s.sellerId} onClick={() => act(s, 'retry')}><RefreshCcw className="w-3 h-3 inline mr-1" />RETRY REFUNDS / RECOVERY</button>}
            <Link to={`/profile/${s.sellerId}`} className={ghost}>PROFILE</Link>
            <MessageUser userId={s.sellerId} name={s.seller?.name} label="Message seller" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Chargebacks ───────────────────────────────────────────────────────────── */

function Chargebacks() {
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(null);
  const load = useCallback(() => trustApi.disputes().then((r) => setRows(r.data || [])).catch(() => setRows([])), []);
  useEffect(() => { load(); }, [load]);
  const retry = async (d) => {
    setBusy(d.id);
    try { await trustApi.retryDispute(d.id); dispatchToast('Retried', 'success'); await load(); }
    catch (e) { dispatchToast(errorText(e, 'Retry failed'), 'error'); }
    finally { setBusy(null); }
  };
  if (!rows) return <Skeleton />;
  if (!rows.length) return <Empty icon={CreditCard} title="No chargebacks" hint="BANK DISPUTES FREEZE PAYOUTS AND RECOVER FUNDS FROM THE SELLER" />;
  return (
    <div className="space-y-3">
      {rows.map((d) => (
        <div key={d.id} className={card}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-gray-300">{d.id}</span>
            <Pill tone={/won/i.test(d.stripeStatus || '') ? 'good' : /lost/i.test(d.stripeStatus || '') ? 'bad' : 'open'}>{labelize(d.stripeStatus || 'unknown')}</Pill>
            <Pill tone={d.recovered ? 'good' : 'open'}>{d.recovered ? 'FUNDS RECOVERED' : 'NOT RECOVERED'}</Pill>
            <Pill tone={d.evidenceSubmitted ? 'good' : 'neutral'}>{d.evidenceSubmitted ? 'EVIDENCE SENT' : 'NO EVIDENCE YET'}</Pill>
            <span className="text-[10px] text-gray-500 font-bold tracking-widest">{d.paymentIntentId} · {timeAgo(d.updatedAt)}</span>
          </div>
          {d.lastError && <p className="text-xs text-red-300">{d.lastError}</p>}
          <button className={ghost} disabled={busy === d.id} onClick={() => retry(d)}><RefreshCcw className="w-3 h-3 inline mr-1" />RETRY</button>
        </div>
      ))}
    </div>
  );
}

/* ── DAC7 ──────────────────────────────────────────────────────────────────── */

function Dac7() {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear - 1);
  const [rows, setRows] = useState(null);
  const [downloading, setDownloading] = useState(false);
  useEffect(() => { setRows(null); trustApi.dac7(year).then((r) => setRows(r.data || [])).catch(() => setRows([])); }, [year]);

  const download = async () => {
    setDownloading(true);
    try {
      const { data } = await trustApi.dac7Csv(year, true);
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url; a.download = `hustlespace-dac7-${year}.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch { dispatchToast('Could not download the report', 'error'); }
    finally { setDownloading(false); }
  };

  const reportable = (rows || []).filter((r) => r.reportable);
  const missing = reportable.filter((r) => !r.detailsComplete);
  return (
    <div className="space-y-4">
      <div className={card}>
        <p className="text-sm text-gray-300 leading-relaxed">
          DAC7: by <strong className="text-white">31 January</strong>, report to KAS every seller who last year made 30+ sales or earned over €2,000,
          with their tax ID, date of birth, address and quarterly earnings and fees. Sellers fill these in under Settings → Seller details.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className={`${input} w-32`}>
            {[thisYear, thisYear - 1, thisYear - 2].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <button className={primary} disabled={downloading} onClick={download}>
            {downloading ? <Loader className="w-3 h-3 inline animate-spin" /> : <Download className="w-3 h-3 inline mr-1" />} DOWNLOAD CSV (REPORTABLE)
          </button>
          <span className="text-xs text-gray-500">{reportable.length} reportable · {missing.length} missing details</span>
        </div>
      </div>
      {!rows ? <Skeleton rows={2} /> : !rows.length ? <Empty icon={Landmark} title={`No completed sales in ${year}`} hint="SELLERS WITH SALES THAT YEAR APPEAR HERE" /> : (
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.03] text-[10px] text-gray-500 tracking-widest">
              <tr><th className="text-left p-3">SELLER</th><th className="text-right p-3">SALES</th><th className="text-right p-3">GROSS</th><th className="text-right p-3">FEES</th><th className="p-3">STATUS</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.seller?.id || Math.random()} className="border-t border-white/5">
                  <td className="p-3"><div className="font-bold text-white">{r.seller?.name}</div><div className="text-xs text-gray-500">{r.seller?.email}</div></td>
                  <td className="p-3 text-right">{r.sales}</td>
                  <td className="p-3 text-right">{formatPrice(Number(r.gross), r.currency)}</td>
                  <td className="p-3 text-right">{formatPrice(Number(r.fees), r.currency)}</td>
                  <td className="p-3 text-center space-x-1">
                    {r.reportable ? <Pill tone="open">REPORTABLE</Pill> : <Pill tone="neutral">BELOW THRESHOLD</Pill>}
                    {r.reportable && (r.detailsComplete ? <Pill tone="good">DETAILS OK</Pill> : <Pill tone="bad">DETAILS MISSING</Pill>)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Filters({ value, onChange, options }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button key={o} onClick={() => onChange(o)}
          className={`px-2.5 py-1.5 rounded-md text-[9px] font-black tracking-widest border ${value === o ? 'bg-[#CDFF00]/15 border-[#CDFF00]/40 text-[#CDFF00]' : 'bg-white/[0.02] border-white/10 text-gray-500 hover:text-white'}`}>
          {labelize(o)}
        </button>
      ))}
    </div>
  );
}
