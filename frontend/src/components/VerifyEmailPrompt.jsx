import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { MailWarning, CircleX, MoveRight } from 'lucide-react';

/**
 * Global, actionable prompt for the moment a buy/sell action is blocked because the
 * account hasn't confirmed its email address yet (see EmailVerificationGuard on the
 * backend). Login itself no longer blocks on this — an already-registered account signs
 * in normally, and only hears about verification here, at the point it actually matters.
 *
 * Triggered by `hustleup-verify-email-required`, dispatched from the axios response
 * interceptor in api/client.js for every endpoint EmailVerificationGuard protects, so one
 * listener covers all of them (and any added later) without each page wiring its own modal.
 *
 * Mounted once, globally, in App.jsx — same pattern as BookingAlertListener.
 */
export default function VerifyEmailPrompt() {
  const navigate = useNavigate();
  const location = useLocation();
  const [prompt, setPrompt] = useState(null); // { email, message }
  const [promptedPathname, setPromptedPathname] = useState(location.pathname);

  useEffect(() => {
    const onRequired = (e) => setPrompt(e.detail || null);
    window.addEventListener('hustleup-verify-email-required', onRequired);
    return () => window.removeEventListener('hustleup-verify-email-required', onRequired);
  }, []);

  // A fresh navigation (e.g. dismissing to browse elsewhere) shouldn't leave a stale prompt
  // waiting to reappear if the same action is retried later on a different page. Reset
  // during render (the React-recommended way to adjust state on a prop change) rather than
  // in an effect, which would commit the old prompt for one extra frame before clearing it.
  if (location.pathname !== promptedPathname) {
    setPromptedPathname(location.pathname);
    setPrompt(null);
  }

  const dismiss = () => setPrompt(null);

  const verifyNow = () => {
    const email = prompt?.email;
    dismiss();
    // returnTo lets VerifyCode send an already-signed-in account back to what it was doing
    // (e.g. checkout) instead of the fresh-registration flow's /onboarding redirect.
    navigate('/verify-code', { state: { email, returnTo: location.pathname } });
  };

  return (
    <AnimatePresence>
      {prompt && (
        <div className="fixed inset-0 z-[500] flex items-end sm:items-center justify-center px-4 pb-6 sm:pb-4 pointer-events-none">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={dismiss}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm pointer-events-auto"
          />
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ type: 'spring', bounce: 0.35 }}
            className="relative w-full max-w-sm bg-[#0A0A0A] border border-[#CDFF00]/30 rounded-3xl shadow-[0_0_60px_rgba(205,255,0,0.15)] p-6 pointer-events-auto"
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-11 h-11 rounded-2xl bg-[#CDFF00]/10 border border-[#CDFF00]/30 flex items-center justify-center shrink-0">
                <MailWarning className="w-5 h-5 text-[#CDFF00]" />
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <p className="text-[10px] font-bold text-[#CDFF00] tracking-widest mb-1">
                  Verification needed
                </p>
                <h3 className="text-white font-bold text-sm leading-snug">
                  {prompt.message || 'Verify your email to continue on HustleSpace.'}
                </h3>
              </div>
              <button onClick={dismiss} className="p-1 -mt-1 -mr-1 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors shrink-0">
                <CircleX className="w-4 h-4" />
              </button>
            </div>

            <p className="text-sm text-gray-400 leading-relaxed mb-6">
              {prompt.email
                ? <>We'll send a fresh code to <span className="text-white font-bold break-all">{prompt.email}</span> — it only takes a moment.</>
                : "It only takes a moment, and you'll be right back to finish this."}
            </p>

            <div className="flex gap-2">
              <button
                onClick={dismiss}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-300 text-sm font-bold hover:bg-white/5 transition-all"
              >
                Not now
              </button>
              <button
                onClick={verifyNow}
                className="flex-1 py-2.5 rounded-xl bg-[#CDFF00] text-black text-sm font-bold hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
              >
                Verify now <MoveRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
