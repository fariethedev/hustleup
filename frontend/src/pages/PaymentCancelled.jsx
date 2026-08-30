import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { XCircle, ArrowRight } from 'lucide-react';

/**
 * Where Stripe sends a buyer who backed out of Premium checkout.
 *
 * <p>Like the success route, this had no page behind it — the catch-all dropped anyone who
 * cancelled onto the home page, which reads as the app having lost their place rather than as
 * a cancellation they chose. Nothing was charged, and saying so plainly is the whole job.
 */
export default function PaymentCancelled() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16 text-white font-sans">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md text-center p-8 rounded-3xl bg-white/[0.03] border border-white/10"
      >
        <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-6">
          <XCircle className="w-8 h-8 text-gray-400" />
        </div>

        <h1 className="text-2xl font-heading font-black tracking-tight mb-3">Checkout cancelled</h1>
        <p className="text-sm text-gray-400 leading-relaxed">
          Nothing was charged and your account is unchanged. You can pick up where you left off
          whenever you like.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row gap-3">
          <Link
            to="/dashboard"
            className="flex-1 px-6 py-3 rounded-full bg-[#CDFF00] text-black text-sm font-bold hover:brightness-110 active:scale-95 transition-all inline-flex items-center justify-center gap-2"
          >
            Back to dashboard <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            to="/explore"
            className="flex-1 px-6 py-3 rounded-full border border-white/15 text-white text-sm font-bold hover:bg-white/5 hover:border-white/30 transition-all inline-flex items-center justify-center"
          >
            Keep browsing
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
