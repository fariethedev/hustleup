import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Store, ClipboardCheck, Building2, CalendarRange, Banknote, ChartLine, CircleCheck, Gem, MoveRight } from 'lucide-react';
import { subscriptionsApi, dispatchToast } from '../api/client';
import { formatPrice } from '../utils/constants';

/**
 * The upgrade path from a plain account to a selling one.
 *
 * <h3>What this replaced</h3>
 * Selling used to be refused with a screen that said buying and selling were separate
 * accounts, and offered to sign the user out so they could register again on a second email.
 * That stopped being true when the server moved selling behind a subscription — there is one
 * kind of account now, and `PremiumAccess.canSell` grants selling to any active subscriber.
 * So the old screen logged people out to solve a problem that no longer existed, and never
 * mentioned the subscription that would actually have unlocked it.
 *
 * <h3>Why the price is fetched rather than written here</h3>
 * `GET /subscriptions/plans` is the same enum Stripe is charged from, so a price shown here
 * cannot drift from the price taken at checkout. Hardcoding the amount would be correct only
 * until the day it wasn't, and the failure mode is advertising a price we then don't honour.
 * Until the list arrives the panel shows a spinner rather than naming a number.
 */

/** What subscribing actually turns on, matched to the endpoints `canSell` guards. */
const UNLOCKS = [
  { icon: ClipboardCheck, text: 'List items, services and events' },
  { icon: Building2, text: 'Open your own storefront' },
  { icon: CalendarRange, text: 'Take bookings on your own availability' },
  { icon: Banknote, text: 'Get paid out to your bank via Stripe' },
  { icon: ChartLine, text: 'Sales, revenue and your Hustle Score' },
];

/** The path itself, so this explains how selling works and not only what it costs. */
const STEPS = [
  'Subscribe to Premium',
  'Set up your shop — name, city, category',
  'Post your first listing',
];

/**
 * @param {object}   props
 * @param {string}   [props.title]       headline
 * @param {string}   [props.blurb]       one line under the headline, for page-specific context
 * @param {Function} [props.onCancel]    renders a secondary dismiss button when provided
 * @param {string}   [props.cancelLabel]
 */
export default function SellerUpgrade({
  title = 'Start selling on HustleSpace',
  blurb = 'Selling is a Premium feature. One subscription turns the account you already have into a shop — no second account, no new email address.',
  onCancel,
  cancelLabel = 'Not now',
}) {
  // null = not loaded yet, so the plan list shows a spinner instead of briefly rendering
  // an empty, un-buyable panel.
  const [plans, setPlans] = useState(null);
  const [currency, setCurrency] = useState('PLN');
  // The plan id currently being started, not a boolean — only the button that was pressed
  // should show a spinner.
  const [upgrading, setUpgrading] = useState(null);

  useEffect(() => {
    let cancelled = false;
    subscriptionsApi.plans()
      .then((r) => {
        if (cancelled) return;
        setPlans(r.data?.plans ?? []);
        if (r.data?.currency) setCurrency(r.data.currency);
      })
      .catch(() => { if (!cancelled) setPlans([]); });
    return () => { cancelled = true; };
  }, []);

  /**
   * Sends the seller to Stripe Checkout.
   *
   * Deliberately grants nothing locally: Premium is written by the signed webhook once the
   * charge clears, so flipping a flag here would open the seller tools to someone who closed
   * the payment page, and every endpoint would refuse them anyway.
   */
  const start = async (planId) => {
    setUpgrading(planId);
    try {
      const res = await subscriptionsApi.checkout(planId);
      const url = res.data?.checkoutUrl;
      if (!url) throw new Error('No checkout URL returned');
      window.location.assign(url);
      // Not reset on success: the browser is leaving, and clearing this would re-enable the
      // buttons mid-redirect and invite a second checkout session.
    } catch {
      dispatchToast('Could not start checkout — try again', 'error');
      setUpgrading(null);
    }
  };

  // The entry price is the headline, because it is the number that decides whether any of
  // the rest gets read. Cheapest-per-month is a different plan, flagged separately below.
  const entry = plans?.length
    ? plans.reduce((low, p) => (Number(p.price) < Number(low.price) ? p : low))
    : null;
  const bestValueId = plans && plans.length > 1
    ? plans.reduce((best, p) => (Number(p.pricePerMonth) < Number(best.pricePerMonth) ? p : best)).id
    : null;

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 max-w-md w-full">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-11 h-11 rounded-2xl bg-[#CDFF00] flex items-center justify-center shrink-0">
          <Store className="w-5 h-5 text-black" strokeWidth={2.5} />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-black text-white tracking-tight leading-tight">{title}</h2>
          <span className="inline-flex items-center gap-1 text-[9px] font-black tracking-[0.18em] text-[#CDFF00] mt-0.5">
            <Gem className="w-2.5 h-2.5" /> PREMIUM
          </span>
        </div>
      </div>

      <p className="text-sm text-gray-400 leading-relaxed mb-5">{blurb}</p>

      {/* The price gets its own weight — "from 9,99 PLN a month" is the whole pitch. */}
      <div className="rounded-2xl bg-[#CDFF00]/[0.07] border border-[#CDFF00]/25 p-4 mb-5">
        {entry ? (
          <>
            <p className="text-[9px] font-black tracking-[0.2em] text-[#CDFF00]/70 mb-1">STARTS AT</p>
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-3xl font-black text-[#CDFF00] leading-none">
                {formatPrice(Number(entry.price), currency)}
              </span>
              <span className="text-xs font-bold text-gray-400">
                / {entry.months === 1 ? 'month' : `${entry.months} months`}
              </span>
            </div>
          </>
        ) : (
          <div className="h-10 flex items-center">
            <span className="w-4 h-4 border-2 border-white/20 border-t-[#CDFF00] rounded-full animate-spin" />
          </div>
        )}
      </div>

      <p className="text-[9px] font-black tracking-[0.2em] text-gray-500 mb-2.5">WHAT IT UNLOCKS</p>
      <div className="space-y-2 mb-5">
        {UNLOCKS.map((u) => (
          <div key={u.text} className="flex items-start gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center shrink-0 mt-0.5">
              <u.icon className="w-3 h-3 text-[#CDFF00]" />
            </div>
            <span className="text-xs text-gray-300 leading-snug">{u.text}</span>
          </div>
        ))}
      </div>

      <p className="text-[9px] font-black tracking-[0.2em] text-gray-500 mb-2.5">HOW IT WORKS</p>
      <ol className="space-y-1.5 mb-5">
        {STEPS.map((s, i) => (
          <li key={s} className="flex items-center gap-2.5">
            <span className="w-5 h-5 rounded-full bg-white/10 text-white text-[10px] font-black flex items-center justify-center shrink-0">
              {i + 1}
            </span>
            <span className="text-xs text-gray-400">{s}</span>
          </li>
        ))}
      </ol>

      {/* Plans. Every button locks while one checkout is in flight — a second click would
          open a second Stripe session and risk charging twice. */}
      {!plans ? (
        <div className="py-6 flex justify-center">
          <span className="w-5 h-5 border-2 border-white/20 border-t-[#CDFF00] rounded-full animate-spin" />
        </div>
      ) : plans.length === 0 ? (
        <p className="text-xs text-gray-500 text-center py-3">
          Plans could not be loaded — refresh and try again.
        </p>
      ) : (
        <div className="space-y-2">
          {plans.map((p) => {
            const isEntry = p.id === entry?.id;
            const isBest = p.id === bestValueId;
            const busy = upgrading === p.id;
            return (
              <motion.button
                key={p.id}
                whileTap={{ scale: 0.99 }}
                onClick={() => start(p.id)}
                disabled={!!upgrading}
                className={`w-full py-3 px-3.5 rounded-xl font-bold text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-between gap-2 ${
                  isEntry
                    ? 'bg-[#CDFF00] text-black hover:bg-[#d9ff33]'
                    : 'bg-white/5 text-white border border-white/10 hover:bg-white/10'
                }`}
              >
                <span className="flex items-center gap-2">
                  {p.label}
                  {isBest && (
                    <span className={`text-[9px] font-extrabold tracking-wide px-1.5 py-0.5 rounded ${
                      isEntry ? 'bg-black/20' : 'bg-white/10'
                    }`}>
                      Best value
                    </span>
                  )}
                </span>
                {busy ? (
                  <span className={`w-4 h-4 border-2 rounded-full animate-spin ${
                    isEntry ? 'border-black/30 border-t-black' : 'border-white/30 border-t-white'
                  }`} />
                ) : (
                  <span className="text-right leading-tight">
                    <span className="block">{formatPrice(Number(p.price), currency)}</span>
                    {p.months > 1 && (
                      <span className={`block text-[9px] font-medium ${isEntry ? 'text-black/60' : 'text-gray-400'}`}>
                        {formatPrice(Number(p.pricePerMonth), currency)}/mo
                      </span>
                    )}
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>
      )}

      {/* Prepaid terms, not a rolling subscription — there is nothing to cancel, and saying
          "cancel anytime" would describe a plan that does not exist. */}
      <p className="flex items-center justify-center gap-1.5 text-[10px] text-gray-500 mt-3">
        <CircleCheck className="w-3 h-3" /> One-off payment. Access ends when the term does.
      </p>

      {onCancel && (
        <button
          onClick={onCancel}
          className="w-full mt-2.5 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-300 font-bold text-sm hover:bg-white/10 transition-colors"
        >
          {cancelLabel}
        </button>
      )}
    </div>
  );
}

/**
 * The compact form, for places that already have a layout of their own and need only the
 * call to action — a dashboard banner rather than a full page.
 */
export function SellerUpgradeButton({ onClick, label = 'Start selling' }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#CDFF00] text-black font-black text-[11px] tracking-widest hover:bg-[#d9ff33] active:scale-95 transition-all shrink-0"
    >
      <Store className="w-3.5 h-3.5" strokeWidth={2.5} /> {label} <MoveRight className="w-3.5 h-3.5" />
    </button>
  );
}
