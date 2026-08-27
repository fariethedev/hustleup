/**
 * Where the backend lives.
 *
 * In local development this is empty, and every request goes out as a same-origin
 * relative path that vite.config.js proxies to localhost:8000. That proxy is a
 * dev-server feature and does not exist in a production build, so a deployed frontend
 * has to address the backend absolutely.
 *
 * Set VITE_API_URL in the Vercel project to the gateway's origin — scheme and host
 * only, no trailing slash and no /api path:
 *
 *   VITE_API_URL=https://hustleup-gateway-production.up.railway.app
 */
export const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

// A production build without VITE_API_URL silently addresses its own origin, where nothing
// serves /api — every call 404s and the app looks broken for no visible reason. Say so.
if (!API_BASE && typeof window !== 'undefined' &&
    !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname)) {
  console.error(
    `[config] VITE_API_URL is not set in this build — every API call will 404 against ` +
    `${window.location.origin}. Set it to the gateway origin and redeploy.`
  );
}

/** Prefix for REST calls. Falls back to a relative path so local dev is unchanged. */
export const API_URL = `${API_BASE}/api/v1`;

/**
 * STOMP/SockJS endpoint.
 *
 * The scheme has to track the page's: a ws:// socket opened from an https:// page is
 * blocked by the browser as mixed content, so hardcoding ws:// breaks in production
 * even when the host is right.
 */
export const WS_URL = API_BASE
  ? `${API_BASE.replace(/^http/, 'ws')}/ws`
  : `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`;

/**
 * Absolute URL for a server-relative upload path (e.g. "/uploads/abc.jpg").
 *
 * Anything already carrying a scheme is returned untouched. That deliberately includes
 * `blob:` and `data:`, which is what an optimistic local preview looks like before the file
 * has finished uploading — prefixing one of those with the API origin produces a URL that
 * resolves to nothing, so the user's own photo would vanish the moment they attached it.
 * Protocol-relative `//host/...` is passed through for the same reason.
 */
export const uploadUrl = (path) =>
  !path || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(path) ? path : `${API_BASE}${path}`;
