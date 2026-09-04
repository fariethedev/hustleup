import { formatPrice } from './constants';

/**
 * Reading the cash leg of a swap from whoever is looking at it.
 *
 * The server sends `cashDirection` as the raw enum — PROPOSER_PAYS or OWNER_PAYS — rather
 * than a ready-made sentence, because the same offer is read by both people in it. "You add
 * 800 zł" is correct for one of them and exactly backwards for the other, so the phrasing
 * has to happen where the viewer is known. That is here.
 */

/** Whether an offer carries money at all. */
export function hasCash(offer) {
  return Number(offer?.cashAmount) > 0 && !!offer?.cashDirection;
}

/** The amount, formatted in the offer's own currency. */
export function cashLabel(offer) {
  if (!hasCash(offer)) return null;
  return formatPrice(Number(offer.cashAmount), offer.cashCurrency || 'PLN');
}

/**
 * Who is paying, phrased for the viewer.
 *
 * @param {object}  offer            the swap offer
 * @param {boolean} viewerIsProposer true when the person looking made the offer
 * @returns {{ text: string, viewerPays: boolean } | null}
 *   `text` reads "You add 800 PLN" / "They add 800 PLN"; `viewerPays` lets the caller
 *   colour it, since money leaving and money arriving should not look identical.
 */
export function cashPhrase(offer, viewerIsProposer) {
  if (!hasCash(offer)) return null;
  const viewerPays = offer.cashDirection === 'PROPOSER_PAYS' ? viewerIsProposer : !viewerIsProposer;
  return {
    text: `${viewerPays ? 'You add' : 'They add'} ${cashLabel(offer)}`,
    viewerPays,
  };
}

/**
 * How far apart the two sides are once the cash is counted.
 *
 * Both listings carry an indicative price, so a top-up can be checked against the actual
 * gap rather than guessed at. Returns null unless both sides are real listings with prices
 * — a skill-for-phone trade has no arithmetic to do, and inventing one would give a
 * confident number for something nobody priced.
 *
 * @returns {{ gap: number, currency: string, settled: boolean } | null}
 *   `gap` is what remains outstanding after the top-up, from the proposer's side: positive
 *   means the proposer is still short. `settled` is true when the top-up closes it to
 *   within a rounding-sized margin.
 */
export function cashGap(offer) {
  const wants = Number(offer?.wants?.price);
  const gives = Number(offer?.gives?.price);
  if (!Number.isFinite(wants) || !Number.isFinite(gives)) return null;
  // Only comparable when both sides are quoted in the same currency. Converting via the
  // indicative FX table would put a made-up number on someone's trade.
  if (offer.wants?.currency && offer.gives?.currency
      && offer.wants.currency !== offer.gives.currency) return null;

  const topUp = hasCash(offer)
    ? (offer.cashDirection === 'PROPOSER_PAYS' ? Number(offer.cashAmount) : -Number(offer.cashAmount))
    : 0;
  const gap = Math.round((wants - gives - topUp) * 100) / 100;
  return {
    gap,
    currency: offer.wants?.currency || 'PLN',
    // Within 1 unit of currency reads as square; demanding exactness would flag every
    // trade where someone rounded to a sensible number.
    settled: Math.abs(gap) <= 1,
  };
}
