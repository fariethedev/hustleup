import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, Mail, Receipt, ShieldCheck } from 'lucide-react';
import { formatPrice } from '../utils/constants';
import { getProductByShopAndProductId } from '../utils/shopData';

const STORAGE_KEY = 'hustleup_shop_checkout_draft';

export default function ShopConfirmation() {
  const { id, productId } = useParams();
  const entry = getProductByShopAndProductId(id, productId);

  let draft = {};
  try {
    draft = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    draft = {};
  }

  if (!entry) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="text-center">
          <h2 className="text-2xl font-heading font-bold text-white mb-2">Order not found</h2>
          <Link to="/" className="px-6 py-3 rounded-xl bg-[#CDFF00] text-black font-bold">Back home</Link>
        </div>
      </div>
    );
  }

  const { shop, product } = entry;
  const quantity = Number(draft.quantity) || 1;
  const total = Number(draft.total) || Number(product.price);
  const paymentMethod = draft.customer?.paymentMethod || 'stripe';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 mt-10">
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="rounded-[2.5rem] border border-white/10 bg-[#111111] p-8 sm:p-10">
        <div className="text-center mb-10">
          <div className="w-20 h-20 rounded-full bg-[#CDFF00]/10 border border-[#CDFF00]/30 text-[#CDFF00] flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-heading font-extrabold text-white">Order Ready For Payment Integration</h1>
          <p className="text-gray-400 mt-3 max-w-2xl mx-auto">
            The negotiation and checkout flow is now in place. The next step is wiring your live payment processors and transactional emails into this confirmation handoff.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-[1.75rem] border border-white/10 bg-black/50 p-6">
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-gray-500">Order Summary</div>
            <div className="text-2xl font-black text-white mt-3">{product.name}</div>
            <div className="text-sm text-gray-400 mt-1">{shop.name}</div>
            <div className="mt-6 space-y-3 text-sm">
              <div className="flex items-center justify-between text-gray-400">
                <span>Quantity</span>
                <span className="text-white font-bold">{quantity}</span>
              </div>
              <div className="flex items-center justify-between text-gray-400">
                <span>Payment method</span>
                <span className="text-white font-bold uppercase">{paymentMethod.replace('_', ' ')}</span>
              </div>
              <div className="flex items-center justify-between text-gray-400">
                <span>Total</span>
                <span className="text-[#CDFF00] font-black">{formatPrice(total, product.currency)}</span>
              </div>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-white/10 bg-black/50 p-6">
            <div className="flex items-center gap-2 text-[#CDFF00] text-sm font-black uppercase tracking-[0.22em]">
              <Receipt className="w-4 h-4" /> Next integrations
            </div>
            <div className="mt-5 space-y-4 text-sm text-gray-400">
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-4 h-4 text-[#CDFF00] mt-0.5 shrink-0" />
                <span>Hook Stripe checkout sessions or payment intents into the final submit action.</span>
              </div>
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-4 h-4 text-[#CDFF00] mt-0.5 shrink-0" />
                <span>Add BLIK, Apple Pay, and direct card availability inside the payment-method layer.</span>
              </div>
              <div className="flex items-start gap-3">
                <Mail className="w-4 h-4 text-[#CDFF00] mt-0.5 shrink-0" />
                <span>Trigger confirmation emails for buyer and seller after successful payment or negotiation approval.</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
          <Link to={`/shop/${shop.id}`} className="px-8 py-4 rounded-2xl border border-white/10 text-white font-black uppercase tracking-[0.24em] text-sm text-center">
            Back To Shop
          </Link>
          <Link to="/dm" className="px-8 py-4 rounded-2xl bg-[#CDFF00] text-black font-black uppercase tracking-[0.24em] text-sm text-center">
            Go To DMs
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
