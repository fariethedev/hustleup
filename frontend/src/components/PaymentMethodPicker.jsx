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
      {/* Compact rows, not tiles.
          Each option used to be a card with a 40px white brand plate stacked above a label
          and a description — five of those filled most of a phone screen before the buyer
          reached the pay button. The mark now sits inline at its legible minimum, the
          description is gone (the "what happens next" line below already says it, for the
          one option that is actually selected), and a row is ~40px instead of ~110px. */}
      <div className="rounded-xl border border-white/10 overflow-hidden divide-y divide-white/5">
        {PAYMENT_METHODS.map(({ id, label, Mark, onLight }) => {
          const active = value === id;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                active ? 'bg-[#CDFF00]/[0.08]' : 'bg-black/40 hover:bg-white/[0.04]'
              }`}
            >
              {/* Light plate only where the brand's own artwork needs one to stay legible */}
              <span
                className={`w-14 h-7 rounded-md flex items-center justify-center px-1.5 shrink-0 ${
                  onLight ? 'bg-white' : active ? 'text-[#CDFF00]' : 'text-gray-300'
                }`}
              >
                <Mark className="h-4 w-auto max-w-full" />
              </span>

              <span className={`flex-1 min-w-0 text-xs font-black uppercase tracking-wide truncate ${
                active ? 'text-[#CDFF00]' : 'text-white'
              }`}>
                {label}
              </span>

              <span
                className={`w-4 h-4 rounded-full border shrink-0 flex items-center justify-center transition-colors ${
                  active ? 'bg-[#CDFF00] border-[#CDFF00]' : 'border-white/25'
                }`}
              >
                {active && <Check className="w-2.5 h-2.5 text-black" strokeWidth={4} />}
              </span>
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
