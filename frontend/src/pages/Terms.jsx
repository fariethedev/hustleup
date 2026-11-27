import { Link } from 'react-router-dom';

const UPDATED = '27 November 2026';
const SUPPORT = 'support@hustlespace.space';

/** One numbered section of the terms. */
function Section({ n, title, children }) {
  return (
    <section id={`s${n}`} className="scroll-mt-24">
      <h2 className="text-white font-bold text-lg mb-2">{n}. {title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

const CONTENTS = [
  'Who we are', 'Your account', 'Our role in a sale', 'Buying and paying', 'Buyer Protection',
  'Problems, disputes and refunds', 'Selling', 'Prohibited items and counterfeits', 'Payouts to sellers',
  'Off-platform payments and scams', 'Reports, moderation and appeals', 'Strikes, suspension and closing accounts',
  'Taxes and reporting to the tax office', 'Liability', 'Privacy', 'Changes to these terms', 'Law and complaints',
];

export default function Terms() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-heading font-black text-white mb-2">Terms &amp; Conditions</h1>
      <p className="text-gray-500 text-sm mb-8">Last updated: {UPDATED}</p>

      <nav aria-label="Contents" className="mb-10 p-5 rounded-2xl bg-white/[0.03] border border-white/10">
        <p className="text-xs font-bold tracking-widest text-gray-500 mb-3">CONTENTS</p>
        <ol className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
          {CONTENTS.map((t, i) => (
            <li key={t}><a href={`#s${i + 1}`} className="text-gray-300 hover:text-[#CDFF00]">{i + 1}. {t}</a></li>
          ))}
        </ol>
      </nav>

      <div className="prose prose-invert prose-sm max-w-none space-y-8 text-gray-300 leading-relaxed">
        <Section n={1} title="Who we are">
          <p>HustleSpace ("we", "us") runs an online marketplace and community where people buy, sell, swap and book items, services, events and jobs. These terms are a contract between you and us. By creating an account or using HustleSpace you accept them.</p>
          <p>Contact and our single point of contact for users and authorities: <a href={`mailto:${SUPPORT}`} className="text-[#CDFF00]">{SUPPORT}</a>. We answer in English and Polish.</p>
        </Section>

        <Section n={2} title="Your account">
          <p>You must be at least 16 to use HustleSpace and at least 18 to sell or receive payouts. You must give accurate information, verify your email, keep your login safe and tell us about any unauthorised use. One person may not run several accounts to get around limits, reviews or a suspension.</p>
        </Section>

        <Section n={3} title="Our role in a sale">
          <p>HustleSpace is an intermediary. The contract for an item or service is between the buyer and the seller. We are not the seller, we do not inspect items, and we do not own what is listed.</p>
          <p><strong className="text-white">Private and business sellers.</strong> Every seller tells us whether they sell as a private person or as a business, and we show this on their listings and shop. Business sellers must give their legal name, registration number, address and contact details before selling. When you buy from a business seller, EU consumer law applies to that purchase, including the 14-day right of withdrawal for distance sales. When you buy from a private seller, those consumer rights do not apply — HustleSpace Buyer Protection (section 5) still does.</p>
        </Section>

        <Section n={4} title="Buying and paying">
          <p>Pay only through HustleSpace checkout. Payments are processed by Stripe; we never see or store your full card details. The price, delivery cost and total are shown before you pay. An offer is binding once both sides accept it: the buyer then pays to confirm, and nothing is reserved until payment is made.</p>
        </Section>

        <Section n={5} title="Buyer Protection">
          <p>When you pay through HustleSpace, your money is held by us — not passed to the seller — until the order is complete. Buyer Protection covers items or services that <strong className="text-white">never arrive</strong>, <strong className="text-white">arrive damaged</strong>, or are <strong className="text-white">significantly not as described</strong> (including counterfeits).</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Check your order when it arrives, then tap <em>Confirm received</em>. This releases the payment to the seller.</li>
            <li>If something is wrong, tap <em>Report a problem</em> on the order <strong className="text-white">before</strong> confirming. A report freezes the payment until it is resolved.</li>
            <li>If you do neither, the payment can be released automatically 7 days after the carrier's tracking (for example InPost) confirms delivery, or 30 days after the seller marks the order delivered. Before that happens we remind you and give you another 48 hours to report a problem. Orders from new sellers and other higher-risk orders are only released when you confirm receipt or after our team decides.</li>
            <li>Buyer Protection does not cover payments made outside HustleSpace, buyer's remorse for a correctly described item bought from a private seller, or problems reported after you confirmed receipt where the problem was visible on receipt.</li>
          </ul>
        </Section>

        <Section n={6} title="Problems, disputes and refunds">
          <ol className="list-decimal pl-5 space-y-1">
            <li><strong className="text-white">Report.</strong> The buyer describes the problem on the order and may add photos.</li>
            <li><strong className="text-white">Seller response.</strong> The seller has 3 days to respond with their side, tracking or photos. Payout stays frozen meanwhile.</li>
            <li><strong className="text-white">Decision.</strong> Our team decides on the evidence: a full refund, a partial refund, or release of the payment to the seller. We explain the reasons to both sides.</li>
            <li><strong className="text-white">Appeal.</strong> Either side may appeal once, within 7 days of the decision, with new information. A different team member reviews it and that decision is final within HustleSpace.</li>
          </ol>
          <p>Refunds go back to the original payment method. If the seller had already been paid, we recover the money from them (by reversing their payout or from future payouts) — sellers agree to this when they sell. Each decision against a seller counts as a strike (section 12).</p>
          <p><strong className="text-white">Chargebacks.</strong> Please use our dispute process before asking your bank for a chargeback. If a chargeback is opened, we freeze the related payout, may recover funds from the seller, and submit the order's evidence to the bank.</p>
        </Section>

        <Section n={7} title="Selling">
          <ul className="list-disc pl-5 space-y-1">
            <li>Describe items honestly and completely: condition, defects, brand, authenticity and real photos of the actual item. You must own what you sell and be able to deliver it.</li>
            <li>Send within the time you promised, using tracked delivery where offered, and keep the delivery status up to date. Marking an order sent without sending it is fraud.</li>
            <li><strong className="text-white">Review of listings.</strong> Some listings are checked before they go live — for example high-value electronics or designer goods from new sellers, prices far below the usual market price, or wording linked to counterfeits. Held listings are not visible until reviewed, usually within a day.</li>
            <li><strong className="text-white">New-seller limits.</strong> New sellers may have a limit on open orders and their payouts may wait for the buyer's confirmation. Limits rise as you complete sales without problems.</li>
            <li>Our platform fee is a percentage of the item price, shown before you list and in your earnings. Delivery costs you charge are passed to you in full.</li>
          </ul>
        </Section>

        <Section n={8} title="Prohibited items and counterfeits">
          <p>You may not list or sell: counterfeit, replica or "inspired" branded goods; stolen goods; weapons, ammunition and explosives; drugs, prescription medicines and drug paraphernalia; alcohol and tobacco to minors; adult content; live animals; personal data, accounts or credentials; recalled or unsafe products; anything that infringes someone's intellectual property; and anything illegal in Poland or the EU. Event tickets must be genuine and resold within the law.</p>
          <p>Listings that break these rules are removed and count as a strike; selling counterfeits or stolen goods can lead to immediate suspension and a report to the authorities.</p>
        </Section>

        <Section n={9} title="Payouts to sellers">
          <p>Payouts are made by Stripe Connect. To receive money you must complete Stripe's identity and bank verification. We transfer your earnings, minus our fee, after the buyer confirms receipt or the protection period ends (section 5). Payouts are held while a problem report, chargeback or investigation is open, or while your account is suspended. Where we have refunded a buyer for your sale, we may reverse the related transfer or deduct the amount from future payouts.</p>
        </Section>

        <Section n={10} title="Off-platform payments and scams">
          <p>Never pay or ask to be paid outside HustleSpace — by BLIK, bank transfer, PayPal, crypto, cash in advance or gift cards — for something found on HustleSpace. Those payments have no Buyer Protection and are the most common way scams work. We detect and flag messages that ask for this, warn the other person, and may restrict accounts that do it repeatedly. Never share verification codes or card details in chat.</p>
        </Section>

        <Section n={11} title="Reports, moderation and appeals">
          <p>Anyone can report a listing, shop, seller or message that they believe is illegal or breaks these terms, using <em>Report</em> in the app. We review reports, may hide a listing while we do, and tell the reporter the outcome.</p>
          <p>When we remove content or restrict an account, we tell the person affected what we did, which rule or law it is based on, and how to appeal (a "statement of reasons"). You can appeal any moderation decision within 6 months through <em>Help → Report a problem</em> or by email; a person, not an automated system, reviews it. Under the EU Digital Services Act you may also use a certified out-of-court dispute settlement body or go to court.</p>
          <p>We use automated checks (for example price and keyword checks, and detection of off-platform payment requests) to prioritise reviews. Final decisions to remove content or suspend accounts are made by people.</p>
        </Section>

        <Section n={12} title="Strikes, suspension and closing accounts">
          <p>A strike is recorded when a dispute is decided against a seller, a listing is removed for breaking the rules, or after a formal warning. At <strong className="text-white">3 strikes</strong>, selling is suspended. We may suspend immediately for fraud, counterfeits, threats, or attempts to evade a previous suspension — including accounts linked by payout bank account, device or contact details.</p>
          <p>While a seller is suspended their listings and shop are hidden, they cannot take new orders, open orders may be refunded to buyers, and payouts are paused until open matters are resolved. You can close your account at any time; obligations for open orders, refunds and tax reporting continue after closure.</p>
        </Section>

        <Section n={13} title="Taxes and reporting to the tax office">
          <p>Sellers are responsible for their own taxes on what they earn. Under the EU DAC7 rules (implemented in Poland by the law on the exchange of tax information), we must report to the Polish tax authority (KAS) each seller who in a calendar year makes <strong className="text-white">30 or more sales</strong> or earns <strong className="text-white">more than €2,000</strong>. The report includes your name, tax ID (PESEL, NIP or foreign TIN), date of birth, address, the amounts you were paid and the fees we charged per quarter. Sellers above the threshold must provide these details; we may hold payouts until they do. We send you a copy of what we report.</p>
        </Section>

        <Section n={14} title="Liability">
          <p>We are responsible for running HustleSpace with reasonable care and for the Buyer Protection and dispute process described here. We are not responsible for the items, services or conduct of buyers and sellers beyond that. Nothing in these terms limits liability that cannot be limited by law, including your mandatory rights as a consumer.</p>
        </Section>

        <Section n={15} title="Privacy">
          <p>How we use personal data, including for fraud prevention and tax reporting, is explained in our <Link to="/privacy" className="text-[#CDFF00]">Privacy Policy</Link>.</p>
        </Section>

        <Section n={16} title="Changes to these terms">
          <p>We will tell registered users about material changes at least 15 days before they take effect. If you do not agree, you can close your account before then.</p>
        </Section>

        <Section n={17} title="Law and complaints">
          <p>These terms are governed by Polish law. If you are a consumer, you keep the protection of the mandatory laws of your country of residence. Complaints about HustleSpace itself can be sent to <a href={`mailto:${SUPPORT}`} className="text-[#CDFF00]">{SUPPORT}</a>; we reply within 14 days. Consumers may also use the EU Online Dispute Resolution platform or contact the Polish consumer protection authority (UOKiK) or their local consumer ombudsman.</p>
        </Section>
      </div>

      <Link to="/" className="inline-block mt-10 text-[#CDFF00] font-semibold hover:underline">← Back to HustleSpace</Link>
    </div>
  );
}
