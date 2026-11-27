import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { selectUser } from '../store/authSlice';
import { Flag, ShieldAlert, Store, User as UserIcon, Gavel, X } from 'lucide-react';
import { trustApi, claimsApi, dispatchToast } from '../api/client';

/*
 * Trust & safety pieces shared across pages: reporting, trader status (DSA), claim
 * response/appeal, the seller-details form (DSA + DAC7) and the off-platform payment warning.
 */

const errorText = (e, fallback) => e?.response?.data?.error || e?.response?.data?.message || fallback;

const REASONS = [
  ['SCAM', 'Scam or fraud'],
  ['COUNTERFEIT', 'Counterfeit or replica'],
  ['PROHIBITED_ITEM', 'Prohibited or illegal item'],
  ['MISLEADING', 'Misleading description or photos'],
  ['OFF_PLATFORM_PAYMENT', 'Asked to pay outside HustleSpace'],
  ['NOT_RECEIVED_PATTERN', 'Seller does not deliver'],
  ['OFFENSIVE', 'Offensive content'],
  ['OTHER', 'Something else'],
];

/** "Report" button + dialog for a listing, shop or seller. */
export function ReportButton({ targetType, targetId, className = '' }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('SCAM');
  const [detail, setDetail] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      const { data } = await trustApi.report(targetType, targetId, reason, detail.trim());
      dispatchToast(data?.message || 'Thanks — our team will review this.', 'success');
      setOpen(false); setDetail('');
    } catch (e) { dispatchToast(errorText(e, 'Could not send the report'), 'error'); }
    finally { setBusy(false); }
  };
  return (
    <>
      <button onClick={() => setOpen(true)} className={className || 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass-strong text-[9px] font-black tracking-widest text-gray-300 hover:text-white hover:bg-white/5 active:scale-95 transition-all'}>
        <Flag className="w-3.5 h-3.5" /> Report
      </button>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70" onClick={() => !busy && setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label="Report" className="w-full max-w-md rounded-3xl bg-[#111] border border-white/10 p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-white">Report this {targetType === 'LISTING' ? 'listing' : targetType === 'SHOP' ? 'shop' : 'seller'}</h2>
              <button aria-label="Close" onClick={() => setOpen(false)} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-2">
              {REASONS.map(([value, label]) => (
                <label key={value} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer ${reason === value ? 'border-[#CDFF00]/50 bg-[#CDFF00]/5' : 'border-white/10 hover:border-white/20'}`}>
                  <input type="radio" name="reason" value={value} checked={reason === value} onChange={() => setReason(value)} className="accent-[#CDFF00]" />
                  <span className="text-sm text-gray-200">{label}</span>
                </label>
              ))}
            </div>
            <textarea value={detail} onChange={(e) => setDetail(e.target.value)} maxLength={2000} rows={3}
              placeholder="Anything that helps us check (optional)"
              className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#CDFF00]/50" />
            <p className="text-xs text-gray-500">Reports are confidential. We'll tell you what we decided.</p>
            <button disabled={busy} onClick={submit} className="w-full py-3 rounded-xl bg-[#CDFF00] text-black font-black text-sm disabled:opacity-50">
              {busy ? 'Sending…' : 'Send report'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/** Whether a seller is a business or a private person, and what that means for the buyer. */
export function TraderNotice({ sellerId }) {
  const [t, setT] = useState(null);
  useEffect(() => {
    if (!sellerId) return;
    trustApi.trader(sellerId).then((r) => setT(r.data)).catch(() => setT(null));
  }, [sellerId]);
  if (!t) return null;
  const business = t.sellerType === 'BUSINESS';
  return (
    <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-white/[0.03] border border-white/10">
      {business ? <Store className="w-4 h-4 text-[#CDFF00] mt-0.5 shrink-0" /> : <UserIcon className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />}
      <div className="text-xs leading-relaxed text-gray-400">
        <p className="font-black text-white text-[11px] tracking-widest mb-0.5">{business ? 'BUSINESS SELLER' : 'PRIVATE SELLER'}</p>
        {business && <p className="text-gray-300">{[t.businessName, t.registrationNo && `Reg. ${t.registrationNo}`, t.vatNumber && `VAT ${t.vatNumber}`, t.address, t.contactEmail].filter(Boolean).join(' · ')}</p>}
        <p>{t.consumerRights}</p>
      </div>
    </div>
  );
}

/** Seller response (before a decision) and one appeal per side (after it) on a protection claim. */
export function ClaimActions({ claim: initial }) {
  const userId = useSelector(selectUser)?.id;
  const [claim, setClaim] = useState(initial);
  const [mode, setMode] = useState(null); // 'respond' | 'appeal'
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { setClaim(initial); }, [initial]);
  if (!claim || !userId) return null;

  const isSeller = claim.sellerId === userId;
  const decided = ['REFUNDED', 'PARTIALLY_REFUNDED', 'REJECTED'].includes(claim.status);
  const appealOpen = decided && !claim.appealedAt && claim.resolvedAt
    && Date.now() - new Date(claim.resolvedAt).getTime() < 7 * 86400000;
  const canRespond = isSeller && claim.status === 'OPEN' && !claim.sellerResponse;

  const submit = async () => {
    setBusy(true);
    try {
      const { data } = mode === 'respond' ? await claimsApi.respond(claim.id, text.trim()) : await claimsApi.appeal(claim.id, text.trim());
      setClaim(data); setMode(null); setText('');
      dispatchToast(mode === 'respond' ? 'Response sent — our team now has both sides' : 'Appeal sent — a different team member will review it', 'success');
    } catch (e) { dispatchToast(errorText(e, 'Could not send'), 'error'); }
    finally { setBusy(false); }
  };

  return (
    <div className="mt-3 space-y-2">
      {canRespond && claim.respondBy && (
        <p className="text-xs text-amber-300">A buyer reported a problem. Respond by {new Date(claim.respondBy).toLocaleDateString()} — after that we decide on the buyer's evidence.</p>
      )}
      {claim.sellerResponse && <p className="text-xs text-gray-400"><span className="font-bold text-gray-300">Seller's response:</span> {claim.sellerResponse}</p>}
      {claim.status === 'APPEALED' && <p className="text-xs text-amber-300">Appeal under review by a different team member.</p>}
      {claim.appealNote && <p className="text-xs text-gray-400"><span className="font-bold text-gray-300">Appeal decision (final):</span> {claim.appealNote}</p>}
      {!mode && (canRespond || appealOpen) && (
        <button onClick={() => setMode(canRespond ? 'respond' : 'appeal')}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-[10px] font-black tracking-widest text-gray-200 hover:border-[#CDFF00]/40">
          <Gavel className="w-3.5 h-3.5" /> {canRespond ? 'RESPOND TO CLAIM' : 'APPEAL DECISION'}
        </button>
      )}
      {mode && (
        <div className="space-y-2">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={2000}
            placeholder={mode === 'respond' ? 'What you sent and when, the tracking number, and anything you agreed with the buyer.' : 'What the decision got wrong, with any new information.'}
            className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#CDFF00]/50" />
          <div className="flex gap-2">
            <button disabled={busy || text.trim().length < 10} onClick={submit} className="px-4 py-2 rounded-lg bg-[#CDFF00] text-black text-xs font-black disabled:opacity-40">{busy ? 'Sending…' : 'Send'}</button>
            <button onClick={() => setMode(null)} className="px-4 py-2 rounded-lg bg-white/5 text-gray-300 text-xs font-black">Cancel</button>
          </div>
          {mode === 'appeal' && <p className="text-[11px] text-gray-500">You can appeal once. The appeal decision is final within HustleSpace.</p>}
        </div>
      )}
    </div>
  );
}

/** Shown on chat messages that try to move payment or contact off HustleSpace. */
export function SafetyNotice({ flag, isMe }) {
  if (!flag) return null;
  const payment = flag === 'OFF_PLATFORM_PAYMENT';
  return (
    <div className={`flex items-start gap-2 mt-1.5 px-3 py-2 rounded-xl text-[11.5px] leading-snug bg-amber-400/10 border border-amber-400/25 text-amber-200 ${isMe ? 'ml-auto' : ''} max-w-[85%]`}>
      <ShieldAlert className="w-3.5 h-3.5 mt-0.5 shrink-0" />
      <span>
        {isMe
          ? 'Keep payment in HustleSpace — deals paid outside the app have no buyer protection, and asking for it can restrict your account.'
          : payment
            ? 'Careful: paying outside HustleSpace (BLIK, bank transfer, PayPal, crypto) has no buyer protection and is how most scams work. Pay only through checkout.'
            : 'Careful: moving the chat elsewhere removes HustleSpace protection. Never pay or share codes outside the app.'}
      </span>
    </div>
  );
}

const FIELD = 'w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#CDFF00]/50';

/** Private/business status and legal details: DSA trader traceability and DAC7 tax reporting. */
export function SellerDetailsForm() {
  const [p, setP] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { trustApi.sellerProfile().then((r) => setP(r.data || {})).catch(() => setP({})); }, []);
  if (!p) return <div className="h-24 rounded-2xl bg-white/[0.03] animate-pulse" />;
  const business = p.sellerType === 'BUSINESS';
  const set = (k) => (e) => setP({ ...p, [k]: e.target.value });
  const save = async () => {
    setBusy(true);
    try {
      const body = { ...p };
      ['traderDetailsComplete', 'taxDetailsComplete', 'strikes', 'strikeLimit', 'salesThisYear', 'grossThisYear', 'taxReportingRequired'].forEach((k) => delete body[k]);
      const { data } = await trustApi.saveSellerProfile(body);
      setP(data); dispatchToast('Seller details saved', 'success');
    } catch (e) { dispatchToast(errorText(e, 'Could not save'), 'error'); }
    finally { setBusy(false); }
  };
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {[['PRIVATE', 'Private person', 'Selling your own things occasionally'], ['BUSINESS', 'Business', 'Registered company or sole trader']].map(([v, l, d]) => (
          <button key={v} onClick={() => setP({ ...p, sellerType: v })}
            className={`text-left p-3 rounded-xl border ${p.sellerType === v ? 'border-[#CDFF00]/50 bg-[#CDFF00]/5' : 'border-white/10 hover:border-white/20'}`}>
            <p className="text-sm font-bold text-white">{l}</p><p className="text-xs text-gray-500">{d}</p>
          </button>
        ))}
      </div>
      {business && <p className="text-xs text-amber-300">Business sellers must give these details before listing; buyers see your business name, registration, address and contact email.</p>}
      <div className="grid sm:grid-cols-2 gap-2">
        <input className={FIELD} placeholder="Full legal name" value={p.legalName || ''} onChange={set('legalName')} />
        {business && <input className={FIELD} placeholder="Business name" value={p.businessName || ''} onChange={set('businessName')} />}
        {business && <input className={FIELD} placeholder="KRS / CEIDG number" value={p.registrationNo || ''} onChange={set('registrationNo')} />}
        <input className={FIELD} placeholder={business ? 'NIP' : 'PESEL or tax ID'} value={p.taxId || ''} onChange={set('taxId')} />
        {business && <input className={FIELD} placeholder="VAT number (optional)" value={p.vatNumber || ''} onChange={set('vatNumber')} />}
        {!business && <input className={FIELD} type="date" aria-label="Date of birth" value={p.dateOfBirth || ''} onChange={set('dateOfBirth')} />}
        <input className={FIELD} placeholder="Street address" value={p.addressLine1 || ''} onChange={set('addressLine1')} />
        <input className={FIELD} placeholder="City" value={p.city || ''} onChange={set('city')} />
        <input className={FIELD} placeholder="Postal code" value={p.postalCode || ''} onChange={set('postalCode')} />
        <input className={FIELD} placeholder="Country code (PL)" maxLength={2} value={p.country || ''} onChange={set('country')} />
        {business && <input className={FIELD} placeholder="Contact email for buyers" value={p.contactEmail || ''} onChange={set('contactEmail')} />}
      </div>
      <p className="text-xs text-gray-500 leading-relaxed">
        This year: {p.salesThisYear || 0} completed sales. {p.taxReportingRequired
          ? 'You are above the DAC7 threshold — we must report your name, tax ID, date of birth, address and earnings to the tax office (KAS). Please complete these details.'
          : 'If you reach 30 sales or about €2,000 in a year, the law requires us to report your details and earnings to the tax office (DAC7).'}
        {' '}Strikes: {p.strikes || 0} of {p.strikeLimit || 3}.
      </p>
      <button disabled={busy} onClick={save} className="px-5 py-2.5 rounded-xl bg-[#CDFF00] text-black text-sm font-black disabled:opacity-50">{busy ? 'Saving…' : 'Save seller details'}</button>
    </div>
  );
}
