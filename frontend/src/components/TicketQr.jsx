import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { ShieldAlert } from 'lucide-react';

/**
 * Renders a ticket's QR code as an inline SVG.
 *
 * SVG rather than a canvas or a PNG data URL because a ticket gets scanned off a phone screen
 * at whatever brightness and angle the door has: vector output stays sharp at any size and
 * survives the browser zoom people apply when a scanner won't read it.
 *
 * Encoding is done in an effect rather than during render because `qrcode`'s API is async.
 * The generated markup is inserted with `dangerouslySetInnerHTML`, which is safe here — the
 * string comes from the QR library, not from user input, and the payload it encodes never
 * reaches the DOM as markup.
 *
 * Error-correction level M is the deliberate default: it tolerates a scratched screen or a
 * thumb over one corner while keeping the module count low enough that the code stays chunky
 * and easy to scan on a small phone.
 *
 * @param {string} value  the payload to encode (`HUTKT:<code>:<secret>`)
 * @param {number} size   rendered width/height in px
 * @param {boolean} dimmed  render at low contrast, for tickets that are used or cancelled
 */
export default function TicketQr({ value, size = 220, dimmed = false }) {
  const [svg, setSvg] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!value) { setSvg(''); setError(true); return; }

    let cancelled = false;
    setError(false);

    QRCode.toString(value, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 1,
      width: size,
      // Dark modules on a white plate. Scanners cope far better with a light background than
      // with an inverted code, so the QR keeps its white quiet zone even on this dark UI.
      color: { dark: '#000000', light: '#ffffff' },
    })
      .then((markup) => { if (!cancelled) setSvg(markup); })
      // Losing the QR shouldn't blank the ticket — the printed admission code below it is a
      // complete fallback, so this degrades to a message telling the holder to use it.
      .catch(() => { if (!cancelled) setError(true); });

    return () => { cancelled = true; };
  }, [value, size]);

  if (error) {
    return (
      <div
        style={{ width: size, height: size }}
        className="rounded-2xl bg-white/5 border border-white/10 flex flex-col items-center justify-center gap-2 px-4 text-center"
      >
        <ShieldAlert className="w-6 h-6 text-gray-500" />
        <p className="text-[10px] font-bold text-gray-500 leading-snug">
          Couldn't draw the QR code — read out the ticket code below instead.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{ width: size, height: size }}
      // [&>svg] sizes the library's SVG to fill the plate regardless of the width it emitted.
      className={`rounded-2xl bg-white p-3 transition-opacity [&>svg]:w-full [&>svg]:h-full [&>svg]:block ${
        dimmed ? 'opacity-30' : 'opacity-100'
      }`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
