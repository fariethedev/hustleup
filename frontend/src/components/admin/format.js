import { convertToPLN } from '../../utils/constants';

/**
 * Non-component helpers for the admin console.
 *
 * <p>Split out of shared.jsx rather than living beside the components that use them: a
 * module mixing components with plain exports breaks Fast Refresh, which then reloads the
 * whole console on every edit instead of the panel being worked on.
 */

/**
 * One number from a multi-currency total, for sorting and for chart heights.
 *
 * <p>Uses the frontend's indicative rates — the same ones behind the cart's currency
 * switcher. Fine for "which bar is taller", not fine for anything printed as a figure,
 * which is why `Money` exists and is what the console actually reports.
 */
export function plnEquivalent(totals) {
  return Object.entries(totals || {})
    .reduce((sum, [code, value]) => sum + convertToPLN(Number(value) || 0, code), 0);
}

/** True when a set of totals spans more than one currency, so the UI can say so. */
export function isMultiCurrency(...totals) {
  const codes = new Set();
  totals.forEach((t) => Object.entries(t || {}).forEach(([c, v]) => { if (Number(v) !== 0) codes.add(c); }));
  return codes.size > 1;
}

export const TONE = {
  open:    'text-amber-400 bg-amber-400/10 border-amber-400/20',
  good:    'text-[#CDFF00] bg-[#CDFF00]/10 border-[#CDFF00]/20',
  bad:     'text-red-400 bg-red-400/10 border-red-400/20',
  neutral: 'text-gray-400 bg-white/5 border-white/10',
};
