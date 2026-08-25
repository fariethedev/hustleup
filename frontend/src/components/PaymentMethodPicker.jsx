import { AnimatePresence, motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { VisaMark, MastercardMark } from './PaymentBrands';
import { PAYMENT_METHODS, findMethod } from '../utils/paymentMethods';

/**
 * The payment-method chooser.
 *
 * @param {string}   value    currently selected method id
 * @param {Function} onChange called with the newly selected method id
 */
export default function PaymentMethodPicker({ value, onChange }) {
  const selected = findMethod(value);

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {PAYMENT_METHODS.map(({ id, label, description, Mark, onLight }) => {
          const active = value === id;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(id)}
              className={`group relative rounded-xl border p-3 text-left transition-all active:scale-[0.98] ${
                active
                  ? 'border-[#CDFF00] bg-[#CDFF00]/[0.07] shadow-[0_0_0_1px_rgba(205,255,0,0.25)]'
                  : 'border-white/10 bg-black/40 hover:border-white/25'
              }`}
            >
              {/* Brand chip — light plate for full-colour marks so they stay legible */}
              <div
                className={`h-10 rounded-lg flex items-center justify-center px-3 mb-2.5 transition-colors ${
                  onLight
                    ? 'bg-white'
                    : active ? 'bg-[#CDFF00]/15 text-[#CDFF00]' : 'bg-white/[0.06] text-gray-300'
                }`}
              >
                <Mark className="h-5 w-auto max-w-full" />
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className={`text-[11px] font-black uppercase tracking-wide truncate ${active ? 'text-[#CDFF00]' : 'text-white'}`}>
                    {label}
                  </div>
                  <div className="text-[10px] text-gray-500 truncate">{description}</div>
                </div>
                <span
                  className={`w-4 h-4 rounded-full border shrink-0 flex items-center justify-center transition-colors ${
                    active ? 'bg-[#CDFF00] border-[#CDFF00]' : 'border-white/25 group-hover:border-white/50'
                  }`}
                >
                  {active && <Check className="w-2.5 h-2.5 text-black" strokeWidth={4} />}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* What happens after you press pay, stated before you press it. */}
      <AnimatePresence mode="wait">
        <motion.p
          key={selected.id}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="mt-3 text-[11px] text-gray-400 leading-relaxed"
        >
          {selected.next}
        </motion.p>
      </AnimatePresence>

      {/* Networks accepted by the card option — only relevant once it's chosen */}
      <AnimatePresence>
        {value === 'card' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 pt-3">
              <span className="h-7 px-2 rounded bg-white flex items-center"><VisaMark className="h-3.5 w-auto" /></span>
              <span className="h-7 px-2 rounded bg-white flex items-center"><MastercardMark className="h-4 w-auto" /></span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
