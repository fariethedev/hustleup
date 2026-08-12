import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useDispatch, useSelector } from 'react-redux';
import { getShopById, SHOPS } from '../utils/shopData';
import { formatPrice, convertToPLN } from '../utils/constants';
import { addToCart, selectCartItems } from '../store/cartSlice';
import { useToast } from '../context/ToastContext';
import { Star, MapPin, ArrowLeft, ShoppingCart, Package, ChevronRight, Share2, Heart, Check, CalendarClock } from 'lucide-react';
import { useState, useMemo } from 'react';

// Shop categories whose products are appointments/sessions rather than physical goods
// (hair & beauty, skills & services) get a "book an appointment" slot picker instead
// of just an add-to-cart button.
const BOOKABLE_CATEGORIES = ['Beauty & Skincare', 'Skills & Services'];

// Builds 6 upcoming mock days of appointment slots for bookable shops.
function buildAvailability() {
  const times = ['09:00', '11:30', '14:00', '16:30'];
  return Array.from({ length: 6 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() + i + 1);
    return {
      key: date.toISOString().slice(0, 10),
      label: `${date.toLocaleDateString('en-GB', { weekday: 'short' })} ${date.getDate()}`,
      times,
    };
  });
}

export default function ShopDetail() {
  const { id } = useParams();
  const shop = getShopById(id);
  const [activeCategory, setActiveCategory] = useState('All');
  const dispatch = useDispatch();
  const cartItems = useSelector(selectCartItems);
  const [justAdded, setJustAdded] = useState(null);
  const { showToast } = useToast();

  const isBookable = !!shop && BOOKABLE_CATEGORIES.includes(shop.category);
  const availability = useMemo(() => (isBookable ? buildAvailability() : []), [isBookable]);
  const [selectedDay, setSelectedDay] = useState(0);
  const [selectedTime, setSelectedTime] = useState(null);

  const confirmSlot = (time) => {
    setSelectedTime(time);
    showToast(`Slot selected — ${availability[selectedDay].label}, ${time}`, 'success');
  };

  const addProductToCart = (e, product) => {
    e.preventDefault();
    e.stopPropagation();
    dispatch(addToCart({
      listingId: `shop:${shop.id}:${product.id}`,
      title: product.name,
      price: convertToPLN(product.price, product.currency),
      currency: 'PLN',
      emoji: product.image,
      sellerId: `shop:${shop.id}`,
      sellerName: shop.name,
    }));
    setJustAdded(product.id);
    setTimeout(() => setJustAdded((cur) => (cur === product.id ? null : cur)), 1500);
  };

  if (!shop) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="text-center">
          <Package className="w-16 h-16 mx-auto text-gray-300 mb-6 opacity-20" />
          <h2 className="text-2xl font-black text-white mb-2 uppercase tracking-tight">Shop not found</h2>
          <p className="text-gray-400 mb-6 font-medium italic">The premium storefront you seek is unavailable.</p>
          <Link to="/" className="px-8 py-3.5 rounded-2xl bg-[#CDFF00] text-black font-black uppercase tracking-widest hover:scale-105 transition-all">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const categories = ['All', ...new Set(shop.products.map(p => p.category))];
  const filteredProducts = activeCategory === 'All'
    ? shop.products
    : shop.products.filter(p => p.category === activeCategory);

  // Cross-sell: one product from each of a few other shops, and a handful of other shops.
  const otherShops = SHOPS.filter((s) => s.id !== shop.id).slice(0, 4);
  const suggestedProducts = otherShops
    .map((s) => ({ ...s.products[0], shopId: s.id, shopName: s.name, shopAccent: s.accentColor }))
    .slice(0, 4);

  return (
    <div className="min-h-screen text-white">
      {/* Immersive Shop Banner & Header */}
      <section className="relative h-[260px] sm:h-[320px] overflow-hidden">
        <motion.img
          initial={{ scale: 1.1 }}
          animate={{ scale: 1 }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
          src={shop.image}
          alt={shop.name}
          className="w-full h-full object-cover"
        />
        
        {/* Dynamic Multi-layered Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#050505] to-transparent" />
        
        {/* Navigation Bar Over Banner */}
        <div className="absolute top-16 left-0 right-0 px-6 sm:px-12 flex items-center justify-between z-20">
          <Link
            to="/"
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl glass-violet text-white font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-all active:scale-95"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Explorify
          </Link>
          <div className="flex gap-2">
            <button className="w-10 h-10 rounded-2xl glass-violet flex items-center justify-center hover:scale-110 transition-transform">
              <Share2 className="w-4.5 h-4.5" />
            </button>
            <button className="w-10 h-10 rounded-2xl glass-violet flex items-center justify-center hover:scale-110 transition-transform">
              <Heart className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>

        {/* Shop Info Main Focus */}
        <div className="absolute bottom-6 left-0 right-0 px-6 sm:px-12">
          <div className="max-w-7xl mx-auto flex flex-col items-start gap-2">
            <motion.span
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="px-4 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-[#CDFF00] glass-violet border-white/20"
            >
              {shop.category}
            </motion.span>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-3xl sm:text-5xl font-black text-white mb-1 tracking-tighter drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]"
            >
              {shop.name}
            </motion.h1>
            <motion.div
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               transition={{ delay: 0.3 }}
               className="flex flex-wrap items-center gap-6 text-gray-300 text-xs font-bold uppercase tracking-widest"
            >
              <span className="flex items-center gap-2">
                <div className="w-fit px-2 py-1 bg-[#CDFF00] text-black rounded-lg flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 fill-black" />
                  {shop.rating.toFixed(1)}
                </div>
                ({shop.reviewCount} <span className="opacity-50">Reviews</span>)
              </span>
              <span className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#CDFF00]" /> {shop.location}
              </span>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-6 sm:px-12 py-10">
        <div className="grid lg:grid-cols-[1fr_320px] gap-10 items-start">

          {/* Left Column: Feed & Explore */}
          <div>
            <div className="mb-8">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3">Store Mandate</h4>
              <p className="text-lg font-bold text-gray-200 leading-tight italic max-w-4xl opacity-80">
                "{shop.description}"
              </p>
            </div>

            {/* Breadcrumb Navigation */}
            <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-gray-500 mb-6">
              <Link to="/" className="hover:text-[#CDFF00] transition-colors">Marketplace</Link>
              <ChevronRight className="w-3 h-3" />
              <span className="text-[#CDFF00]">{shop.name}</span>
            </div>

            {/* Premium Category Filter Bar */}
            <div className="flex flex-wrap gap-3 mb-8 p-2 rounded-[32px] glass-strong w-fit border-white/5">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-8 py-3.5 rounded-[24px] text-[10px] font-black uppercase tracking-widest transition-all ${
                    activeCategory === cat
                      ? 'bg-[#CDFF00] text-black shadow-[0_0_20px_rgba(205,255,0,0.3)] scale-105'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* High-Impact Products Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
              {filteredProducts.map((product, i) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.5 }}
                  className="h-full"
                >
                  <Link
                    to={`/shop/${shop.id}/product/${product.id}/negotiate`}
                    className="group flex flex-col h-full rounded-[32px] overflow-hidden glass-strong bg-black/60 border border-white/10 hover:border-[#CDFF00]/40 transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_60px_rgba(0,0,0,0.8)]"
                  >
                  {/* Visual Presentation Area */}
                  <div
                    className="h-36 shrink-0 flex items-center justify-center text-6xl relative overflow-hidden bg-black/40 border-b border-white/5"
                  >
                    <span className="z-10 group-hover:scale-125 transition-transform duration-700 ease-out drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]">
                      {product.image}
                    </span>
                    {/* Dynamic Radial Background */}
                    <div
                      className="absolute inset-0 opacity-20 group-hover:opacity-40 transition-opacity duration-700"
                      style={{ background: `radial-gradient(circle at center, ${shop.accentColor} 0%, transparent 70%)` }}
                    />
                  </div>

                  <div className="p-5 flex flex-col flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-[#CDFF00] opacity-40">{product.category}</span>
                      <div className="h-px bg-white/10 flex-1" />
                    </div>
                    <h3 className="text-lg font-black text-white mb-3 leading-tight group-hover:text-[#CDFF00] transition-colors line-clamp-2 uppercase tracking-tighter">
                      {product.name}
                    </h3>
                    <div className="flex items-center justify-between mt-auto">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-0.5">Price Point</span>
                        <span className="text-2xl font-black text-white tracking-tighter">
                          {formatPrice(product.price, product.currency)}
                        </span>
                      </div>
                      <button
                        onClick={(e) => addProductToCart(e, product)}
                        className={`w-11 h-11 shrink-0 rounded-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-[0_10px_20px_rgba(205,255,0,0.2)] ${
                          justAdded === product.id || cartItems.some((i) => i.listingId === `shop:${shop.id}:${product.id}`)
                            ? 'bg-white text-black'
                            : 'bg-[#CDFF00] text-black'
                        }`}
                        title="Add to cart"
                      >
                        {justAdded === product.id || cartItems.some((i) => i.listingId === `shop:${shop.id}:${product.id}`) ? (
                          <Check className="w-5 h-5" />
                        ) : (
                          <ShoppingCart className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>
                  </Link>
                </motion.div>
              ))}
            </div>

            {filteredProducts.length === 0 && (
              <div className="text-center py-32 glass-strong rounded-[48px] border-dashed border-2 border-white/5">
                <Package className="w-16 h-16 mx-auto text-gray-500 mb-6 opacity-30" />
                <h3 className="text-xl font-black text-white mb-2 uppercase tracking-tighter">No items detected</h3>
                <button
                  onClick={() => setActiveCategory('All')}
                  className="text-xs font-black uppercase tracking-widest text-[#CDFF00] hover:text-white transition-colors"
                >
                  Return to all listings
                </button>
              </div>
            )}
          </div>

          {/* Right Column: Sidebar */}
          <aside className="sticky top-32 flex flex-col gap-8">
             {isBookable && (
               <div className="p-6 rounded-[32px] glass-violet border-white/10">
                  <h5 className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1 flex items-center gap-2">
                    <CalendarClock className="w-3.5 h-3.5 text-[#CDFF00]" /> Book an appointment
                  </h5>
                  <p className="text-xs text-gray-400 mb-4">Pick a date and time that works for you.</p>

                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {availability.map((day, i) => (
                      <button
                        key={day.key}
                        onClick={() => { setSelectedDay(i); setSelectedTime(null); }}
                        className={`px-2 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wide transition-all ${
                          selectedDay === i ? 'bg-[#CDFF00] text-black' : 'bg-white/5 text-gray-400 hover:bg-white/10'
                        }`}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {availability[selectedDay]?.times.map((time) => (
                      <button
                        key={time}
                        onClick={() => confirmSlot(time)}
                        className={`px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                          selectedTime === time ? 'bg-[#CDFF00] text-black' : 'bg-white/5 text-white hover:bg-white/10'
                        }`}
                      >
                        {time}
                      </button>
                    ))}
                  </div>

                  {selectedTime && (
                    <p className="mt-4 text-[11px] text-[#CDFF00] font-bold text-center">
                      Selected: {availability[selectedDay].label} · {selectedTime}
                    </p>
                  )}
               </div>
             )}

             <div className="p-8 rounded-[32px] glass-strong border-white/5 overflow-hidden relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-violet-600/10 blur-3xl" />
                <h5 className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-4">Official Shop</h5>
                <p className="text-xs font-medium text-gray-400 mb-6 leading-relaxed">
                  Every transaction with this shop is protected by the HustleUp Secure Protocol.
                </p>
                <Link to={`/messages?shopId=${shop.id}`} className="block w-full py-4 rounded-2xl glass-violet text-center text-[10px] font-black uppercase tracking-widest text-white border-white/10 hover:bg-violet-600/10 transition-colors">
                  Contact Owner
                </Link>
             </div>
          </aside>
        </div>

        {/* Products you may also like */}
        {suggestedProducts.length > 0 && (
          <div className="mt-16">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-5">Products you may also like</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
              {suggestedProducts.map((product) => (
                <Link
                  key={`${product.shopId}-${product.id}`}
                  to={`/shop/${product.shopId}/product/${product.id}/negotiate`}
                  className="group flex flex-col h-full rounded-2xl overflow-hidden glass-strong bg-black/40 border border-white/10 hover:border-[#CDFF00]/40 transition-all duration-300"
                >
                  <div className="h-24 shrink-0 flex items-center justify-center text-4xl relative overflow-hidden bg-black/40 border-b border-white/5">
                    <span className="z-10 group-hover:scale-110 transition-transform duration-500">{product.image}</span>
                    <div
                      className="absolute inset-0 opacity-20 group-hover:opacity-40 transition-opacity duration-500"
                      style={{ background: `radial-gradient(circle at center, ${product.shopAccent} 0%, transparent 70%)` }}
                    />
                  </div>
                  <div className="p-3.5 flex flex-col flex-1">
                    <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest truncate mb-1">{product.shopName}</span>
                    <h5 className="text-xs font-bold text-white line-clamp-2 mb-2 group-hover:text-[#CDFF00] transition-colors">{product.name}</h5>
                    <span className="mt-auto text-sm font-black text-white">{formatPrice(product.price, product.currency)}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Shops you may also like */}
        {otherShops.length > 0 && (
          <div className="mt-14 mb-4">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-5">Shops you may also like</h4>
            <div className="flex gap-6 overflow-x-auto scrollbar-hide pb-1">
              {otherShops.map((s) => (
                <Link key={s.id} to={`/shop/${s.id}`} className="group flex flex-col items-center w-[92px] shrink-0 text-center">
                  <div className="w-16 h-16 rounded-full p-[2px] bg-gradient-to-br from-[#CDFF00] to-[#CDFF00]/30 group-hover:scale-105 transition-transform">
                    <div className="w-full h-full rounded-full overflow-hidden border-2 border-[#050505] bg-black">
                      <img src={s.image} alt={s.name} className="w-full h-full object-cover" />
                    </div>
                  </div>
                  <span className="mt-2 text-xs font-bold text-white line-clamp-1 group-hover:text-[#CDFF00] transition-colors">{s.name}</span>
                  <span className="text-[10px] text-gray-500 line-clamp-1">{s.category}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
