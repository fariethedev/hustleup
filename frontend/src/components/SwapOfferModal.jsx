import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { X, Repeat, Package, Sparkles, Loader2, ArrowUp, ArrowDown, Coins } from 'lucide-react';
import { listingsApi, swapsApi, dispatchToast } from '../api/client';
import { lockBodyScroll } from '../utils/lockBodyScroll';
import { formatPrice } from '../utils/constants';
import { uploadUrl } from '../config';

/**
 * Propose a barter trade against someone else's listing.
 *
 * Two ways to offer, matching the backend's "exactly one of" contract:
 *   • pick one of your own active listings, or
 *   • describe what you're offering ("2hrs of calc tutoring")
 *
 * The mode toggle is the whole point of Swap Mode — students trade skills they'd never
 * bother creating a listing for, so the free-text path has to be a first-class option
 * rather than an afterthought.
 *
 * On top of either, an optional cash top-up in whichever direction the trade needs. Pure
 * barter only clears when both people value their items equally; an iPhone 12 for an
 * iPhone 15 never does, and without somewhere to put "…plus 800 zł" that trade had no way
 * to be made except as prose in the note, where nothing could act on it.
 */
export default function SwapOfferModal({ listing, onClose, onSuccess }) {
  const [mode, setMode] = useState('listing'); // 'listing' | 'text'
  const [myListings, setMyListings] = useState([]);
  const [loadingMine, setLoadingMine] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [offeredText, setOfferedText] = useState('');
  const [message, setMessage] = useState('');
  // Cash top-up. Direction defaults to "I add", the overwhelmingly common case — someone
  // trading up. Nothing is sent unless an amount is actually typed.
  const [cashAmount, setCashAmount] = useState('');
  const [cashDirection, setCashDirection] = useState('PROPOSER_PAYS');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => lockBodyScroll(), []);

  useEffect(() => {
    listingsApi.my()
      .then((r) => {
        // Only ACTIVE listings can be traded — the backend rejects anything else, so
        // filtering here keeps the user from picking an option that would 400.
        const active = (r.data || []).filter((l) => l.status === 'ACTIVE' && l.id !== listing.id);
        setMyListings(active);
        // If you have nothing listed, the text offer is the only thing that can work —
        // start there rather than showing an empty picker.
        if (active.length === 0) setMode('text');
      })
      .catch(() => setMyListings([]))
      .finally(() => setLoadingMine(false));
  }, [listing.id]);

  const canSubmit = useMemo(() => {
    if (submitting) return false;
    return mode === 'listing' ? Boolean(selectedId) : offeredText.trim().length >= 3;
  }, [mode, selectedId, offeredText, submitting]);

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const topUp = Number(cashAmount);
      const payload = {
        targetListingId: listing.id,
        message: message.trim() || undefined,
        // Only sent when there is actually money in the deal. The server rejects an amount
        // with no direction, so the two always travel together or not at all.
        ...(topUp > 0 ? { cashAmount: topUp, cashDirection } : {}),
        ...(mode === 'listing'
          ? { offeredListingId: selectedId }
          : { offeredText: offeredText.trim() }),
      };
      const res = await swapsApi.create(payload);
      dispatchToast('Swap offer sent', 'success');
      onSuccess?.(res.data);
      onClose();
    } catch (e) {
      dispatchToast(e.response?.data?.message || 'Could not send that swap offer', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[1000] bg-black/90 backdrop-blur-xl flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 40, scale: 0.98 }} animate={{ y: 0, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full sm:max-w-lg max-h-[92vh] overflow-y-auto scrollbar-hide bg-[#0A0A0A] border border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 bg-[#0A0A0A]/95 backdrop-blur-xl border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#FF00FF] to-[#00FFFF] flex items-center justify-center">
              <Repeat className="w-4 h-4 text-black" strokeWidth={3} />
            </div>
            <div>
              <h2 className="text-sm font-black text-white tracking-tight leading-none">Propose a swap</h2>
              <p className="text-[10px] text-gray-500 font-bold mt-1">Trade, and top up if it needs it.</p>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* What you want */}
          <div>
            <p className="text-[10px] font-black tracking-[0.2em] text-gray-500 mb-2">You want</p>
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.04] border border-white/10">
              <div className="w-14 h-14 rounded-xl overflow-hidden bg-white/5 shrink-0">
                {listing.mediaUrls?.[0]
                  ? <img src={uploadUrl(listing.mediaUrls[0])} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center"><Package className="w-5 h-5 text-gray-600" /></div>}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-white truncate">{listing.title}</p>
                <p className="text-xs text-[#CDFF00] font-black">{formatPrice(listing.price, listing.currency)}</p>
              </div>
            </div>
          </div>

          {/* Mode toggle */}
          <div>
            <p className="text-[10px] font-black tracking-[0.2em] text-gray-500 mb-2">You give</p>
            <div className="flex gap-1 p-1 rounded-xl bg-white/5 border border-white/10 mb-3">
              <button
                onClick={() => setMode('listing')}
                disabled={myListings.length === 0}
                className={`flex-1 py-2 rounded-lg text-[10px] font-black tracking-widest transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                  mode === 'listing' ? 'bg-[#CDFF00] text-black' : 'text-gray-400 hover:text-white'
                }`}
              >
                One of my listings
              </button>
              <button
                onClick={() => setMode('text')}
                className={`flex-1 py-2 rounded-lg text-[10px] font-black tracking-widest transition-all ${
                  mode === 'text' ? 'bg-[#CDFF00] text-black' : 'text-gray-400 hover:text-white'
                }`}
              >
                A skill or favour
              </button>
            </div>

            {mode === 'listing' ? (
              loadingMine ? (
                <div className="py-8 flex justify-center">
                  <Loader2 className="w-5 h-5 text-gray-600 animate-spin" />
                </div>
              ) : myListings.length === 0 ? (
                <p className="text-xs text-gray-500 py-4 text-center">
                  You have no active listings to trade — describe what you're offering instead.
                </p>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto scrollbar-hide">
                  {myListings.map((l) => (
                    <button
                      key={l.id}
                      onClick={() => setSelectedId(l.id)}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all ${
                        selectedId === l.id
                          ? 'bg-[#CDFF00]/10 border-[#CDFF00]/50'
                          : 'bg-white/[0.03] border-white/10 hover:border-white/25'
                      }`}
                    >
                      <div className="w-11 h-11 rounded-lg overflow-hidden bg-white/5 shrink-0">
                        {l.mediaUrls?.[0]
                          ? <img src={uploadUrl(l.mediaUrls[0])} alt="" className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center"><Package className="w-4 h-4 text-gray-600" /></div>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-white truncate">{l.title}</p>
                        <p className="text-[10px] text-gray-500 font-bold">{formatPrice(l.price, l.currency)}</p>
                      </div>
                      {selectedId === l.id && <Sparkles className="w-4 h-4 text-[#CDFF00] shrink-0" />}
                    </button>
                  ))}
                </div>
              )
            ) : (
              <input
                value={offeredText}
                onChange={(e) => setOfferedText(e.target.value)}
                maxLength={280}
                placeholder="e.g. 2hrs of calculus tutoring"
                className="w-full bg-white/5 border border-white/10 focus:border-[#CDFF00]/50 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 outline-none transition-colors"
              />
            )}
          </div>

          {/* Cash top-up. Sits between the two items because that is where it belongs in the
              sentence: my thing, plus this much, for your thing. */}
          <div>
            <p className="text-[10px] font-black tracking-[0.2em] text-gray-500 mb-2">
              Cash on top <span className="text-gray-700">(optional)</span>
            </p>

            <div className="flex gap-1 p-1 rounded-xl bg-white/5 border border-white/10 mb-2">
              {[
                { key: 'PROPOSER_PAYS', label: 'I add money', icon: ArrowUp },
                { key: 'OWNER_PAYS', label: 'They add money', icon: ArrowDown },
              ].map((d) => {
                const DirIcon = d.icon;
                const active = cashDirection === d.key;
                return (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => setCashDirection(d.key)}
                    className={`flex-1 py-2 rounded-lg text-[10px] font-black tracking-widest transition-all flex items-center justify-center gap-1.5 ${
                      active ? 'bg-[#CDFF00] text-black' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <DirIcon className="w-3 h-3" strokeWidth={3} /> {d.label}
                  </button>
                );
              })}
            </div>

            <div className="relative">
              <Coins className="w-4 h-4 text-gray-600 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="number"
                min="0"
                step="1"
                inputMode="decimal"
                value={cashAmount}
                onChange={(e) => setCashAmount(e.target.value)}
                placeholder="0"
                className="w-full bg-white/5 border border-white/10 focus:border-[#CDFF00]/50 rounded-xl pl-11 pr-16 py-3 text-sm text-white placeholder-gray-600 outline-none transition-colors"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black tracking-widest text-gray-500 pointer-events-none">
                {listing.currency || 'PLN'}
              </span>
            </div>

            {/* Says the deal back to them in one line, so there is no ambiguity about which
                way the money goes before they send it. */}
            {Number(cashAmount) > 0 && (
              <p className="mt-2 text-[11px] text-gray-400 leading-relaxed">
                {cashDirection === 'PROPOSER_PAYS'
                  ? <>You give what you picked <span className="text-[#CDFF00] font-bold">plus {formatPrice(Number(cashAmount), listing.currency)}</span>, and get {listing.title}.</>
                  : <>You give what you picked and get {listing.title} <span className="text-[#CDFF00] font-bold">plus {formatPrice(Number(cashAmount), listing.currency)}</span> back.</>}
                {' '}You settle the money between yourselves, the same as the handover.
              </p>
            )}
          </div>

          {/* Optional note */}
          <div>
            <p className="text-[10px] font-black tracking-[0.2em] text-gray-500 mb-2">Note <span className="text-gray-700">(optional)</span></p>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={2}
              placeholder="Why this is a fair trade…"
              className="w-full bg-white/5 border border-white/10 focus:border-[#CDFF00]/50 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 outline-none resize-none transition-colors"
            />
          </div>

          <button
            onClick={submit}
            disabled={!canSubmit}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#FF00FF] to-[#00FFFF] text-black font-black text-xs tracking-[0.2em] flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 active:scale-95 transition-all"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Repeat className="w-4 h-4" strokeWidth={3} />}
            Send swap offer
          </button>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
}
