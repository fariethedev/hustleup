import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, HandCoins, MessageSquareText, ShoppingBag } from 'lucide-react';
import { formatPrice } from '../utils/constants';
import { getProductByShopAndProductId } from '../utils/shopData';

const STORAGE_KEY = 'hustleup_shop_checkout_draft';

export default function ShopNegotiation() {
  const { id, productId } = useParams();
  const navigate = useNavigate();
  const entry = getProductByShopAndProductId(id, productId);
  const [quantity, setQuantity] = useState(1);
  const [offer, setOffer] = useState('');
  const [notes, setNotes] = useState('');

  const baseTotal = useMemo(() => {
    if (!entry) return 0;
    return Number(entry.product.price) * quantity;
  }, [entry, quantity]);

  if (!entry) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="text-center">
          <h2 className="text-2xl font-heading font-bold text-white mb-2">Product not found</h2>
          <Link to="/" className="px-6 py-3 rounded-xl bg-[#CDFF00] text-black font-bold">Back home</Link>
        </div>
      </div>
    );
  }

  const { shop, product } = entry;

  const continueToCheckout = () => {
    const draft = {
      shopId: shop.id,
      productId: product.id,
      quantity,
      offer: offer ? Number(offer) : null,
      notes,
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    navigate(`/shop/${shop.id}/product/${product.id}/checkout`);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 mt-8">
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
        <Link to={`/shop/${shop.id}`} className="inline-flex items-center gap-2 text-sm font-bold text-gray-400 hover:text-white transition-colors mb-8">
          <ArrowLeft className="w-4 h-4" /> Back to {shop.name}
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-8">
          <div className="rounded-[2rem] border border-white/10 bg-black/50 overflow-hidden">
            <div className="h-64 flex items-center justify-center text-8xl" style={{ background: shop.accentBg }}>
              {product.image}
            </div>
            <div className="p-8">
              <span className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-[0.24em] text-white mb-4" style={{ background: shop.accentColor }}>
                <ShoppingBag className="w-3.5 h-3.5" /> {product.category}
              </span>
              <h1 className="text-3xl sm:text-4xl font-heading font-extrabold text-white mb-3">{product.name}</h1>
              <p className="text-gray-400 leading-relaxed">
                Start with the listed price or send a negotiated amount before checkout. This step is set up so you can slot in seller approval logic later if you want.
              </p>
              <div className="mt-8 grid grid-cols-2 gap-4">
                <div className="rounded-2xl border border-white/10 bg-[#121212] p-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.24em] text-gray-500">Listed Price</div>
                  <div className="mt-2 text-2xl font-black text-white">{formatPrice(product.price, product.currency)}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-[#121212] p-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.24em] text-gray-500">Shop</div>
                  <div className="mt-2 text-2xl font-black text-white">{shop.name}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-[#111111] p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-[#CDFF00] text-black flex items-center justify-center">
                <HandCoins className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-heading font-extrabold text-white">Negotiate Order</h2>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-gray-500 mt-1">Prepare your checkout terms</p>
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-xs font-black uppercase tracking-[0.24em] text-gray-500 mb-2">Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                  className="w-full rounded-2xl bg-[#1E1E1E] border border-white/10 px-5 py-4 text-white outline-none focus:border-[#CDFF00]"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-[0.24em] text-gray-500 mb-2">Offer Per Item</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={offer}
                  onChange={(e) => setOffer(e.target.value)}
                  placeholder={`${product.price}`}
                  className="w-full rounded-2xl bg-[#1E1E1E] border border-white/10 px-5 py-4 text-white outline-none focus:border-[#CDFF00]"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-[0.24em] text-gray-500 mb-2">Notes For Seller</label>
                <textarea
                  rows={5}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Delivery notes, customizations, negotiation context..."
                  className="w-full rounded-2xl bg-[#1E1E1E] border border-white/10 px-5 py-4 text-white outline-none focus:border-[#CDFF00] resize-none"
                />
              </div>

              <div className="rounded-[1.5rem] border border-white/10 bg-black/50 p-5">
                <div className="flex items-center gap-2 text-[#CDFF00] text-sm font-black uppercase tracking-[0.22em] mb-3">
                  <MessageSquareText className="w-4 h-4" /> Summary
                </div>
                <div className="flex items-center justify-between text-sm text-gray-400">
                  <span>Listed total</span>
                  <span className="text-white font-bold">{formatPrice(baseTotal, product.currency)}</span>
                </div>
                {offer && Number(offer) > 0 && (
                  <div className="flex items-center justify-between text-sm text-gray-400 mt-2">
                    <span>Your offer total</span>
                    <span className="text-[#CDFF00] font-bold">{formatPrice(Number(offer) * quantity, product.currency)}</span>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={continueToCheckout}
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-[#CDFF00] px-6 py-4 text-sm font-black uppercase tracking-[0.24em] text-black hover:bg-[#dcff58] transition-all"
              >
                Continue To Checkout <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
