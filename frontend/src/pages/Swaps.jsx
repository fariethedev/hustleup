import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Repeat, ArrowRight, Check, X, Undo2, Package, PackageCheck, Camera, Loader2, Inbox, Coins } from 'lucide-react';
import { swapsApi, dispatchToast } from '../api/client';
import { formatPrice } from '../utils/constants';
import { uploadUrl } from '../config';
import { cashPhrase, cashGap, hasCash } from '../utils/swap';

const STATUS_STYLES = {
  PENDING:   'bg-[#CDFF00]/15 text-[#CDFF00] border-[#CDFF00]/30',
  ACCEPTED:  'bg-green-500/15 text-green-400 border-green-500/30',
  DECLINED:  'bg-red-500/15 text-red-400 border-red-500/30',
  WITHDRAWN: 'bg-white/10 text-gray-400 border-white/15',
};

/**
 * The money leg of a trade, phrased for whoever is reading it.
 *
 * Rendered between the two items rather than tucked under them, because it is part of the
 * offer — "this for that, plus 800" is one sentence, and burying the plus makes the trade
 * look like something it isn't. Money leaving is coloured differently from money arriving:
 * they are opposite facts and should never be skim-read as the same one.
 */
function CashStrip({ offer, viewerIsProposer }) {
  const phrase = cashPhrase(offer, viewerIsProposer);
  if (!phrase) return null;
  const gap = cashGap(offer);

  return (
    <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-widest ${
      phrase.viewerPays
        ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
        : 'bg-green-500/10 border-green-500/30 text-green-300'
    }`}>
      <Coins className="w-3 h-3 shrink-0" />
      <span className="truncate">{phrase.text}</span>
      {/* Only shown when both sides are priced listings in one currency — otherwise there
          is no gap to be right or wrong about. */}
      {gap?.settled && (
        <span className="ml-auto text-gray-500 normal-case font-bold shrink-0">evens out</span>
      )}
    </div>
  );
}

/** One half of a trade. `side.listingId` is null for free-text (skill/favour) offers. */
function SideCard({ side, label }) {
  return (
    <div className="flex-1 min-w-0">
      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-600 mb-1.5">{label}</p>
      <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/[0.04] border border-white/10">
        <div className="w-11 h-11 rounded-lg overflow-hidden bg-white/5 shrink-0">
          {side?.imageUrl
            ? <img src={uploadUrl(side.imageUrl)} alt="" className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center"><Package className="w-4 h-4 text-gray-600" /></div>}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold text-white truncate">{side?.title || '—'}</p>
          {side?.price != null
            ? <p className="text-[10px] text-[#CDFF00] font-black">{formatPrice(side.price, side.currency)}</p>
            : <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wide">Skill / favour</p>}
        </div>
      </div>
    </div>
  );
}

/**
 * The handover, after a swap is agreed.
 *
 * A swap puts two parcels in flight at once, so there is no single "delivered" moment to
 * show — each side confirms the item it received, and the trade is only done when both
 * have. That is why this reads as two rows rather than one status: the viewer's own
 * confirmation, which is an action, and the other person's, which is news.
 *
 * The photo is required by the server, so the button opens the file picker directly rather
 * than offering a confirm that would then be refused for having no evidence attached.
 */
function HandoverPanel({ offer, viewerIsProposer, onDone }) {
  const [busy, setBusy] = useState(false);
  const inputId = `swap-proof-${offer.id}`;

  const mine = viewerIsProposer
    ? { at: offer.proposerReceivedAt, proof: offer.proposerProofUrl }
    : { at: offer.ownerReceivedAt, proof: offer.ownerProofUrl };
  const theirs = viewerIsProposer
    ? { at: offer.ownerReceivedAt, proof: offer.ownerProofUrl }
    : { at: offer.proposerReceivedAt, proof: offer.proposerProofUrl };

  const upload = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      await swapsApi.confirmReceipt(offer.id, file);
      dispatchToast('Receipt confirmed', 'success');
      await onDone();
    } catch (e) {
      dispatchToast(e.response?.data?.message || 'Could not confirm that', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3">
      <div className="flex items-center gap-1.5 mb-2.5">
        <PackageCheck className="w-3.5 h-3.5 text-[#CDFF00]" />
        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400">
          {offer.handoverComplete ? 'Trade complete' : 'Handover'}
        </span>
      </div>

      {/* Your side — an action until it's done, then the receipt itself. */}
      {mine.at ? (
        <div className="flex items-center gap-2 text-[11px] font-bold text-green-400">
          <Check className="w-3.5 h-3.5 shrink-0" />
          <span>You confirmed it arrived</span>
          {mine.proof && (
            <a href={uploadUrl(mine.proof)} target="_blank" rel="noreferrer" className="ml-auto text-gray-400 hover:text-white underline">
              Your proof
            </a>
          )}
        </div>
      ) : (
        <>
          <input
            id={inputId}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ''; }}
          />
          <label
            htmlFor={inputId}
            className={`w-full py-2.5 rounded-xl bg-[#CDFF00] text-black font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all ${busy ? 'opacity-50 pointer-events-none' : ''}`}
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
            {busy ? 'Uploading…' : 'Confirm received + add proof'}
          </label>
          <p className="mt-1.5 text-[10px] text-gray-500 leading-relaxed">
            A photo or video of what turned up. It is the only record either of you has if
            this goes wrong later.
          </p>
        </>
      )}

      {/* Their side — never an action, only ever news. */}
      <div className="mt-2.5 pt-2.5 border-t border-white/5 flex items-center gap-2 text-[11px]">
        {theirs.at ? (
          <>
            <Check className="w-3.5 h-3.5 text-green-400 shrink-0" />
            <span className="text-gray-300 font-bold">They confirmed theirs arrived</span>
            {theirs.proof && (
              <a href={uploadUrl(theirs.proof)} target="_blank" rel="noreferrer" className="ml-auto text-gray-400 hover:text-white underline">
                Their proof
              </a>
            )}
          </>
        ) : (
          <>
            <Loader2 className="w-3.5 h-3.5 text-gray-600 shrink-0" />
            <span className="text-gray-500">Waiting on them to confirm</span>
          </>
        )}
      </div>
    </div>
  );
}

export default function Swaps() {
  const [tab, setTab] = useState('incoming');
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [inc, out] = await Promise.all([swapsApi.incoming(), swapsApi.outgoing()]);
      setIncoming(inc.data || []);
      setOutgoing(out.data || []);
    } catch {
      setIncoming([]); setOutgoing([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Accepting flips both listings to SOLD_OUT and auto-declines competing offers on the
  // same item, so the whole board can shift — refetch rather than patching one row.
  const act = async (id, fn, successMsg) => {
    setBusyId(id);
    try {
      await fn(id);
      dispatchToast(successMsg, 'success');
      await load();
    } catch (e) {
      dispatchToast(e.response?.data?.message || 'That did not work', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const rows = tab === 'incoming' ? incoming : outgoing;

  return (
    <div className="min-h-screen text-white font-sans pb-24">
      <div className="max-w-3xl mx-auto px-4 pt-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#FF00FF] to-[#00FFFF] flex items-center justify-center">
            <Repeat className="w-5 h-5 text-black" strokeWidth={3} />
          </div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-tight leading-none">Swap &amp; Top</h1>
            <p className="text-[11px] text-gray-500 font-bold mt-1">Trade what you have — add cash if it needs it.</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl bg-white/5 border border-white/10 mb-5">
          {[
            { key: 'incoming', label: `Incoming${incoming.length ? ` (${incoming.length})` : ''}` },
            { key: 'outgoing', label: `Sent${outgoing.length ? ` (${outgoing.length})` : ''}` },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                tab === t.key ? 'bg-[#CDFF00] text-black' : 'text-gray-400 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-20 flex justify-center"><Loader2 className="w-6 h-6 text-gray-600 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <div className="py-20 text-center">
            <Inbox className="w-10 h-10 text-gray-700 mx-auto mb-3" />
            <p className="text-sm text-gray-500 font-bold">
              {tab === 'incoming' ? 'No swap offers yet' : "You haven't proposed any swaps"}
            </p>
            <Link to="/explore" className="inline-block mt-4 px-6 py-2.5 rounded-full bg-[#CDFF00] text-black text-[10px] font-black uppercase tracking-widest">
              Browse listings
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((s) => (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-2xl bg-white/[0.03] border border-white/10"
              >
                {/* Who + status */}
                <div className="flex items-center justify-between mb-3">
                  <Link
                    to={`/profile/${tab === 'incoming' ? s.proposerId : s.targetOwnerId}`}
                    className="flex items-center gap-2 min-w-0 group"
                  >
                    <div className="w-7 h-7 rounded-full overflow-hidden bg-white/10 shrink-0">
                      {(tab === 'incoming' ? s.proposerAvatarUrl : s.targetOwnerAvatarUrl)
                        ? <img src={tab === 'incoming' ? s.proposerAvatarUrl : s.targetOwnerAvatarUrl} alt="" className="w-full h-full object-cover" />
                        : null}
                    </div>
                    <p className="text-xs font-bold text-gray-300 truncate group-hover:text-white transition-colors">
                      {tab === 'incoming' ? s.proposerName : s.targetOwnerName}
                    </p>
                  </Link>
                  <span className={`px-2.5 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest ${STATUS_STYLES[s.status] || STATUS_STYLES.WITHDRAWN}`}>
                    {s.status}
                  </span>
                </div>

                {/* The trade. Direction is framed from the viewer's perspective: on an
                    incoming offer you receive what they "give", so the sides swap round. */}
                <div className="flex items-center gap-3">
                  <SideCard side={tab === 'incoming' ? s.gives : s.wants} label={tab === 'incoming' ? 'You get' : 'You want'} />
                  <ArrowRight className="w-4 h-4 text-gray-600 shrink-0" />
                  <SideCard side={tab === 'incoming' ? s.wants : s.gives} label={tab === 'incoming' ? 'You give' : 'You give'} />
                </div>

                {/* The money leg, if there is one. `incoming` tells us which side of this
                    trade the viewer is on, which is what decides whether it reads as
                    "You add" or "They add". */}
                {hasCash(s) && (
                  <div className="mt-2.5">
                    <CashStrip offer={s} viewerIsProposer={tab !== 'incoming'} />
                  </div>
                )}

                {s.message && (
                  <p className="mt-3 text-xs text-gray-400 leading-relaxed bg-white/[0.03] rounded-xl px-3 py-2 border border-white/5">
                    “{s.message}”
                  </p>
                )}

                {/* Agreed, so the items are now in the post. This is where the trade is
                    actually closed out — accepting was only the paperwork. */}
                {s.status === 'ACCEPTED' && (
                  <HandoverPanel offer={s} viewerIsProposer={tab !== 'incoming'} onDone={load} />
                )}

                {/* Actions — only meaningful while the offer is still open */}
                {s.status === 'PENDING' && (
                  <div className="flex gap-2 mt-3">
                    {tab === 'incoming' ? (
                      <>
                        <button
                          onClick={() => act(s.id, swapsApi.accept, 'Swap accepted')}
                          disabled={busyId === s.id}
                          className="flex-1 py-2.5 rounded-xl bg-[#CDFF00] text-black font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-1.5 disabled:opacity-50 active:scale-95 transition-all"
                        >
                          {busyId === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Accept
                        </button>
                        <button
                          onClick={() => act(s.id, swapsApi.decline, 'Swap declined')}
                          disabled={busyId === s.id}
                          className="flex-1 py-2.5 rounded-xl border border-white/15 text-gray-300 font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-1.5 hover:bg-white/5 disabled:opacity-50 transition-all"
                        >
                          <X className="w-3.5 h-3.5" /> Decline
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => act(s.id, swapsApi.withdraw, 'Offer withdrawn')}
                        disabled={busyId === s.id}
                        className="flex-1 py-2.5 rounded-xl border border-white/15 text-gray-300 font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-1.5 hover:bg-white/5 disabled:opacity-50 transition-all"
                      >
                        {busyId === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Undo2 className="w-3.5 h-3.5" />} Withdraw
                      </button>
                    )}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
