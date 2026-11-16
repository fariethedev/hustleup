import { usePalette } from './Kit';

// Adapt the legacy social components while keeping their existing media/composer behaviour.
export function useSocialStyles(base) {
  const palette = usePalette();
  if (!palette.light) return base;
  return Object.fromEntries(Object.entries(base).map(([name, style]) => [name, Object.fromEntries(Object.entries(style).map(([key, value]) => {
    if (typeof value !== 'string') return [key, value];
    // Text over photos and videos needs to retain its dark-media contrast.
    if (/overlay|mediaBadge|video|play|mute/i.test(name)) return [key, value];
    if (key === 'color') {
      if (/^#fff(?:fff)?$/i.test(value)) value = palette.text;
      else if (value.startsWith('rgba(255,255,255,')) value = value.replace('255,255,255', '14,14,16');
      else if (value === '#CDFF00') value = palette.accent;
    }
    if (key === 'backgroundColor' && ['#050505', '#0d0d0d', '#111111', '#1C1C1C'].includes(value)) value = palette.card;
    if ((key.toLowerCase().includes('border') || key === 'backgroundColor') && value.startsWith('rgba(255,255,255,')) value = value.replace('255,255,255', '14,14,16');
    return [key, value];
  }))]));
}
