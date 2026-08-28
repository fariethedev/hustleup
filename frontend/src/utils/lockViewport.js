/**
 * Holds the mobile viewport still: no pinch-zoom, no double-tap zoom, no rubber-banding.
 *
 * The viewport meta tag in index.html carries `user-scalable=no, maximum-scale=1`, which is
 * the whole fix on Android. It is not on iOS: Safari has deliberately ignored both of those
 * since version 10, precisely so that pages cannot take zoom away from the user. Anything
 * that actually stops the gesture on an iPhone has to do it from script, which is what this
 * does.
 *
 * Three separate gestures zoom a page, and each needs its own answer:
 *
 *   - Pinch. WebKit raises non-standard `gesturestart`/`gesturechange`/`gestureend` events
 *     for a two-finger gesture; preventing them stops Safari scaling the page.
 *   - Pinch, again. Older iOS and some in-app WebViews never fire the gesture events at all,
 *     so a two-finger `touchmove` is cancelled as a fallback. The touch count is what makes
 *     this safe: one-finger scrolling never enters the branch, so ordinary scrolling, the
 *     carousels and the message list are untouched.
 *   - Double-tap. Not a gesture event and not a multi-touch move, so neither of the above
 *     catches it. `touch-action: manipulation` in index.css removes it declaratively; the
 *     timestamp check here covers WebViews that ignore that property.
 *
 * Listeners are registered non-passive. The default for touch events is passive, and a
 * passive listener's preventDefault() is ignored with a console warning — the code would
 * look right and do nothing.
 *
 * TRADE-OFF, deliberately made: this fails WCAG 1.4.4, which requires content to scale to
 * 200%. Anyone who needs to magnify the page cannot. The app-like feel was chosen over that.
 * Two things soften it: iOS Zoom (Settings › Accessibility) still magnifies the whole screen
 * and is unaffected by any of this, and the separate 16px rule in index.css means form fields
 * never needed zooming to read in the first place.
 *
 * @returns {() => void} teardown that removes every listener it added
 */
export function lockViewport() {
  if (typeof window === 'undefined') return () => {};

  const stop = (e) => e.preventDefault();

  // Pinch on iOS Safari.
  const gestureEvents = ['gesturestart', 'gesturechange', 'gestureend'];
  gestureEvents.forEach((type) => document.addEventListener(type, stop, { passive: false }));

  // Pinch fallback: cancel only genuine multi-touch, never a one-finger scroll.
  const onTouchMove = (e) => {
    if (e.touches.length > 1) e.preventDefault();
  };
  document.addEventListener('touchmove', onTouchMove, { passive: false });

  // Double-tap. 300ms is the window Safari itself uses to pair two taps into a zoom.
  let lastTouchEnd = 0;
  const onTouchEnd = (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) e.preventDefault();
    lastTouchEnd = now;
  };
  document.addEventListener('touchend', onTouchEnd, { passive: false });

  return () => {
    gestureEvents.forEach((type) => document.removeEventListener(type, stop));
    document.removeEventListener('touchmove', onTouchMove);
    document.removeEventListener('touchend', onTouchEnd);
  };
}
