import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Crown, Loader2, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { subscriptionsApi } from '../api/client';

/**
 * Where Stripe sends the buyer after a successful Premium checkout.
 *
 * <p>This route did not exist. Stripe's success_url has always pointed at
 * <code>/payment/success</code>, and with no matching route the catch-all redirected the buyer
 * to the home page — no confirmation, no receipt, no sign that anything had happened. Worse,
 * the only thing that granted Premium was the webhook, so wherever that was not registered or
 * could not reach the server the money was taken and the account never changed.
 *
 * <p>So this page does not just report; it confirms. It hands the session id back to the
 * server, which asks Stripe whether that session was really paid and activates the plan. The
 * webhook remains the authority when it arrives — the grant is keyed on the session id, so
 * whichever path gets there second changes nothing.
 */
export default function PaymentSuccess() {
  const [params] = useSearchParams();
  const sessionId = params.get('session_id');

  const [state, setState] = useState({ status: 'confirming', message: '' });

  useEffect(() => {
    if (!sessionId) {
      setState({ status: 'error', message: 'This link is missing its payment reference.' });
      return;
    }
    let cancelled = false;
    subscriptionsApi.confirm(sessionId)
      .then((r) => {
        if (cancelled) return;
        setState(r.data?.premiumActive
          ? { status: 'active', message: r.data.message }
          // Not an error: an async payment method may still be clearing, in which case the
          // webhook will finish the job. Saying so is better than a spinner that never ends.
          : { status: 'pending', message: r.data?.message || 'Payment received — still processing.' });
      })
      .catch((e) => {
        if (cancelled) return;
        setState({
          status: 'error',
          message: e.response?.data?.error || 'We could not confirm that payment automatically.',
        });
      });
    return () => { cancelled = true; };
  }, [sessionId]);

  const view = {
    confirming: {
      icon: <Loader2 className="w-8 h-8 text-black animate-spin" />,
      title: 'Confirming your payment',
      body: 'One moment while we activate your account.',
    },
    active: {
      icon: <Crown className="w-8 h-8 text-black" />,
      title: 'Premium is active',
      body: 'Bond, priority placement and the rest of the paid features are unlocked on your account.',
    },
    pending: {
      icon: <CheckCircle2 className="w-8 h-8 text-black" />,
      title: 'Payment received',
      body: 'Your payment is still clearing with the bank. Premium switches on automatically the moment it settles — nothing else for you to do.',
    },
    error: {
      icon: <AlertCircle className="w-8 h-8 text-black" />,
      title: 'We could not confirm this yet',
      body: 'If you were charged, your Premium will still be applied. Contact us if it has not appeared shortly.',
    },
  }[state.status];

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16 text-white font-sans">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md text-center p-8 rounded-3xl bg-white/[0.03] border border-white/10"
      >
        <div className="w-16 h-16 rounded-2xl bg-[#CDFF00] flex items-center justify-center mx-auto mb-6">
          {view.icon}
        </div>

        <h1 className="text-2xl font-heading font-black tracking-tight mb-3">{view.title}</h1>
        <p className="text-sm text-gray-400 leading-relaxed mb-2">{view.body}</p>
        {state.message && state.status !== 'active' && (
          <p className="text-xs text-gray-500 mb-2">{state.message}</p>
        )}

        <div className="mt-8 flex flex-col sm:flex-row gap-3">
          <Link
            to="/dashboard"
            className="flex-1 px-6 py-3 rounded-full bg-[#CDFF00] text-black text-sm font-bold hover:brightness-110 active:scale-95 transition-all inline-flex items-center justify-center gap-2"
          >
            Go to dashboard <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            to="/explore"
            className="flex-1 px-6 py-3 rounded-full border border-white/15 text-white text-sm font-bold hover:bg-white/5 hover:border-white/30 transition-all inline-flex items-center justify-center"
          >
            Explore
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
