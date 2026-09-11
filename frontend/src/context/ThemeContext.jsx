import { createContext, useContext, useEffect, useMemo, useState } from 'react';

/**
 * Light / dark / system, applied as `data-theme` on `<html>`.
 *
 * <h3>Why a data attribute and not a class</h3>
 * The stylesheet overrides in index.css key off `[data-theme="light"]`, and an attribute on
 * the root element is readable from CSS, from devtools and from a screenshot of the DOM —
 * which matters when a colour bug turns out to be "the theme never applied" rather than
 * anything to do with the colour.
 *
 * <h3>Why "system" is a stored value rather than the absence of one</h3>
 * Three states, not two. Someone who has never chosen follows their OS; someone who has
 * explicitly chosen dark keeps dark even when their laptop flips to light at sunset. Storing
 * "system" as its own value is what lets a user go back to following the OS after choosing —
 * with only light/dark there is no way to un-choose.
 */

const STORAGE_KEY = 'hustleup_theme';
const ThemeContext = createContext(null);

/** What the OS is asking for right now. */
function systemTheme() {
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function storedPreference() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system';
  } catch {
    // Private browsing, or storage blocked. Following the OS is the right fallback — it is
    // what the user's machine already says they want.
    return 'system';
  }
}

export function ThemeProvider({ children }) {
  const [preference, setPreference] = useState(storedPreference);
  const [resolved, setResolved] = useState(() =>
    (storedPreference() === 'system' ? systemTheme() : storedPreference()));

  // Apply, persist, and keep following the OS while the preference is "system".
  useEffect(() => {
    const apply = () => {
      const next = preference === 'system' ? systemTheme() : preference;
      setResolved(next);
      document.documentElement.setAttribute('data-theme', next);
      // Tells the browser which scrollbars, form controls and autofill colours to draw.
      // Without it a light page keeps dark native widgets and looks half-converted.
      document.documentElement.style.colorScheme = next;
    };
    apply();

    try {
      localStorage.setItem(STORAGE_KEY, preference);
    } catch {
      // Not fatal — the theme still applies for this session.
    }

    if (preference !== 'system' || !window.matchMedia) return undefined;
    const media = window.matchMedia('(prefers-color-scheme: light)');
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [preference]);

  const value = useMemo(() => ({
    /** 'light' | 'dark' | 'system' — what the user chose. */
    preference,
    /** 'light' | 'dark' — what is actually on screen. */
    resolved,
    setTheme: setPreference,
  }), [preference, resolved]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside a ThemeProvider');
  return ctx;
}
