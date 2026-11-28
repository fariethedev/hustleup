/**
 * Service menus — a barber's cuts, a tutor's lesson lengths — on HAIR_BEAUTY / SKILL listings.
 *
 * Stored in the listing's `meta` JSON as {"services":[{"name","price","durationMins"}]}.
 * The server reads the same shape (ServiceMenu.java): it sets the listing's headline price to
 * the cheapest service and prices a booking from the service it names, never from the client.
 */

export const SERVICE_TYPES = ['HAIR_BEAUTY', 'SKILL'];

export const isServiceType = (type) => SERVICE_TYPES.includes(type);

const parseMeta = (meta) => {
  if (!meta) return {};
  if (typeof meta === 'object') return meta;
  try { return JSON.parse(meta) || {}; } catch { return {}; }
};

/** The listing's menu, cleaned: named rows with a usable price only. */
export function readServices(meta) {
  const list = parseMeta(meta).services;
  if (!Array.isArray(list)) return [];
  return list
    .map((s) => ({
      name: String(s?.name || '').trim(),
      price: Number(s?.price),
      durationMins: Number(s?.durationMins) > 0 ? Number(s.durationMins) : null,
    }))
    .filter((s) => s.name && Number.isFinite(s.price) && s.price >= 0);
}

/**
 * Writes the menu into meta, keeping any other keys already there. Editor rows with no name
 * are dropped, so a half-typed row never reaches the server.
 */
export function writeServices(meta, rows) {
  const base = parseMeta(meta);
  const services = completeRows(rows).map((r) => ({
    name: String(r.name).trim(),
    price: priceOf(r.price),
    ...(Number(r.durationMins) > 0 ? { durationMins: Math.round(Number(r.durationMins)) } : {}),
  }));
  const next = { ...base };
  if (services.length) next.services = services; else delete next.services;
  return Object.keys(next).length ? JSON.stringify(next) : '';
}

/** Rows ready for the editor: strings, so an empty input stays empty rather than 0. */
export const toEditorRows = (meta) =>
  readServices(meta).map((s) => ({ name: s.name, price: String(s.price), durationMins: s.durationMins ? String(s.durationMins) : '' }));

/** "45 min", "1 h", "1 h 30 min". */
export function formatDuration(mins) {
  if (!mins) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** A price the seller actually typed — Number('') is 0, and a blank is not "free". */
const priceOf = (value) => {
  if (value === '' || value == null) return NaN;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
};

/** Editor rows that are complete enough to save. */
export const completeRows = (rows) =>
  rows.filter((r) => String(r.name || '').trim() && !Number.isNaN(priceOf(r.price)));

/** Lowest price among complete rows, or null. */
export function lowestPrice(rows) {
  const prices = completeRows(rows).map((r) => priceOf(r.price));
  return prices.length ? Math.min(...prices) : null;
}
