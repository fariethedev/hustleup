import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ShieldCheck, Lock, User, Mail, Phone } from 'lucide-react';
import { formatPrice } from '../utils/constants';
import { useShopProduct } from '../hooks/useShops';
import SmartImage from '../components/SmartImage';
import PaymentMethodPicker from '../components/PaymentMethodPicker';
import { findMethod } from '../utils/paymentMethods';
import { ApplePayMark, PayPalMark, VisaMark, MastercardMark } from '../components/PaymentBrands';

const STORAGE_KEY = 'hustleup_shop_checkout_draft';

/**
 * Checkout for a single shop product.
 *
 * Deliberately the same shape as the cart checkout: numbered steps on the left, a summary
 * that stays in view on the right, the same payment picker, and the same wording for the
 * money. Buying one item from a storefront and checking out a full cart used to look like
 * two different products.
 */
export default function ShopCheckout() {
  const { id, productId } = useParams();
  const navigate = useNavigate();
  const { shop, product, loading, notFound } = useShopProduct(id, productId);
  const [customer, setCustomer] = useState({ fullName: '', email: '', phone: '', paymentMethod: 'paypal' });

  const draft = useMemo(() => {
    try {
      return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}');
    } catch {
      return {};
    }
  }, []);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 mt-8">
        <div className="h-96 rounded-2xl bg-white/[0.03] border border-white/5 animate-pulse" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="text-center">
          <h2 className="text-2xl font-heading font-bold text-white mb-2">Checkout unavailable</h2>
          <p className="text-sm text-gray-400 mb-5">This product is no longer on sale.</p>
          <Link to="/explore/shops" className="px-6 py-3 rounded-xl bg-[#CDFF00] text-black font-bold">Browse shops</Link>
        </div>
      </div>
    );
  }

  const quantity = Number(draft.quantity) || 1;
  const unitPrice = draft.offer ? Number(draft.offer) : Number(product.price);
  const total = unitPrice * quantity;

  const selected = findMethod(customer.paymentMethod);
  const canSubmit = !!(customer.fullName && customer.email);
  // Names the specific blocker so a disabled pay button is never a mystery.
  const missing = [
    !customer.fullName && 'name',
    !customer.email && 'email address',
  ].filter(Boolean).join(' and ');

  const placeOrder = () => {
    const payload = {
      shopId: shop.id,
      productId: product.id,
      quantity,
      unitPrice,
      total,
      notes: draft.notes || '',
      customer,
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    navigate(`/shop/${shop.slug || shop.id}/product/${product.id}/confirmation`);
  };

  const field = (key, placeholder, type, Icon) => (
    <div className="relative">
      <Icon className="w-4 h-4 text-gray-600 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      <input
        type={type}
        value={customer[key]}
        onChange={(e) => setCustomer((c) => ({ ...c, [key]: e.target.value }))}
        placeholder={placeholder}
        className="w-full rounded-xl bg-black/40 border border-white/10 pl-10 pr-4 py-3 text-sm text-white placeholder-gray-600 outline-none focus:border-[#CDFF00]/60 focus:bg-black/60 transition-colors"
      />
    </div>
  );

  return (
    <div className="min-h-screen text-white pt-4 pb-10">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <Link
          to={`/shop/${shop.slug || shop.id}/product/${product.id}/negotiate`}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to negotiation
        </Link>

        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-center mb-6">
            <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">Checkout</h1>
            <p className="inline-flex items-center gap-1.5 text-[11px] text-gray-500 font-bold mt-1.5">
              <Lock className="w-3 h-3" /> Encrypted · {shop.name}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_0.85fr] gap-4">
            {/* ── Left: details + payment ── */}
            <div className="space-y-4">
              <section className="rounded-2xl border border-white/10 bg-[#0E0E0E] p-5">
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-6 h-6 rounded-full bg-[#CDFF00] text-black text-[11px] font-black flex items-center justify-center">1</span>
                  <h2 className="text-xs font-black text-white uppercase tracking-widest">Your details</h2>
                </div>
                <div className="space-y-2.5">
                  {field('fullName', 'Full name', 'text', User)}
                  {field('email', 'Email address', 'email', Mail)}
                  {field('phone', 'Phone number (optional)', 'tel', Phone)}
                </div>
              </section>

              <section className="rounded-2xl border border-white/10 bg-[#0E0E0E] p-5">
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-6 h-6 rounded-full bg-[#CDFF00] text-black text-[11px] font-black flex items-center justify-center">2</span>
                  <h2 className="text-xs font-black text-white uppercase tracking-widest">Payment method</h2>
                </div>
                <PaymentMethodPicker
                  value={customer.paymentMethod}
                  onChange={(methodId) => setCustomer((c) => ({ ...c, paymentMethod: methodId }))}
                />
              </section>
            </div>

            {/* ── Right: summary, in view while the form is filled ── */}
            <aside className="rounded-2xl border border-white/10 bg-[#0E0E0E] p-5 h-fit lg:sticky lg:top-20">
              <h2 className="text-xs font-black text-white uppercase tracking-widest mb-4">Order summary</h2>

              <div className="flex items-center gap-3 pb-3">
                <div className="w-14 h-14 rounded-xl overflow-hidden bg-black/40 border border-white/10 shrink-0">
                  <SmartImage src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white truncate">{product.name}</p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 truncate">{shop.name}</p>
                </div>
              </div>

              <div className="border-t border-white/10 pt-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">Unit price</span>
                  <span className="text-white font-bold">{formatPrice(unitPrice, product.currency)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">Quantity</span>
                  <span className="text-white font-bold">{quantity}</span>
                </div>
                {/* Stated outright rather than left as a dash — an unexplained "Fees" line is
                    exactly what makes people brace for a surprise on the next screen. */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">Fees</span>
                  <span className="text-[#CDFF00] font-bold">Included</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">Paying with</span>
                  <span className="text-white font-bold">{selected?.label}</span>
                </div>
                <div className="flex items-center justify-between pt-2.5 border-t border-white/5">
                  <span className="text-white font-black uppercase tracking-widest text-xs">Total</span>
                  <span className="text-[#CDFF00] text-2xl font-black">{formatPrice(total, product.currency)}</span>
                </div>
                <p className="text-[10px] text-gray-500 leading-relaxed">
                  This is the final amount. Nothing is added at the next step.
                </p>
              </div>

              {missing && (
                <p className="mt-4 -mb-1 text-[11px] font-bold text-gray-400">
                  Add your {missing} to continue.
                </p>
              )}

              <button
                type="button"
                onClick={placeOrder}
                disabled={!canSubmit}
                className="mt-4 w-full py-3.5 rounded-xl bg-[#CDFF00] text-black font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 active:scale-95 transition-all shadow-[0_8px_24px_rgba(205,255,0,0.22)]"
              >
                <Lock className="w-3.5 h-3.5" /> Review order
              </button>

              {/* This flow genuinely doesn't charge yet, so the button promises a review step
                  rather than a payment. Saying "Pay now" here would be a lie. */}
              <div className="mt-3 p-3 rounded-xl bg-black/40 border border-white/5">
                <div className="flex items-center gap-1.5 text-[#CDFF00] text-[10px] font-black uppercase tracking-widest">
                  <ShieldCheck className="w-3.5 h-3.5" /> Nothing charged yet
                </div>
                <p className="text-[11px] text-gray-500 mt-1.5 leading-relaxed">
                  You&apos;ll get a final review before any payment is taken.
                </p>
              </div>

              <div className="mt-3 flex items-center justify-center gap-2 opacity-70">
                <span className="h-6 px-1.5 rounded bg-white flex items-center"><VisaMark className="h-3 w-auto" /></span>
                <span className="h-6 px-1.5 rounded bg-white flex items-center"><MastercardMark className="h-3.5 w-auto" /></span>
                <span className="h-6 px-1.5 rounded bg-white flex items-center"><ApplePayMark className="h-3.5 w-auto" /></span>
                <span className="h-6 px-1.5 rounded bg-white flex items-center"><PayPalMark className="h-3 w-auto" /></span>
              </div>
            </aside>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
