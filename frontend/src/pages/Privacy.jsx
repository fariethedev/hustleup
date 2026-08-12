import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';

export default function Privacy() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-heading font-black text-white mb-2">Privacy Policy</h1>
      <p className="text-gray-500 text-sm mb-8">Last updated: placeholder — set this when the real policy goes live.</p>

      <div className="flex items-start gap-3 p-4 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 mb-10">
        <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
        <p className="text-sm text-yellow-200/90 leading-relaxed">
          This is placeholder text, not a reviewed legal document. Generate the real version with{' '}
          <a href="https://termly.io" target="_blank" rel="noreferrer" className="underline">Termly</a> or{' '}
          <a href="https://www.iubenda.com" target="_blank" rel="noreferrer" className="underline">Iubenda</a>{' '}
          — both handle GDPR (required for your Poland/EU users) and generate a matching cookie-consent banner.
        </p>
      </div>

      <div className="prose prose-invert prose-sm max-w-none space-y-6 text-gray-300 leading-relaxed">
        <section>
          <h2 className="text-white font-bold text-lg mb-2">Data we collect</h2>
          <p>Account details you provide (name, email, phone, address), profile content you upload (photos, listings, posts), and — if you use Google or Facebook sign-in — your name and email from that provider. If you enable location features, we also store your approximate coordinates to show distance to sellers.</p>
        </section>
        <section>
          <h2 className="text-white font-bold text-lg mb-2">How we use it</h2>
          <p>To operate the marketplace: matching buyers and sellers, processing payments, sending account and transaction emails, and showing distance-based results if you've enabled location.</p>
        </section>
        <section>
          <h2 className="text-white font-bold text-lg mb-2">Who we share it with</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li><b>Stripe</b> — processes payments and seller payouts; receives transaction and payout-account details.</li>
            <li><b>Resend</b> — sends transactional emails on our behalf (verification, receipts, notifications).</li>
            <li><b>AWS S3</b> (if configured) — stores uploaded photos.</li>
            <li><b>Google Maps</b> (if configured) — geocodes city names into coordinates for distance display.</li>
            <li><b>Sentry</b> — receives crash/error reports, which may incidentally include parts of a request that errored.</li>
          </ul>
          <p className="mt-2">We don't sell your data.</p>
        </section>
        <section>
          <h2 className="text-white font-bold text-lg mb-2">Cookies</h2>
          <p>We use essential cookies/local storage for login sessions. Optional features (chat support, analytics, search) may set additional cookies — you'll see a consent prompt once one is configured.</p>
        </section>
        <section>
          <h2 className="text-white font-bold text-lg mb-2">Your rights (GDPR)</h2>
          <p>If you're in the EU/EEA, you can request a copy of your data, ask us to correct or delete it, or object to certain processing. Contact us via the app's support channel to exercise these rights.</p>
        </section>
        <section>
          <h2 className="text-white font-bold text-lg mb-2">Data retention</h2>
          <p>We keep account data while your account is active, and transaction records for as long as required for accounting/tax purposes after that.</p>
        </section>
      </div>

      <Link to="/register" className="inline-block mt-10 text-[#CDFF00] font-semibold hover:underline">← Back to sign up</Link>
    </div>
  );
}
