import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, CreditCard, Landmark, MailCheck, ShieldCheck, Wallet } from 'lucide-react';
import { formatPrice } from '../utils/constants';
import { getProductByShopAndProductId } from '../utils/shopData';

const STORAGE_KEY = 'hustleup_shop_checkout_draft';

const PAYMENT_METHODS = [
  { id: 'stripe', label: 'Stripe', description: 'Primary gateway hook for cards and wallets.', icon: CreditCard },
  { id: 'blik', label: 'BLIK', description: 'Fast Polish mobile checkout flow.', icon: Landmark },
  { id: 'apple_pay', label: 'Apple Pay', description: 'One-tap wallet checkout.', icon: Wallet },
  { id: 'card', label: 'Card', description: 'Direct card capture flow.', icon: CreditCard },
];

export default function ShopCheckout() {
  const { id, productId } = useParams();
  const navigate = useNavigate();
  const entry = getProductByShopAndProductId(id, productId);
  const [customer, setCustomer] = useState({ fullName: '', email: '', phone: '', paymentMethod: 'stripe' });

  const draft = useMemo(() => {
    try {
      return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}');
    } catch {
      return {};
    }
  }, []);

  if (!entry) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="text-center">
          <h2 className="text-2xl font-heading font-bold text-white mb-2">Checkout unavailable</h2>
          <Link to="/" className="px-6 py-3 rounded-xl bg-[#CDFF00] text-black font-bold">Back home</Link>
        </div>
      </div>
    );
  }

  const { shop, product } = entry;
  const quantity = Number(draft.quantity) || 1;
  const unitPrice = draft.offer ? Number(draft.offer) : Number(product.price);
  const total = unitPrice * quantity;

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
    navigate(`/shop/${shop.id}/product/${product.id}/confirmation`);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 mt-8">
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
        <Link to={`/shop/${shop.id}/product/${product.id}/negotiate`} className="inline-flex items-center gap-2 text-sm font-bold text-gray-400 hover:text-white transition-colors mb-8">
          <ArrowLeft className="w-4 h-4" /> Back to negotiation
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-[0.95fr_1.05fr] gap-8">
          <div className="rounded-[2rem] border border-white/10 bg-[#111111] p-8">
            <h2 className="text-2xl font-heading font-extrabold text-white mb-6">Checkout Setup</h2>
            <div className="space-y-4">
              <input
                type="text"
                value={customer.fullName}
                onChange={(e) => setCustomer((current) => ({ ...current, fullName: e.target.value }))}
                placeholder="Full name"
                className="w-full rounded-2xl bg-[#1E1E1E] border border-white/10 px-5 py-4 text-white outline-none focus:border-[#CDFF00]"
              />
              <input
                type="email"
                value={customer.email}
                onChange={(e) => setCustomer((current) => ({ ...current, email: e.target.value }))}
                placeholder="Email address"
                className="w-full rounded-2xl bg-[#1E1E1E] border border-white/10 px-5 py-4 text-white outline-none focus:border-[#CDFF00]"
              />
              <input
                type="tel"
                value={customer.phone}
                onChange={(e) => setCustomer((current) => ({ ...current, phone: e.target.value }))}
                placeholder="Phone number"
                className="w-full rounded-2xl bg-[#1E1E1E] border border-white/10 px-5 py-4 text-white outline-none focus:border-[#CDFF00]"
              />
            </div>

            <div className="mt-8">
              <h3 className="text-xs font-black uppercase tracking-[0.24em] text-gray-500 mb-4">Payment Method</h3>
              <div className="space-y-3">
                {PAYMENT_METHODS.map((method) => {
                  const Icon = method.icon;
                  const active = customer.paymentMethod === method.id;
                  return (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => setCustomer((current) => ({ ...current, paymentMethod: method.id }))}
                      className={`w-full rounded-2xl border p-4 text-left transition-all ${
                        active ? 'border-[#CDFF00] bg-[#CDFF00]/10' : 'border-white/10 bg-black/40 hover:border-white/25'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${active ? 'bg-[#CDFF00] text-black' : 'bg-[#1E1E1E] text-white'}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <div className={`text-sm font-black uppercase tracking-[0.2em] ${active ? 'text-[#CDFF00]' : 'text-white'}`}>{method.label}</div>
                          <div className="text-sm text-gray-500 mt-1">{method.description}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-black/50 p-8">
            <h2 className="text-2xl font-heading font-extrabold text-white mb-6">Order Summary</h2>
            <div className="rounded-[1.5rem] border border-white/10 bg-[#121212] p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.24em] text-gray-500">{shop.name}</div>
                  <div className="text-2xl font-black text-white mt-2">{product.name}</div>
                </div>
                <div className="text-5xl">{product.image}</div>
              </div>

              <div className="mt-6 space-y-3 text-sm">
                <div className="flex items-center justify-between text-gray-400">
                  <span>Quantity</span>
                  <span className="text-white font-bold">{quantity}</span>
                </div>
                <div className="flex items-center justify-between text-gray-400">
                  <span>Unit price</span>
                  <span className="text-white font-bold">{formatPrice(unitPrice, product.currency)}</span>
                </div>
                <div className="flex items-center justify-between text-gray-400">
                  <span>Selected payment</span>
                  <span className="text-white font-bold">{PAYMENT_METHODS.find((item) => item.id === customer.paymentMethod)?.label}</span>
                </div>
                <div className="flex items-center justify-between border-t border-white/10 pt-4 text-gray-400">
                  <span>Total</span>
                  <span className="text-[#CDFF00] text-2xl font-black">{formatPrice(total, product.currency)}</span>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-[#111111] p-5">
              <div className="flex items-center gap-2 text-[#CDFF00] text-sm font-black uppercase tracking-[0.22em]">
                <ShieldCheck className="w-4 h-4" /> Integration Ready
              </div>
              <p className="text-sm text-gray-400 leading-relaxed mt-3">
                This screen is ready for Stripe, BLIK, Apple Pay, card payment capture, and confirmation email triggers. Right now it advances to an order confirmation step without charging.
              </p>
            </div>

            <button
              type="button"
              onClick={placeOrder}
              disabled={!customer.fullName || !customer.email}
              className="mt-6 w-full rounded-2xl bg-[#CDFF00] px-6 py-4 text-sm font-black uppercase tracking-[0.24em] text-black disabled:opacity-50"
            >
              Continue To Confirmation
            </button>
            <div className="mt-4 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-gray-500">
              <MailCheck className="w-4 h-4" /> Confirmation email placeholder included
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
