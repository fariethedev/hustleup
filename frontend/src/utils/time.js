/**
 * Relative-time formatting for anything the API timestamps.
 *
 * <h3>Why this exists rather than `new Date(str)` at each call site</h3>
 * The backend serialises Java `LocalDateTime`, which produces strings like
 * `2026-08-26T12:04:37.400303` — **microsecond precision and no timezone**. Two problems
 * follow from that, and every hand-rolled `timeAgo` in the app hit both:
 *
 * 1. **Safari rejects it.** The `Date` constructor is only specified for millisecond
 *    precision (3 fractional digits). V8 tolerates six and parses fine; WebKit returns
 *    `Invalid Date`. The arithmetic then yields `NaN`, and the old helpers rendered that
 *    straight to the page as `NaNd` — which is exactly why post ages looked broken on
 *    iPhone but fine on desktop.
 * 2. **A future timestamp counted backwards.** With no offset, a server clock slightly
 *    ahead of the browser produces a negative difference. `Math.floor(-30000 / 60000)` is
 *    `-1`, so the old code fell through its `< 1` check and printed negative ages.
 *
 * Both are handled once, here.
 */

/**
 * Parses a server timestamp into a Date, or null if it cannot be understood.
 *
 * <p>Truncates sub-millisecond precision so WebKit accepts the string. A bare timestamp
 * with no offset is left to the platform, which reads it as local time — matching how the
 * server writes it, since `LocalDateTime.now()` records the server's own wall clock.
 *
 * @param {string|number|Date} value
 * @returns {Date|null}
 */
export function parseServerDate(value) {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') {
    const fromEpoch = new Date(value);
    return isNaN(fromEpoch.getTime()) ? null : fromEpoch;
  }

  // 2026-08-26T12:04:37.400303 -> 2026-08-26T12:04:37.400
  const normalised = String(value).trim().replace(/(\.\d{3})\d+/, '$1');
  const parsed = new Date(normalised);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Compact relative age: `now`, `5m`, `3h`, `2d`, `4w`, `7mo`, `2y`.
 *
 * <p>Goes past days deliberately. The previous helpers stopped at `d`, so a post from last
 * spring read as `287d` — technically true, useless to a reader.
 *
 * @param {string|number|Date} value a server timestamp
 * @returns {string} empty string when the value is missing or unparseable
 */
export function timeAgo(value) {
  const date = parseServerDate(value);
  if (!date) return '';

  // Clamp instead of showing a negative age: a server clock a few seconds ahead of the
  // browser is normal and should read as "now", not "-1m".
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));

  if (seconds < 60) return 'now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (days < 30) return `${weeks}w`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo`;
  return `${Math.floor(days / 365)}y`;
}

/**
 * Same as {@link timeAgo} but suffixed for use in a sentence — "5m ago", "just now".
 *
 * @param {string|number|Date} value
 * @returns {string}
 */
export function timeAgoLong(value) {
  const short = timeAgo(value);
  if (!short) return '';
  return short === 'now' ? 'just now' : `${short} ago`;
}

/**
 * Absolute clock time, for message rows and timestamps shown alongside a relative age.
 *
 * @param {string|number|Date} value
 * @returns {string} e.g. "14:32", or empty string if unparseable
 */
export function formatClock(value) {
  const date = parseServerDate(value);
  if (!date) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
