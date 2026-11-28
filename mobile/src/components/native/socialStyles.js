import { useMemo } from 'react';
import { usePalette } from '../../theme/ThemeProvider';

/** Shared migration for legacy style sheets. Media scrims and dark text on lime stay intact. */
export function useSocialStyles(base) {
  const palette = usePalette();
  return useMemo(() => Object.fromEntries(Object.entries(base).map(([name, original]) => {
    const style = { ...original };
    const media = /overlay|mediaBadge|video|play|mute|viewer|scrim/i.test(name);
    if (typeof style.fontSize === 'number') {
      style.fontSize = Math.max(14, style.fontSize);
      style.lineHeight = Math.max(style.lineHeight || 0, Math.ceil(style.fontSize * 1.45));
    }
    if (palette.light && !media) {
      for (const [key, value] of Object.entries(style)) {
        if (typeof value !== 'string') continue;
        const normalized = value.replace(/\s/g, '').toLowerCase();
        if (key === 'color') {
          if (/^#(?:fff(?:fff)?|f[0-9a-f]{5}|dad[d0-9a-f]{3}|d6d6d6)$/.test(normalized)) style[key] = palette.text;
          else if (/^rgba\(255,255,255,/.test(normalized) || /^#(?:[3-9a-d]{3}|[3-9a-d]{6})$/.test(normalized)) style[key] = palette.muted;
          else if (normalized === '#cdff00') style[key] = palette.accent;
          if (/error/i.test(name)) style[key] = palette.danger;
        }
        if (key === 'backgroundColor') {
          if (/^#(?:0[0-9a-f]|1[0-9a-f]|2[0-9a-f]){3}$/.test(normalized) || ['#000', '#111', '#222', 'rgba(0,0,0,0.66)', 'rgba(17,19,16,0.86)'].includes(normalized)) style[key] = palette.card;
          if (/^rgba\(255,255,255,/.test(normalized)) style[key] = palette.soft;
        }
        if (/border.*color/i.test(key) && /^rgba\(255,255,255,/.test(normalized)) style[key] = palette.line;
      }
      if (/screen|container/i.test(name) && original.backgroundColor && /^#0/i.test(original.backgroundColor)) style.backgroundColor = palette.bg;
      if (name === 'dimmer') style.backgroundColor = 'transparent';
    }
    return [name, style];
  })), [base, palette]);
}
