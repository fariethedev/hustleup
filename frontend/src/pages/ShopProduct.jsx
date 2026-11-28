import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { MoveLeft, ShoppingBag, Check, ShieldPlus, Truck, Store, Minus, Plus, MessageCircle } from 'lucide-react';
import { formatPrice, displayCity } from '../utils/constants';
import { describeMethod } from '../utils/shipping';
import { useShopProduct } from '../hooks/useShops';
import { addToCart, closeCart, openCart, selectCartItems } from '../store/cartSlice';
import { selectUser } from '../store/authSlice';
import SmartImage from '../components/SmartImage';
import { uploadUrl } from '../config';

/**
 * A shop product's own page: photo, price, stock, delivery and the seller, with Add to cart
 * and Buy now. Product cards used to link straight to the checkout form, so tapping a product
 * to look at it dropped people into paying for it.
 */
export default function ShopProduct() {
  const { id, productId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const cartItems = useSelector(selectCartItems);
  const { shop, product, loading, notFound } = useShopProduct(id, productId);
  const [qty, setQty] = useState(1);

  if (loading) {
    return <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 mt-8"><div className="h-[28rem] rounded-2xl bg-white/[0.03] border border-white/5 animate-pulse" /></div>;
  }
  if (notFound) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="text-center">
          <h2 className="text-2xl font-heading font-bold text-white mb-2">Product unavailable</h2>
          <p className="text-sm text-gray-400 mb-5">This product is no longer on sale.</p>
          <Link to={`/shop/${id}`} className="px-6 py-3 rounded-xl bg-[#CDFF00] text-black font-bold">Back to the shop</Link>
        </div>
      </div>
    );
  }

  const listingId = `shop:${shop.id}:${product.id}`;
  const inCart = cartItems.some((item) => item.listingId === listingId);
  const own = user?.id && user.id === shop.ownerId;
  const stock = product.stockTracked ? product.stockQuantity : null;
  const soldOut = product.inStock === false || (stock != null && stock <= 0);
  const maxQty = stock != null ? Math.max(1, stock) : 99;
  const method = describeMethod(product.shippingMethod, true);
  const postage = Number(product.shippingPrice) || 0;
  const currency = product.currency || 'PLN';
  const image = product.imageUrl ? uploadUrl(product.imageUrl) : null;

  const line = () => ({
    listingId, shopSlug: shop.slug || shop.id, productId: product.id, stockQuantity: stock,
    title: product.name, price: Number(product.price), currency, quantity: qty, image: product.imageUrl,
    sellerId: shop.ownerId, sellerName: shop.name, shippingMethod: product.shippingMethod, shippingPrice: postage,
  });
  const add = () => { if (inCart) { dispatch(openCart()); return; } dispatch(addToCart(line())); };
  const buyNow = () => {
    if (!user) { navigate('/login'); return; }
    if (!inCart) dispatch(addToCart(line()));
    dispatch(closeCart());
    navigate('/checkout');
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6 pb-24">
      <Link to={`/shop/${shop.slug || shop.id}`} className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-5">
        <MoveLeft className="w-4 h-4" /> {shop.name}
      </Link>

      <div className="grid md:grid-cols-2 gap-6 md:gap-10">
        <div className="aspect-square rounded-3xl overflow-hidden bg-white/[0.04] border border-white/10">
          {image ? <SmartImage src={image} alt={product.name} className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center text-gray-600"><ShoppingBag className="w-12 h-12" /></div>}
        </div>

        <div className="flex flex-col gap-5">
          <div>
            {product.category && <p className="text-xs text-gray-500 mb-1">{product.category}</p>}
            <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight">{product.name}</h1>
            <p className="text-2xl font-bold text-white mt-3">{formatPrice(product.price, currency)}</p>
            {stock != null && <p className={`text-sm mt-1 ${soldOut ? 'text-red-300' : stock <= 5 ? 'text-[#CDFF00]' : 'text-gray-400'}`}>{soldOut ? 'Sold out' : `${stock} in stock`}</p>}
          </div>

          {product.description && <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">{product.description}</p>}

          {method && product.shippingMethod !== 'NONE' && (
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-white/[0.04] border border-white/10">
              <Truck className="w-5 h-5 text-gray-300 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-white">{method.label}{postage > 0 ? ` · ${formatPrice(postage, currency)}` : ' · Free'}</p>
                {method.hint && <p className="text-xs text-gray-400 mt-0.5">{method.hint}</p>}
              </div>
            </div>
          )}

          {own ? (
            <Link to="/dashboard?tab=shop" className="flex items-center justify-center min-h-12 rounded-xl border border-white/15 text-sm font-semibold text-white">This is your product. Edit it in your shop</Link>
          ) : soldOut ? (
            <div className="flex items-center justify-center min-h-12 rounded-xl bg-white/5 text-sm text-gray-400">Sold out</div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Quantity</span>
                <div className="flex items-center gap-3">
                  <button type="button" aria-label="One fewer" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={inCart || qty <= 1} className="w-9 h-9 rounded-full border border-white/15 flex items-center justify-center disabled:opacity-30"><Minus className="w-4 h-4" /></button>
                  <span className="w-8 text-center font-bold text-white">{qty}</span>
                  <button type="button" aria-label="One more" onClick={() => setQty((q) => Math.min(maxQty, q + 1))} disabled={inCart || qty >= maxQty} className="w-9 h-9 rounded-full border border-white/15 flex items-center justify-center disabled:opacity-30"><Plus className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={add} className={`flex flex-1 items-center justify-center gap-2 min-h-12 rounded-xl border text-sm font-semibold ${inCart ? 'border-[#CDFF00]/40 text-[#CDFF00]' : 'border-white/20 text-white hover:border-white/40'}`}>
                  {inCart ? <Check className="w-4 h-4" /> : <ShoppingBag className="w-4 h-4" />}{inCart ? 'In your cart' : 'Add to cart'}
                </button>
                <button type="button" onClick={buyNow} className="flex flex-1 items-center justify-center min-h-12 rounded-xl bg-white text-black text-sm font-semibold hover:bg-[#CDFF00]">Buy now</button>
              </div>
            </div>
          )}

          <p className="flex items-center gap-2 text-xs text-gray-400"><ShieldPlus className="w-4 h-4" /> Buyer protection: the seller is paid only after you confirm it arrived.</p>

          <Link to={`/shop/${shop.slug || shop.id}`} className="flex items-center gap-3 p-4 rounded-2xl bg-white/[0.04] border border-white/10 hover:border-white/25">
            <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center shrink-0"><Store className="w-5 h-5 text-white" /></div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white truncate">{shop.name}</p>
              <p className="text-xs text-gray-400 truncate">{[displayCity(shop.city), shop.rating > 0 ? `${Number(shop.rating).toFixed(1)} rating` : null].filter(Boolean).join(' · ') || 'Visit shop'}</p>
            </div>
            {!own && shop.ownerId && <button type="button" onClick={(e) => { e.preventDefault(); navigate(`/dm/${shop.ownerId}`); }} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/15 text-xs text-white"><MessageCircle className="w-4 h-4" />Message</button>}
          </Link>
        </div>
      </div>
    </div>
  );
}
