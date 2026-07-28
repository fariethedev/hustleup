import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useDispatch } from 'react-redux';
import { ArrowLeft, ArrowRight, HandCoins, MessageSquareText, ShoppingBag } from 'lucide-react';
import { formatPrice, convertToPLN } from '../utils/constants';
import { getProductByShopAndProductId } from '../utils/shopData';
import { addToCart } from '../store/cartSlice';

export default function ShopNegotiation() {
  const { id, productId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
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
    const unitPrice = offer ? Number(offer) : Number(product.price);
    dispatch(addToCart({
      listingId: `shop:${shop.id}:${product.id}`,
      title: product.name,
      price: convertToPLN(product.price, product.currency),
      negotiatedPrice: offer ? convertToPLN(unitPrice, product.currency) : undefined,
      currency: 'PLN',
      emoji: product.image,
      sellerId: `shop:${shop.id}`,
      sellerName: shop.name,
      quantity,
      notes,
    }));
    navigate('/checkout');
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <Link to={`/shop/${shop.id}`} className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-white transition-colors mb-3">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to {shop.name}
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          {/* Left: product summary */}
          <div className="rounded-2xl border border-white/10 bg-black/50 overflow-hidden">
            <div className="h-36 flex items-center justify-center text-6xl" style={{ background: shop.accentBg }}>
              {product.image}
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-white" style={{ background: shop.accentColor }}>
                  <ShoppingBag className="w-3 h-3" /> {product.category}
                </span>
                <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">{shop.name}</span>
              </div>
              <h1 className="text-lg sm:text-xl font-heading font-extrabold text-white leading-tight">{product.name}</h1>
              <p className="text-xs text-gray-400 leading-relaxed mt-1">
                Buy at the listed price, or send the seller your own offer before checkout.
              </p>
              <div className="mt-3 flex items-center justify-between rounded-xl border border-white/10 bg-[#121212] px-4 py-2.5">
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-500">Listed price</span>
                <span className="text-xl font-black text-[#CDFF00]">{formatPrice(product.price, product.currency)}</span>
              </div>
            </div>
          </div>

          {/* Right: negotiation form */}
          <div className="rounded-2xl border border-white/10 bg-[#111111] p-4">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 rounded-xl bg-[#CDFF00] text-black flex items-center justify-center shrink-0">
                <HandCoins className="w-4.5 h-4.5" />
              </div>
              <div>
                <h2 className="text-base font-heading font-extrabold text-white leading-tight">Negotiate Order</h2>
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-gray-500">Prepare your checkout terms</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-gray-500 mb-1.5">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                    className="w-full rounded-xl bg-[#1E1E1E] border border-white/10 px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#CDFF00]"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-gray-500 mb-1.5">Offer per item</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={offer}
                    onChange={(e) => setOffer(e.target.value)}
                    placeholder={`${product.price}`}
                    className="w-full rounded-xl bg-[#1E1E1E] border border-white/10 px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#CDFF00]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-gray-500 mb-1.5">Notes for seller</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Delivery notes, customizations, negotiation context..."
                  className="w-full rounded-xl bg-[#1E1E1E] border border-white/10 px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#CDFF00] resize-none"
                />
              </div>

              <div className="rounded-xl border border-white/10 bg-black/50 px-4 py-3">
                <div className="flex items-center gap-1.5 text-[#CDFF00] text-[10px] font-black uppercase tracking-[0.2em] mb-2">
                  <MessageSquareText className="w-3.5 h-3.5" /> Summary
                </div>
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>Listed total</span>
                  <span className="text-white font-bold">{formatPrice(baseTotal, product.currency)}</span>
                </div>
                {offer && Number(offer) > 0 && (
                  <div className="flex items-center justify-between text-xs text-gray-400 mt-1.5">
                    <span>Your offer total</span>
                    <span className="text-[#CDFF00] font-bold">{formatPrice(Number(offer) * quantity, product.currency)}</span>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={continueToCheckout}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#CDFF00] px-5 py-3 text-xs font-black uppercase tracking-[0.2em] text-black hover:bg-[#dcff58] active:scale-[0.99] transition-all"
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
