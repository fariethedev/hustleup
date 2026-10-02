import { useEffect, useState } from 'react';
import { Check, Store, MoveRight, ShieldCheck } from 'lucide-react';
import { subscriptionsApi } from '../api/client';
import { isAllAccessActive, isPremiumActive } from '../utils/premium';

const tiers = [
  { id: 'FREE', name: 'Free', description: 'Explore and connect.', features: ['Browse and buy', 'Community feed', 'Profile and messaging'], excluded: 'Selling, Bond and leaderboards not included' },
  { id: 'MONTHLY', name: 'Plus', description: 'Turn your skills into sales.', features: ['Everything in Free', 'List products, services and events', 'Your storefront and booking availability', 'Seller tools and Stripe bank payouts'], excluded: 'Bond and leaderboards not included' },
  { id: 'ALL_ACCESS', name: 'All Access', description: 'The complete HustleSpace experience.', features: ['Everything in Plus', 'Hustle Bond discovery and matching', 'Access to leaderboards', 'All paid app features included'], featured: true },
];

export default function SellerUpgrade({ title = 'Choose your plan', blurb = 'Start free. Sell with Plus. Unlock every feature with All Access.', onCancel, cancelLabel = 'Not now' }) {
  const [data, setData] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    Promise.all([subscriptionsApi.plans(), subscriptionsApi.my()]).then(([plans, mine]) => {
      if (cancelled) return;
      if (!plans.data?.plans?.some(p => p.id === 'MONTHLY') || !plans.data.plans.some(p => p.id === 'ALL_ACCESS')) throw new Error('Plans are unavailable.');
      setData(plans.data); setSubscription(mine.data);
    }).catch(() => { if (!cancelled) setError('We could not load your plans. Please retry.'); });
    return () => { cancelled = true; };
  }, [attempt]);
  const current = isAllAccessActive(subscription) ? 'ALL_ACCESS' : isPremiumActive(subscription) ? 'MONTHLY' : 'FREE';
  const start = async id => {
    if (busy) return;
    setBusy(id); setError('');
    try { const response = await subscriptionsApi.checkout(id); window.location.assign(response.data.checkoutUrl); }
    catch (failure) { setError(failure.response?.data?.error || 'Checkout could not be opened. Please try again.'); setBusy(null); }
  };
  return <section className="w-full max-w-5xl mx-auto text-white p-4 sm:p-6">
    <p className="text-xs font-bold uppercase tracking-[.2em] text-[#CDFF00] mb-3">Membership</p>
    <h2 className="text-3xl sm:text-4xl font-black tracking-tight">{title}</h2>
    <p className="text-sm text-gray-400 mt-3 mb-8 max-w-xl">{blurb}</p>
    {error && <div role="alert" className="mb-4 rounded-xl p-4 bg-red-500/10 text-red-200 text-sm">{error} {!data && <button className="ml-3 underline" onClick={() => { setError(''); setAttempt(a => a + 1); }}>Retry</button>}</div>}
    {!data && !error && <p role="status" className="py-8 text-gray-400">Loading plans…</p>}
    {data && <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
      {tiers.map(tier => {
        const plan = data.plans.find(p => p.id === tier.id);
        const selected = current === tier.id;
        return <article key={tier.id} className={`flex flex-col rounded-3xl border p-6 ${tier.featured ? 'border-[#CDFF00]/60 bg-[#CDFF00]/[0.06]' : 'border-white/10 bg-[#141414]'}`}>
          <div className="flex items-center justify-between gap-2 min-h-6"><h3 className="font-bold text-lg">{tier.name}</h3>{selected ? <span className="text-[10px] rounded-full px-2 py-1 bg-white/10">Current plan</span> : tier.featured && <span className="text-[10px] text-[#CDFF00] font-bold">EVERY FEATURE</span>}</div>
          <p className="text-gray-400 text-xs mt-2 min-h-8">{tier.description}</p>
          <div className="mt-5 mb-1"><span className="text-4xl font-black tracking-tight">{new Intl.NumberFormat('pl-PL', { style: 'currency', currency: data.currency || 'PLN', maximumFractionDigits: 0 }).format(plan?.price ?? 0)}</span></div>
          <p className="text-xs text-gray-500 mb-6">{plan ? 'per month · paid once, no auto-renewal' : 'No payment required'}</p>
          <ul className="space-y-3 flex-1 mb-6">{tier.features.map(feature => <li key={feature} className="flex gap-2 text-sm text-gray-300"><Check size={16} className="text-[#CDFF00] shrink-0 mt-0.5" />{feature}</li>)}</ul>
          {tier.excluded && <p className="text-xs text-gray-500 mb-5">{tier.excluded}</p>}
          <button disabled={!!busy || tier.id === 'FREE'} onClick={() => start(tier.id)} className={`rounded-xl py-3 px-3 font-bold text-sm disabled:opacity-50 ${tier.featured ? 'bg-[#CDFF00] text-black' : 'bg-white/10 text-white'}`}>
            {busy === tier.id ? 'Opening secure checkout…' : tier.id === 'FREE' ? selected ? 'Your current plan' : 'Free when your plan expires' : selected ? `Extend ${tier.name}` : `Choose ${tier.name}`}
          </button>
        </article>;
      })}
    </div>}
    <div className="mt-6 text-xs text-gray-400 leading-relaxed flex gap-2"><ShieldCheck size={18} className="shrink-0" /><p>Secure payment through Stripe. Paid plans last one month. Renewing extends your term; switching tiers converts remaining paid time at the relative plan prices. Marketplace transaction fees are separate from membership. Bank verification is required before payouts.</p></div>
    {onCancel && <button className="mt-5 text-sm text-gray-400 underline" onClick={onCancel}>{cancelLabel}</button>}
  </section>;
}

export function SellerUpgradeButton({ onClick, label = 'Start selling' }) {
  return <button onClick={onClick} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#CDFF00] text-black font-bold text-sm"><Store size={16} />{label}<MoveRight size={16} /></button>;
}
