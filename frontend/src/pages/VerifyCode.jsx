import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MailCheck, Loader2, ArrowRight, RotateCcw, CheckCircle2 } from 'lucide-react';
import { authApi, dispatchToast } from '../api/client';
import { useDispatch } from 'react-redux';
import { sessionRestored } from '../store/authSlice';

const LENGTH = 6;
const RESEND_COOLDOWN = 30; // seconds

/**
 * Email confirmation by six-digit code.
 *
 * Replaces the click-a-link flow: a code can be typed on the device the person is already
 * holding, which matters because sign-up usually happens on a phone where opening a link
 * from a mail app bounces you out of the session you just created.
 *
 * The address is carried in router state from registration, and falls back to a query
 * param so the screen still works if the email is opened on a different device.
 */
export default function VerifyCode() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { state } = useLocation();

  const email = useMemo(() => {
    if (state?.email) return state.email;
    return new URLSearchParams(window.location.search).get('email') || '';
  }, [state]);

  const [digits, setDigits] = useState(Array(LENGTH).fill(''));
  const [submitting, setSubmitting] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const inputs = useRef([]);

  const code = digits.join('');

  useEffect(() => { inputs.current[0]?.focus(); }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const setDigit = (i, value) => {
    // Strip anything non-numeric so a pasted "123 456" or an autofilled code still lands.
    const clean = value.replace(/\D/g, '');
    if (!clean) {
      setDigits((d) => d.map((x, idx) => (idx === i ? '' : x)));
      return;
    }
    setDigits((d) => {
      const next = [...d];
      // A paste drops several characters into one box — spread them across the row.
      for (let k = 0; k < clean.length && i + k < LENGTH; k++) next[i + k] = clean[k];
      return next;
    });
    const land = Math.min(i + clean.length, LENGTH - 1);
    inputs.current[land]?.focus();
  };

  const onKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      inputs.current[i - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && i > 0) inputs.current[i - 1]?.focus();
    if (e.key === 'ArrowRight' && i < LENGTH - 1) inputs.current[i + 1]?.focus();
  };

  const submit = async (value = code) => {
    if (value.length !== LENGTH || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await authApi.verifyCode(email, value);

      // Verifying is now what creates the session — registration deliberately withholds it
      // until the address is confirmed — so the tokens arrive here and have to be stored, or
      // the person lands on /onboarding signed out and is bounced to the login form.
      const { accessToken, refreshToken, role, fullName, userId } = res.data || {};
      if (accessToken) {
        localStorage.setItem('hustleup_token', accessToken);
        if (refreshToken) localStorage.setItem('hustleup_refresh', refreshToken);
        const userData = { id: userId, email, fullName, role, onboardingCompleted: true };
        localStorage.setItem('hustleup_user', JSON.stringify(userData));
        dispatch(sessionRestored(userData));
      }

      setVerified(true);
      dispatchToast(res.data?.alreadyVerified ? 'Already verified' : 'Email confirmed', 'success');
      setTimeout(() => navigate(accessToken ? '/onboarding' : '/login'), 1200);
    } catch (e) {
      setError(e.response?.data?.error || 'That code is invalid or has expired');
      setDigits(Array(LENGTH).fill(''));
      inputs.current[0]?.focus();
    } finally {
      setSubmitting(false);
    }
  };

  // Auto-submit on the sixth digit — making someone reach for a button after typing the
  // last character is a pointless extra step.
  useEffect(() => {
    if (code.length === LENGTH && !submitting && !verified) submit(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const resend = async () => {
    if (cooldown > 0) return;
    setCooldown(RESEND_COOLDOWN);
    setError('');
    try {
      await authApi.resendCode(email);
      dispatchToast('New code sent — check your inbox', 'success');
    } catch {
      dispatchToast('Could not send a new code', 'error');
    }
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] md:min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md text-center"
      >
        <div className="w-14 h-14 rounded-2xl bg-[#CDFF00]/10 border border-[#CDFF00]/25 flex items-center justify-center mx-auto mb-5">
          {verified
            ? <CheckCircle2 className="w-7 h-7 text-[#CDFF00]" />
            : <MailCheck className="w-7 h-7 text-[#CDFF00]" />}
        </div>

        <h1 className="text-2xl font-black text-white uppercase tracking-tight mb-2">
          {verified ? 'Email confirmed' : 'Check your email'}
        </h1>
        <p className="text-sm text-gray-400 mb-7 leading-relaxed">
          {verified
            ? 'Taking you to your profile setup…'
            : <>We sent a 6-digit code to{' '}
                <span className="text-white font-bold break-all">{email || 'your email'}</span>.</>}
        </p>

        {!verified && (
          <>
            <div className="flex items-center justify-center gap-2 sm:gap-2.5 mb-4" role="group" aria-label="Verification code">
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => { inputs.current[i] = el; }}
                  value={d}
                  onChange={(e) => setDigit(i, e.target.value)}
                  onKeyDown={(e) => onKeyDown(i, e)}
                  inputMode="numeric"
                  // Lets iOS/Android offer the code straight from the SMS/mail notification.
                  autoComplete="one-time-code"
                  maxLength={LENGTH}
                  aria-label={`Digit ${i + 1}`}
                  disabled={submitting}
                  className={`w-11 h-14 sm:w-12 sm:h-16 rounded-2xl bg-black/40 border text-center text-2xl font-black text-white outline-none transition-all disabled:opacity-50 ${
                    error
                      ? 'border-red-500/60 focus:border-red-500'
                      : d
                        ? 'border-[#CDFF00]/60'
                        : 'border-white/15 focus:border-[#CDFF00]/60'
                  }`}
                />
              ))}
            </div>

            <div className="h-6 mb-3">
              {submitting && (
                <span className="inline-flex items-center gap-2 text-xs text-gray-400 font-bold">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking…
                </span>
              )}
              {error && !submitting && (
                <span className="text-xs text-red-400 font-bold">{error}</span>
              )}
            </div>

            <button
              onClick={() => submit()}
              disabled={code.length !== LENGTH || submitting}
              className="w-full py-3.5 rounded-2xl bg-[#CDFF00] text-black font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 active:scale-95 transition-all"
            >
              Confirm email <ArrowRight className="w-4 h-4" />
            </button>

            <div className="mt-5 flex flex-col items-center gap-2">
              <button
                onClick={resend}
                disabled={cooldown > 0}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Send a new code'}
              </button>
              <Link to="/dashboard" className="text-[11px] text-gray-600 hover:text-gray-400 transition-colors">
                Skip for now
              </Link>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
