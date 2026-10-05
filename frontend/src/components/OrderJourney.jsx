import { createElement } from 'react';
import { CreditCard, Package, ShieldCheck, CircleAlert } from 'lucide-react';
import { stepLabel } from '../utils/shipping';

export default function OrderJourney({ order, forBuyer, claim }) {
  const fulfilment = order.fulfilment || {};
  const payment = order.paymentStatus || order.payoutStatus;
  const transferred = ['TRANSFERRED', 'RELEASED'].includes(payment);
  const paid = ['PAID', 'TRANSFERRED'].includes(payment) || ['PAID', 'FULFILLED'].includes(order.status);
  const refunded = payment === 'REFUNDED' || order.status === 'REFUNDED';
  const held = claim?.status === 'OPEN';
  const steps = [
    { Icon: CreditCard, title: 'Payment', value: refunded ? 'Refunded' : paid ? 'Payment received' : 'Not paid yet' },
    { Icon: Package, title: 'Delivery', value: fulfilment.fulfilmentStatus ? stepLabel(fulfilment.shippingMethod, fulfilment.fulfilmentStatus) : 'Not started' },
    { Icon: held ? CircleAlert : ShieldCheck, title: 'Seller payout', value: transferred ? 'Released to seller' : held ? 'On hold · problem reported' : refunded ? 'Refunded to buyer' : fulfilment.buyerConfirmedAt ? 'Receipt confirmed · release pending' : paid ? 'Awaiting receipt confirmation' : 'Awaiting payment' },
  ];
  return <section aria-label="Order progress" className="my-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">{steps.map(({ Icon, title, value }) => <div key={title} className="flex gap-3 items-start">{createElement(Icon, { className: 'h-5 w-5 shrink-0 text-[#CDFF00] mt-0.5' })}<div><p className="text-xs text-gray-400">{title}</p><p className="text-sm font-semibold mt-1">{value}</p></div></div>)}</div>
    <p className="mt-4 text-xs leading-relaxed text-gray-400">{forBuyer ? 'Check your goods before confirming receipt. If anything is wrong, report it here first.' : 'Update delivery as the order moves. Marking it delivered does not approve your own payout.'} Payouts also depend on the payment hold rules, open claims, and your connected bank account.</p>
    {claim && <p className="mt-3 text-sm font-semibold">Problem report: {claim.status.toLowerCase().replaceAll('_', ' ')}{claim.resolutionNote ? ` — ${claim.resolutionNote}` : ''}</p>}
  </section>;
}
