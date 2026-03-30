import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getShopById} from '../utils/shopData';
import { formatPrice } from '../utils/constants';
import { Star, MapPin, ArrowLeft, ShoppingCart, Package, ChevronRight } from 'lucide-react';
import { useState } from 'react';

export default function ShopDetail() {
  const { id } = useParams();
  const shop = getShopById(id);
  const [activeCategory, setActiveCategory] = useState('All');

  if (!shop) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="text-center">
          <Package className="w-16 h-16 mx-auto text-gray-300 mb-6" />
          <h2 className="text-2xl font-heading font-bold text-white mb-2">Shop not found</h2>
          <p className="text-gray-400 mb-6">The shop you're looking for doesn't exist.</p>
          <Link to="/" className="px-6 py-3 rounded-xl bg-[#CDFF00] text-white font-bold hover:bg-[#CDFF00] transition-all">
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

  return (
    <div className="min-h-screen">
      {/* Shop Banner */}
      <section className="relative h-72 sm:h-80 overflow-hidden">
        <img
          src={shop.image}
          alt={shop.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
        
        {/* Back button */}
        <div className="absolute top-24 left-4 sm:left-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl glass bg-black/40 border border-white/10 text-gray-200 font-semibold text-sm hover:glass bg-black/40 border border-white/10 transition-all"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Shops
          </Link>
        </div>

        {/* Shop info overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8">
          <div className="max-w-7xl mx-auto">
            <span
              className="inline-block px-3 py-1 rounded-full text-xs font-bold text-white mb-3"
              style={{ background: shop.accentColor }}
            >
              {shop.category}
            </span>
            <h1 className="text-3xl sm:text-5xl font-heading font-extrabold text-white mb-2">
              {shop.name}
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-white/80 text-sm">
              <span className="flex items-center gap-1">
                <Star className="w-4 h-4 fill-current text-yellow-400" />
                <strong className="text-white">{shop.rating}</strong> ({shop.reviewCount} reviews)
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="w-4 h-4" /> {shop.location}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Shop Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Description */}
        <motion.div
          className="mb-10 max-w-3xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className="text-gray-500 text-lg leading-relaxed">{shop.description}</p>
        </motion.div>

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-8">
          <Link to="/" className="hover:text-[#CDFF00] transition-colors">Home</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-gray-300 font-semibold">{shop.name}</span>
        </div>

        {/* Category filter pills */}
        <div className="flex flex-wrap gap-2 mb-10">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all ${
                activeCategory === cat
                  ? 'text-white shadow-lg'
                  : 'bg-[#1E1E1E] text-gray-600 hover:bg-white/10'
              }`}
              style={
                activeCategory === cat
                  ? { background: shop.accentColor, boxShadow: `0 4px 14px ${shop.accentColor}33` }
                  : {}
              }
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map((product, i) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.4 }}
            >
              <Link
                to={`/shop/${shop.id}/product/${product.id}/negotiate`}
                className="group block rounded-2xl glass bg-black/40 border border-white/10 border border-white/5 hover:border-white/10 overflow-hidden hover:shadow-xl hover:shadow-black/5 transition-all duration-300 hover:-translate-y-1"
              >
              {/* Product emoji/image area */}
              <div
                className="h-44 flex items-center justify-center text-6xl relative overflow-hidden"
                style={{ background: shop.accentBg }}
              >
                <span className="group-hover:scale-125 transition-transform duration-500">{product.image}</span>
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-300"
                  style={{ background: shop.accentColor }}
                />
              </div>

              <div className="p-5">
                <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1 block">{product.category}</span>
                <h3 className="text-base font-bold text-white mb-3 leading-tight group-hover:text-gray-300 transition-colors line-clamp-2">
                  {product.name}
                </h3>
                <div className="flex items-center justify-between">
                  <span className="text-xl font-heading font-extrabold" style={{ color: shop.accentColor }}>
                    {formatPrice(product.price, product.currency)}
                  </span>
                  <span
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white transition-all hover:scale-110 active:scale-95 shadow-md"
                    style={{ background: shop.accentColor }}
                    title="Continue to negotiation"
                  >
                    <ShoppingCart className="w-4.5 h-4.5" />
                  </span>
                </div>
              </div>
              </Link>
            </motion.div>
          ))}
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-20">
            <Package className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-bold text-gray-300 mb-2">No products in this category</h3>
            <button
              onClick={() => setActiveCategory('All')}
              className="text-sm font-semibold transition-colors"
              style={{ color: shop.accentColor }}
            >
              View all products
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
