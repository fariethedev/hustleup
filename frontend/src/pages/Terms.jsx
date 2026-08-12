import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';

export default function Terms() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-heading font-black text-white mb-2">Terms &amp; Conditions</h1>
      <p className="text-gray-500 text-sm mb-8">Last updated: placeholder — set this when the real terms go live.</p>

      <div className="flex items-start gap-3 p-4 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 mb-10">
        <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
        <p className="text-sm text-yellow-200/90 leading-relaxed">
          This is placeholder text, not a reviewed legal document. Generate the real version with{' '}
          <a href="https://termly.io" target="_blank" rel="noreferrer" className="underline">Termly</a> or{' '}
          <a href="https://www.iubenda.com" target="_blank" rel="noreferrer" className="underline">Iubenda</a>{' '}
          (both cover GDPR/Poland requirements) and replace this page's content before accepting real users.
        </p>
      </div>

      <div className="prose prose-invert prose-sm max-w-none space-y-6 text-gray-300 leading-relaxed">
        <section>
          <h2 className="text-white font-bold text-lg mb-2">1. Who we are</h2>
          <p>HustleUp ("we", "us") operates a marketplace connecting students to buy, sell, and hire within their community. By creating an account or using the platform, you agree to these terms.</p>
        </section>
        <section>
          <h2 className="text-white font-bold text-lg mb-2">2. Accounts</h2>
          <p>You're responsible for the accuracy of the information you provide and for keeping your login credentials secure. Accounts created via Google or Facebook sign-in are subject to the same terms as accounts created with an email and password.</p>
        </section>
        <section>
          <h2 className="text-white font-bold text-lg mb-2">3. Buying &amp; selling</h2>
          <p>HustleUp connects buyers and sellers but is not a party to the transactions between them. Payments are processed by Stripe. Sellers are responsible for the accuracy of their listings and for delivering what they've agreed to provide.</p>
        </section>
        <section>
          <h2 className="text-white font-bold text-lg mb-2">4. Payments &amp; payouts</h2>
          <p>Buyer payments are held by HustleUp until a booking is marked complete, at which point the seller is paid out via Stripe Connect, minus HustleUp's platform fee. Refunds follow the cancellation policy described in-app.</p>
        </section>
        <section>
          <h2 className="text-white font-bold text-lg mb-2">5. Prohibited conduct</h2>
          <p>No fraud, harassment, illegal goods or services, or attempts to circumvent platform fees by taking transactions off-platform after connecting through HustleUp.</p>
        </section>
        <section>
          <h2 className="text-white font-bold text-lg mb-2">6. Termination</h2>
          <p>We may suspend or terminate accounts that violate these terms. You can delete your account at any time from your profile settings.</p>
        </section>
        <section>
          <h2 className="text-white font-bold text-lg mb-2">7. Changes to these terms</h2>
          <p>We'll notify registered users of material changes and may ask you to re-accept before continuing to use the platform.</p>
        </section>
      </div>

      <Link to="/register" className="inline-block mt-10 text-[#CDFF00] font-semibold hover:underline">← Back to sign up</Link>
    </div>
  );
}
