import { useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, ShoppingBag, MessageSquare, ArrowRight } from 'lucide-react';
import { formatPrice } from '../utils/constants';

export default function CheckoutConfirmation() {
  const { state } = useLocation();
  const { customer, items = [], total = 0, currency = 'GBP' } = state || {};

  return (
    <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center pt-20 pb-20 px-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-xl w-full text-center space-y-8"
      >
        {/* Icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 260 }}
          className="w-20 h-20 rounded-full bg-[#CDFF00] text-black flex items-center justify-center mx-auto shadow-[0_0_60px_rgba(205,255,0,0.4)]"
        >
          <CheckCircle className="w-10 h-10" />
        </motion.div>

        <div>
          <h1 className="text-4xl font-black text-white uppercase tracking-tight mb-3">Order Placed!</h1>
          <p className="text-gray-400 font-medium">
            {customer?.fullName ? `Thanks, ${customer.fullName}! ` : ''}
            Your booking{items.length > 1 ? 's have' : ' has'} been sent to the sellers.
          </p>
        </div>

        {/* Order Items */}
        <div className="rounded-[2rem] border border-white/10 bg-[#111] p-6 text-left space-y-3">
          {items.map((item) => (
            <div key={item.listingId} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl overflow-hidden bg-gray-800 shrink-0">
                  {item.image ? (
                    <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                  ) : (
                    <ShoppingBag className="w-4 h-4 text-gray-600 m-auto mt-3" />
                  )}
                </div>
                <div>
                  <p className="text-white font-black text-sm">{item.title}</p>
                  <p className="text-gray-500 text-xs">Qty {item.quantity}</p>
                </div>
              </div>
              <p className="text-[#CDFF00] font-black text-sm">
                {formatPrice((item.negotiatedPrice ?? item.price) * item.quantity, item.currency)}
              </p>
            </div>
          ))}
          <div className="pt-4 border-t border-white/10 flex items-center justify-between">
            <span className="text-white font-black uppercase tracking-widest text-sm">Total</span>
            <span className="text-[#CDFF00] text-xl font-black">{formatPrice(total, currency)}</span>
          </div>
        </div>

        {/* Next steps */}
        <div className="grid grid-cols-2 gap-4">
          <Link
            to="/dm"
            className="flex items-center justify-center gap-2 py-4 rounded-2xl border border-white/10 bg-white/5 text-white font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-colors"
          >
            <MessageSquare className="w-4 h-4" /> Messages
          </Link>
          <Link
            to="/explore"
            className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-[#CDFF00] text-black font-black text-xs uppercase tracking-widest hover:bg-[#d9ff33] transition-colors"
          >
            Keep Shopping <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
