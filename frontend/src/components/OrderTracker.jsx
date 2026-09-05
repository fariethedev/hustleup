import { Check, Copy, ExternalLink, MapPin, CalendarClock, Truck, Ban } from 'lucide-react';
import { useState } from 'react';
import {
  getMethod, stepsFor, stepLabel, stepIndex, isComplete, trackingLink,
} from '../utils/shipping';
import { dispatchToast } from '../api/client';

/**
 * Where an order has got to, from the buyer's point of view.
 *
 * Reads the `fulfilment` object that both marketplace bookings and storefront orders carry
 * — the backend deliberately gives them the same shape so one component can render either.
 *
 * The track it draws is the one for the method the order was actually sold under, not a
 * generic five-step bar: a parcel-locker order shows a locker step, a collection never
 * shows "out for delivery". A buyer looking at steps that will never happen has no way to
 * tell a stalled order from one that was never going to have that step.
 */
export default function OrderTracker({ fulfilment, compact = false }) {
  const [copied, setCopied] = useState(false);

  const status = fulfilment?.fulfilmentStatus;
  const method = fulfilment?.shippingMethod;
  const meta = getMethod(method);
  const steps = stepsFor(method);

  // Nothing to show before money arrives, or when the order was never shipped-anything.
  if (!status || status === 'AWAITING_PAYMENT' || steps.length === 0) return null;

  if (status === 'CANCELLED') {
    return (
      <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-2 text-[10px] font-black tracking-widest text-red-400">
        <Ban className="w-3.5 h-3.5" /> Delivery cancelled
      </div>
    );
  }

  const current = stepIndex(method, status);
  const link = trackingLink(fulfilment);
  const done = isComplete(status);

  const copyTracking = async () => {
    try {
      await navigator.clipboard.writeText(fulfilment.trackingNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      dispatchToast('Could not copy that — select and copy it by hand', 'error');
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-white/5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-1.5 text-[9px] font-black tracking-[0.2em] text-gray-500">
          {meta?.icon ? <meta.icon className="w-3.5 h-3.5" /> : <Truck className="w-3.5 h-3.5" />}
          {meta?.label || 'Delivery'}
        </div>
        <span className={`text-[9px] font-black tracking-[0.2em] ${done ? 'text-emerald-400' : 'text-[#CDFF00]'}`}>
          {stepLabel(method, status)}
        </span>
      </div>

      {/* The track itself. Each step is a dot plus the segment leading into it, so the
          filled length reads as "how far along", not "how many boxes are ticked". */}
      <div className="flex items-start">
        {steps.map((step, i) => {
          const reached = current >= 0 && i <= current;
          const isLast = i === steps.length - 1;
          return (
            <div key={step} className={`flex flex-col items-center ${isLast ? '' : 'flex-1'} min-w-0`}>
              <div className="flex items-center w-full">
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                    reached
                      ? (done && isLast ? 'bg-emerald-400 border-emerald-400' : 'bg-[#CDFF00] border-[#CDFF00]')
                      : 'bg-transparent border-white/15'
                  }`}
                >
                  {reached && <Check className="w-2.5 h-2.5 text-black" strokeWidth={4} />}
                </div>
                {!isLast && (
                  <div className={`flex-1 h-0.5 transition-colors ${i < current ? 'bg-[#CDFF00]' : 'bg-white/10'}`} />
                )}
              </div>
              {!compact && (
                <span
                  className={`mt-1.5 text-[8px] font-black tracking-[0.1em] leading-tight text-center px-0.5 ${
                    reached ? 'text-gray-300' : 'text-gray-600'
                  } ${isLast ? '' : '-ml-4 mr-4'}`}
                >
                  {stepLabel(method, step)}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Detail the buyer can act on: the number to quote, where to go, when to expect it. */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] font-bold text-gray-500">
        {fulfilment.trackingNumber && (
          <span className="flex items-center gap-1.5">
            <span className="text-gray-600 tracking-widest text-[9px]">
              {fulfilment.carrier || 'Tracking'}
            </span>
            <span className="text-gray-300 font-mono normal-case">{fulfilment.trackingNumber}</span>
            <button
              onClick={copyTracking}
              title="Copy tracking number"
              className="p-1 rounded hover:bg-white/10 text-gray-500 hover:text-white transition-colors"
            >
              {copied ? <Check className="w-3 h-3 text-[#CDFF00]" /> : <Copy className="w-3 h-3" />}
            </button>
            {/* Only ever a link we can build with confidence — sending someone to a guessed
                carrier's 404 is worse than showing them a number they can paste themselves. */}
            {link && (
              <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[#CDFF00] hover:underline"
              >
                Track <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </span>
        )}

        {fulfilment.dropoffPoint && (
          <span className="flex items-center gap-1.5 min-w-0">
            <MapPin className="w-3 h-3 text-gray-600 shrink-0" />
            <span className="text-gray-300 truncate">{fulfilment.dropoffPoint}</span>
          </span>
        )}

        {fulfilment.estimatedDelivery && !done && (
          <span className="flex items-center gap-1.5">
            <CalendarClock className="w-3 h-3 text-gray-600" />
            <span className="text-gray-300">
              Expected {new Date(fulfilment.estimatedDelivery).toLocaleDateString()}
            </span>
          </span>
        )}
      </div>

      {fulfilment.note && (
        <p className="mt-2 text-[11px] text-gray-400 italic leading-relaxed">
          &ldquo;{fulfilment.note}&rdquo;
        </p>
      )}
    </div>
  );
}
