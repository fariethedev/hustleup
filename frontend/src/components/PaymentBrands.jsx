/**
 * Payment brand marks as self-contained inline SVG.
 *
 * Why inline rather than <img> from a CDN: every one of these renders inside the checkout,
 * which must not depend on a third-party host being reachable (or on that host being able
 * to see which of our users is paying for what). Inline SVG also scales cleanly and picks
 * up currentColor where we want it to.
 *
 * ⚠️ These are hand-authored reproductions of each brand's mark, drawn to be recognisable
 * at checkout size. They are NOT the official artwork. Every one of these logos is a
 * registered trademark, and each brand publishes its own asset pack plus rules on clear
 * space, minimum size and permitted colourways:
 *
 *   Apple Pay   — developer.apple.com/apple-pay/marketing/
 *   PayPal      — paypal.com/us/webapps/mpp/logo-center
 *   Visa        — usa.visa.com/run-your-business/small-business-tools/payment-technology.html
 *   Mastercard  — brand.mastercard.com
 *   BLIK        — blik.com/do-pobrania
 *   Google Pay  — developers.google.com/pay/api/web/guides/brand-guidelines
 *
 * Before this goes anywhere near production, swap these for the official downloads — both
 * to respect the marks and because Apple in particular requires the supplied artwork for
 * any "Apple Pay" branding.
 */

/* Brand colours, kept in one place so the marks stay consistent wherever they're used. */
export const BRAND = {
  paypalDark: '#003087',
  paypalLight: '#009CDE',
  visa: '#1434CB',
  mcRed: '#EB001B',
  mcYellow: '#F79E1B',
  mcOverlap: '#FF5F00',
  blik: '#000000',
  googleBlue: '#4285F4',
  googleRed: '#EA4335',
  googleYellow: '#FBBC04',
  googleGreen: '#34A853',
};

/** Apple's apple glyph. `mono` renders in currentColor instead of solid black. */
function AppleGlyph({ mono }) {
  return (
    <path
      fill={mono ? 'currentColor' : '#000'}
      d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"
    />
  );
}

/** Apple Pay lockup: the apple glyph followed by "Pay". */
export function ApplePayMark({ className = 'h-5', mono = false }) {
  return (
    <svg viewBox="0 0 78 24" className={className} role="img" aria-label="Apple Pay" fill="none">
      <g transform="translate(0,0) scale(0.92)">
        <AppleGlyph mono={mono} />
      </g>
      <text
        x="26" y="19"
        fill={mono ? 'currentColor' : '#000'}
        fontFamily="-apple-system, 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif"
        fontSize="19"
        fontWeight="500"
        letterSpacing="-0.4"
      >
        Pay
      </text>
    </svg>
  );
}

/** PayPal's twin-P monogram plus wordmark. */
export function PayPalMark({ className = 'h-5' }) {
  return (
    <svg viewBox="0 0 101 24" className={className} role="img" aria-label="PayPal" fill="none">
      {/* Monogram — back P (light) sits behind the front P (dark) */}
      <g transform="translate(0,1.2) scale(0.9)">
        <path
          fill={BRAND.paypalLight}
          d="M21.222 6.917a3.35 3.35 0 0 0-.607-.541c-.013.076-.026.175-.041.254-.93 4.778-4.005 7.201-9.138 7.201h-2.19a.563.563 0 0 0-.556.479l-1.187 7.527h-.506l-.24 1.516a.56.56 0 0 0 .554.647h3.882c.46 0 .85-.334.922-.788.06-.26.76-4.852.816-5.09a.932.932 0 0 1 .923-.788h.58c3.76 0 6.705-1.528 7.565-5.946.36-1.847.174-3.388-.777-4.471z"
        />
        <path
          fill={BRAND.paypalDark}
          d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106z"
        />
      </g>
      {/* Wordmark */}
      <text x="27" y="18" fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif" fontSize="17" fontWeight="700" letterSpacing="-0.5">
        <tspan fill={BRAND.paypalDark}>Pay</tspan><tspan fill={BRAND.paypalLight}>Pal</tspan>
      </text>
    </svg>
  );
}

/** Mastercard's interlocking circles — the one mark that is genuinely just geometry. */
export function MastercardMark({ className = 'h-5' }) {
  return (
    <svg viewBox="0 0 48 30" className={className} role="img" aria-label="Mastercard">
      <circle cx="18" cy="15" r="11" fill={BRAND.mcRed} />
      <circle cx="30" cy="15" r="11" fill={BRAND.mcYellow} />
      {/* The lens where the two circles meet is its own colour in the real mark */}
      <path
        fill={BRAND.mcOverlap}
        d="M24 6.3a10.98 10.98 0 0 1 0 17.4 10.98 10.98 0 0 1 0-17.4z"
      />
    </svg>
  );
}

/** Visa wordmark. */
export function VisaMark({ className = 'h-5' }) {
  return (
    <svg viewBox="0 0 64 22" className={className} role="img" aria-label="Visa">
      <text
        x="0" y="17"
        fill={BRAND.visa}
        fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif"
        fontSize="19"
        fontWeight="800"
        fontStyle="italic"
        letterSpacing="-0.6"
      >
        VISA
      </text>
    </svg>
  );
}

/** BLIK — Poland's bank-to-bank mobile payment scheme. */
export function BlikMark({ className = 'h-5' }) {
  return (
    <svg viewBox="0 0 64 24" className={className} role="img" aria-label="BLIK">
      <rect x="0" y="2" width="20" height="20" rx="6" fill={BRAND.blik} />
      {/* Stylised "b" inside the tile */}
      <path fill="#fff" d="M7.2 6.2h2.3v4.05a3.6 3.6 0 0 1 2.2-.72c2.16 0 3.75 1.66 3.75 4.02s-1.62 4.05-3.87 4.05a3.5 3.5 0 0 1-2.2-.74v.6H7.2V6.2zm2.24 7.35c0 1.28.83 2.13 1.97 2.13s1.95-.84 1.95-2.13-.81-2.1-1.95-2.1-1.97.83-1.97 2.1z" />
      <text x="25" y="18" fill="currentColor" fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif" fontSize="16" fontWeight="800" letterSpacing="0.5">
        BLIK
      </text>
    </svg>
  );
}

/** Google Pay lockup: the four-colour G plus "Pay". */
export function GooglePayMark({ className = 'h-5' }) {
  return (
    <svg viewBox="0 0 78 24" className={className} role="img" aria-label="Google Pay">
      <g transform="translate(1,2) scale(0.83)">
        <path fill={BRAND.googleBlue} d="M23.5 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.54 5.54 0 0 1-2.4 3.58v3h3.86c2.26-2.09 3.57-5.17 3.57-8.82z" />
        <path fill={BRAND.googleGreen} d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.99 11.99 0 0 0 12 24z" />
        <path fill={BRAND.googleYellow} d="M5.27 14.29a7.2 7.2 0 0 1 0-4.58V6.62H1.29a12 12 0 0 0 0 10.76l3.98-3.09z" />
        <path fill={BRAND.googleRed} d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z" />
      </g>
      <text x="26" y="19" fill="currentColor" fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif" fontSize="19" fontWeight="500" letterSpacing="-0.4">
        Pay
      </text>
    </svg>
  );
}

/**
 * Generic card mark for the "pay by card" option — deliberately unbranded, because that
 * tile accepts any network rather than one in particular.
 */
export function CardMark({ className = 'h-5' }) {
  return (
    <svg viewBox="0 0 36 24" className={className} role="img" aria-label="Debit or credit card" fill="none">
      <rect x="1" y="3" width="34" height="21" rx="3.5" fill="currentColor" opacity="0.16" />
      <rect x="1" y="3" width="34" height="21" rx="3.5" stroke="currentColor" strokeWidth="1.6" opacity="0.75" />
      <rect x="1" y="8" width="34" height="4" fill="currentColor" opacity="0.75" />
      <rect x="5" y="16" width="9" height="2.4" rx="1.2" fill="currentColor" opacity="0.75" />
    </svg>
  );
}
