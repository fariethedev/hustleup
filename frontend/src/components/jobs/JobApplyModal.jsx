import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { X, Loader2, AlertCircle, Paperclip, Zap, BadgeCheck } from 'lucide-react';
import { jobsApi } from '../../api/client';
import { lockBodyScroll } from '../../utils/lockBodyScroll';

/**
 * Apply to a job.
 *
 * <p>Replaces the old behaviour where "Apply" fired a toast and recorded nothing — the
 * application now reaches the hiring company's inbox and survives a refresh.
 */
export default function JobApplyModal({ job, onClose, onApplied }) {
  const [message, setMessage] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    const unlock = lockBodyScroll();
    return () => unlock();
  }, []);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await jobsApi.apply(job.id, { message: message.trim() || undefined, attachment });
      onApplied?.();
    } catch (err) {
      const data = err.response?.data;
      setError(data?.error || data?.message
        || (err.response?.status === 401
            ? 'Sign in to apply'
            : `Could not apply (server said ${err.response?.status ?? 'nothing'})`));
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[900] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="w-full sm:max-w-md bg-[#0a0a0a] border border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col"
      >
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between shrink-0">
          <h2 className="text-base font-black text-white uppercase tracking-tight">Apply</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10">
            <p className="text-sm font-black text-white leading-tight">{job.title}</p>
            <p className="text-xs text-gray-400 font-semibold flex items-center gap-1.5 mt-1">
              {job.companyName}
              <BadgeCheck className="w-3.5 h-3.5 text-[#CDFF00]" />
            </p>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1.5 block">
              Message to the employer
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Why you're a fit, and when you can start…"
              className="w-full min-h-[110px] resize-none bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-[#CDFF00]/60 transition-colors"
            />
          </div>

          <div>
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 hover:border-[#CDFF00]/40 text-sm text-gray-300 transition-colors"
            >
              <Paperclip className="w-4 h-4 text-gray-500 shrink-0" />
              <span className="truncate">{attachment ? attachment.name : 'Attach a CV or portfolio (optional)'}</span>
            </button>
            {/* The server's upload allowlist accepts images and video, so a PDF CV is
                refused with a clear message rather than silently dropped. */}
            <input
              ref={fileRef} type="file" accept="image/*,video/*" hidden
              onChange={(e) => { setAttachment(e.target.files?.[0] || null); e.target.value = ''; }}
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2 text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="text-xs font-medium">{error}</span>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-white/10 shrink-0">
          <button
            onClick={submit} disabled={submitting}
            className="w-full py-3 rounded-xl bg-[#CDFF00] text-black font-black text-[11px] uppercase tracking-widest hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
              : <><Zap className="w-4 h-4" /> Send application</>}
          </button>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
}
