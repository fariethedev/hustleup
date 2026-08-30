import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Loader2, Truck, Ban } from 'lucide-react';
import { getMethod, stepsFor, stepLabel, stepIndex } from '../utils/shipping';
import { dispatchToast } from '../api/client';

/**
 * The seller's side: telling the buyer where their order has got to.
 *
 * Which buttons appear depends on how the seller said they'd send it — a courier order
 * offers "Out for delivery", a locker order offers "In the locker", and neither offers the
 * other's step. That is the whole point of asking for a shipping method up front: the
 * update control can then ask a question the seller can actually answer, instead of one
 * menu of every state the platform knows about.
 *
 * @param {object}   order    the booking or shop order being updated
 * @param {string}   title    what was sold, for the dialog heading
 * @param {function} onSubmit (update) => Promise — the caller picks bookings vs shop orders
 * @param {function} onDone   called with the server's updated order after a successful save
 */
export default function TrackingUpdateModal({ order, title, onSubmit, onDone, onClose }) {
  const fulfilment = order?.fulfilment || {};
  const method = fulfilment.shippingMethod;
  const meta = getMethod(method);
  const steps = stepsFor(method);
  const currentIndex = stepIndex(method, fulfilment.fulfilmentStatus);

  const [status, setStatus] = useState(
    // Open on the next step rather than the current one: the seller is here because
    // something has moved, and pre-selecting where it already is makes them work to say so.
    steps[Math.min(currentIndex + 1, steps.length - 1)] || steps[0]
  );
  const [form, setForm] = useState({
    carrier: fulfilment.carrier || '',
    trackingNumber: fulfilment.trackingNumber || '',
    trackingUrl: fulfilment.trackingUrl || '',
    dropoffPoint: fulfilment.dropoffPoint || '',
    estimatedDelivery: fulfilment.estimatedDelivery || '',
    note: '',
  });
  const [saving, setSaving] = useState(false);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  // Tracking fields only for methods that have a carrier; a pickup order asking for a
  // consignment number is how you get sellers typing "n/a" into something buyers are shown.
  const showTracking = !!meta?.tracked;
  const showDropoff = !!meta?.needsDropoff;

  const save = async () => {
    setSaving(true);
    try {
      const res = await onSubmit({ ...form, status });
      dispatchToast('Buyer notified of the update', 'success');
      onDone?.(res.data);
      onClose();
    } catch (e) {
      dispatchToast(e.response?.data?.error || 'Could not save that update', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center px-4">
      <div onClick={onClose} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-md bg-[#0a0a0a] border border-white/10 rounded-2xl p-5 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <h3 className="text-sm font-black text-white uppercase tracking-tight truncate">
              Update delivery
            </h3>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1 truncate">
              {title}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-500 shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-1.5 mb-4 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-[10px] font-black uppercase tracking-widest text-gray-400">
          {meta?.icon ? <meta.icon className="w-3.5 h-3.5 text-[#CDFF00]" /> : <Truck className="w-3.5 h-3.5 text-[#CDFF00]" />}
          Sending by {meta?.label || 'an unspecified method'}
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">
              Where is it now?
            </label>
            <div className="grid grid-cols-2 gap-2">
              {steps.map((step) => (
                <button
                  key={step}
                  type="button"
                  onClick={() => setStatus(step)}
                  className={`px-3 py-2.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${
                    status === step
                      ? 'bg-[#CDFF00] text-black border-[#CDFF00]'
                      : 'bg-black/50 border-white/10 text-gray-400 hover:border-white/30 hover:text-white'
                  }`}
                >
                  {stepLabel(method, step)}
                </button>
              ))}
              {/* Cancelling is always reachable but never sits with the happy path — it is
                  not "the next step", it is abandoning the track. */}
              <button
                type="button"
                onClick={() => setStatus('CANCELLED')}
                className={`col-span-2 px-3 py-2.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 ${
                  status === 'CANCELLED'
                    ? 'bg-red-500/20 text-red-300 border-red-500/60'
                    : 'bg-black/50 border-white/10 text-gray-500 hover:border-red-500/40 hover:text-red-400'
                }`}
              >
                <Ban className="w-3 h-3" /> Cancel delivery
              </button>
            </div>
          </div>

          {showTracking && (
            <div className="grid grid-cols-2 gap-2.5">
              <Field label="Carrier" value={form.carrier} onChange={(v) => set('carrier', v)} placeholder="InPost" />
              <Field
                label="Tracking no."
                value={form.trackingNumber}
                onChange={(v) => set('trackingNumber', v)}
                placeholder="000123456789"
              />
              <div className="col-span-2">
                <Field
                  label="Tracking link (optional)"
                  value={form.trackingUrl}
                  onChange={(v) => set('trackingUrl', v)}
                  placeholder="https://…"
                />
                <p className="mt-1 text-[9px] text-gray-600 leading-relaxed">
                  Leave blank and we'll build one for InPost, DPD, DHL, GLS, UPS, FedEx and Poczta Polska.
                </p>
              </div>
            </div>
          )}

          {showDropoff && (
            <Field
              label="Collection point"
              value={form.dropoffPoint}
              onChange={(v) => set('dropoffPoint', v)}
              placeholder="e.g. Paczkomat WAW01M, ul. Złota 44"
            />
          )}

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1.5">
              Expected by
            </label>
            <input
              type="date"
              value={form.estimatedDelivery}
              onChange={(e) => set('estimatedDelivery', e.target.value)}
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-[#CDFF00]"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1.5">
              Message to the buyer
            </label>
            <textarea
              rows={2}
              value={form.note}
              onChange={(e) => set('note', e.target.value)}
              placeholder="Anything they should know — sent with the update."
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-[#CDFF00] resize-none placeholder-gray-600"
            />
          </div>
        </div>

        <div className="flex gap-2.5 mt-5">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-white/10 text-white font-black uppercase tracking-widest text-[10px] hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || !status}
            className="flex-1 py-3 rounded-xl bg-[#CDFF00] text-black font-black uppercase tracking-widest text-[10px] hover:bg-[#E0FF4D] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            {saving ? 'Saving' : 'Save & notify'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1.5">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-[#CDFF00] placeholder-gray-600"
      />
    </div>
  );
}
