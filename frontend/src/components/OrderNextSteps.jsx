import { Check, Loader2, CreditCard, PackageCheck, Truck, Home, Star } from 'lucide-react';

/**
 * What happens between paying and holding the thing, spelled out.
 *
 * The confirmation screen used to end at "your booking has been sent to the sellers" and two
 * buttons. That leaves the buyer with the questions that actually matter unanswered: has my
 * money gone, who does something next, when does it move, and where do I watch it. This
 * answers all four in order, and marks how far along the order already is.
 *
 * The steps mirror the backend's FulfilmentStatus progression, so the wording a buyer reads
 * here is the same wording they will see on the order itself.
 *
 * @param {string}  [status]   current FulfilmentStatus, if the order has one yet
 * @param {boolean} [paid]     whether payment has cleared
 * @param {string}  [method]   shipping method, so pickup orders don't promise a courier
 */
export default function OrderNextSteps({ status, paid = false, method }) {
  const isPickup = method === 'PICKUP';

  // Which fulfilment statuses mean a given step is already behind you.
  const reached = {
    paid: paid || ['CONFIRMED', 'PREPARING', 'SHIPPED', 'OUT_FOR_DELIVERY', 'READY_FOR_PICKUP', 'DELIVERED', 'COLLECTED'].includes(status),
    confirmed: ['CONFIRMED', 'PREPARING', 'SHIPPED', 'OUT_FOR_DELIVERY', 'READY_FOR_PICKUP', 'DELIVERED', 'COLLECTED'].includes(status),
    moving: ['SHIPPED', 'OUT_FOR_DELIVERY', 'READY_FOR_PICKUP', 'DELIVERED', 'COLLECTED'].includes(status),
    arrived: ['DELIVERED', 'COLLECTED'].includes(status),
  };

  const steps = [
    {
      key: 'paid',
      icon: CreditCard,
      title: 'Payment received',
      body: 'Your money is held by HustleSpace, not paid out yet. The seller only receives it once the order is marked complete.',
      done: reached.paid,
    },
    {
      key: 'confirmed',
      icon: PackageCheck,
      title: 'Seller confirms and prepares your order',
      body: 'They get an alert the moment payment clears. Most sellers confirm within a day — you will get a notification when they do.',
      done: reached.confirmed,
    },
    {
      key: 'moving',
      icon: isPickup ? Home : Truck,
      title: isPickup ? 'Ready to collect' : 'On its way to you',
      body: isPickup
        ? 'The seller will tell you when and where to pick it up. Message them to agree a time that works.'
        : 'Once it ships you get a tracking number on the order, and a notification with it.',
      done: reached.moving,
    },
    {
      key: 'arrived',
      icon: Star,
      title: isPickup ? 'Collect it, then rate the seller' : 'It arrives — then rate the seller',
      body: 'Marking the order complete releases payment to the seller and asks you for a rating. That rating is what other buyers see on their shop.',
      done: reached.arrived,
    },
  ];

  // The first step that is not done is the one currently in progress.
  const activeIndex = steps.findIndex((s) => !s.done);

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-5 text-left">
      <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-4">
        What happens next
      </h3>

      <ol className="space-y-4">
        {steps.map((step, i) => {
          const active = i === activeIndex;
          const Icon = step.icon;
          return (
            <li key={step.key} className="flex gap-3">
              {/* Marker column, with the line that ties the steps together */}
              <div className="flex flex-col items-center shrink-0">
                <span
                  className={`w-8 h-8 rounded-full flex items-center justify-center border ${
                    step.done
                      ? 'bg-[#CDFF00] border-[#CDFF00] text-black'
                      : active
                        ? 'bg-[#CDFF00]/10 border-[#CDFF00]/50 text-[#CDFF00]'
                        : 'bg-white/[0.03] border-white/10 text-gray-600'
                  }`}
                >
                  {step.done
                    ? <Check className="w-4 h-4" strokeWidth={3} />
                    : active
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Icon className="w-4 h-4" />}
                </span>
                {i < steps.length - 1 && (
                  <span className={`w-px flex-1 mt-1 ${step.done ? 'bg-[#CDFF00]/40' : 'bg-white/10'}`} />
                )}
              </div>

              <div className="pb-1 min-w-0">
                <p className={`text-sm font-bold leading-tight ${
                  step.done ? 'text-white' : active ? 'text-[#CDFF00]' : 'text-gray-400'
                }`}>
                  {step.title}
                  {active && <span className="ml-2 text-[9px] font-black uppercase tracking-widest text-gray-500">Now</span>}
                </p>
                <p className="text-xs text-gray-500 leading-relaxed mt-1">{step.body}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
