import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, Plus, Minus, ShoppingBag, ArrowRight } from 'lucide-react';
import { lockBodyScroll } from '../utils/lockBodyScroll';
import {
  selectCartItems,
  selectCartOpen,
  selectCartTotal,
  selectCartCount,
  closeCart,
  removeFromCart,
  updateQuantity,
} from '../store/cartSlice';
import { formatPrice } from '../utils/constants';

export default function CartDrawer() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const items = useSelector(selectCartItems);
  const open = useSelector(selectCartOpen);
  const total = useSelector(selectCartTotal);
  const count = useSelector(selectCartCount);

  useEffect(() => {
    if (!open) return;
    const unlock = lockBodyScroll();
    return () => unlock();
  }, [open]);

  const checkout = () => {
    dispatch(closeCart());
    navigate('/checkout');
  };

  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => dispatch(closeCart())}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      {/* Drawer */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="drawer"
            initial={{ x: '100%', y: 0 }}
            animate={{ 
              x: 0, 
              y: 0,
              transition: { type: 'spring', damping: 30, stiffness: 300 } 
            }}
            exit={{ 
              x: window.innerWidth < 1024 ? 0 : '100%', 
              y: window.innerWidth < 1024 ? '100%' : 0,
              transition: { duration: 0.3 }
            }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full lg:max-w-[420px] bg-[#050505] border-l border-white/10 flex flex-col shadow-[0_0_100px_rgba(0,0,0,1)]
                       max-lg:top-auto max-lg:h-[85vh] max-lg:rounded-t-[3.5rem] max-lg:border-l-0 max-lg:border-t"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-8 py-6 border-b border-white/5 shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-[#CDFF00] text-black flex items-center justify-center shadow-[0_10px_20px_rgba(205,255,0,0.2)]">
                  <ShoppingBag className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-heading font-black text-white uppercase tracking-tight">Vault</h2>
                  <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.3em] mt-0.5">
                    {count} SYNCED {count === 1 ? 'OBJECT' : 'OBJECTS'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => dispatch(closeCart())}
                className="w-12 h-12 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all group"
              >
                <X className="w-6 h-6 text-gray-500 group-hover:text-white group-hover:rotate-90 transition-all duration-300" />
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <AnimatePresence>
                {items.length === 0 ? (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center h-48 text-center"
                  >
                    <ShoppingBag className="w-12 h-12 text-gray-700 mb-4" />
                    <p className="text-gray-500 font-bold text-sm">Your cart is empty</p>
                    <p className="text-gray-600 text-xs mt-1">Add listings to get started</p>
                  </motion.div>
                ) : (
                  items.map((item) => (
                    <motion.div
                      key={item.listingId}
                      layout
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: 60 }}
                      className="rounded-2xl border border-white/10 bg-[#111] p-4 flex gap-4"
                    >
                      {/* Image */}
                      <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-gray-800">
                        {item.image ? (
                          <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-2xl">
                            <ShoppingBag className="w-6 h-6 text-gray-600" />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-black text-base tracking-tight leading-tight truncate">{item.title}</p>
                        <p className="text-gray-500 text-[9px] font-black uppercase tracking-[0.2em] mt-1 opacity-70">
                          {item.sellerName}
                        </p>
                        <p className="text-[#CDFF00] font-black text-base mt-2 shadow-[0_0_15px_rgba(205,255,0,0.1)]">
                          {item.negotiatedPrice
                            ? `${formatPrice(item.negotiatedPrice, item.currency)}`
                            : formatPrice(item.price, item.currency)}
                        </p>

                        {/* Qty controls */}
                        <div className="flex items-center gap-3 mt-4">
                          <button
                            onClick={() =>
                              dispatch(updateQuantity({ listingId: item.listingId, quantity: item.quantity - 1 }))
                            }
                            className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all border border-white/5 active:scale-90"
                          >
                            <Minus className="w-3.5 h-3.5 text-white" />
                          </button>
                          <span className="text-white font-black text-sm w-6 text-center tabular-nums">{item.quantity}</span>
                          <button
                            onClick={() =>
                              dispatch(updateQuantity({ listingId: item.listingId, quantity: item.quantity + 1 }))
                            }
                            className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all border border-white/5 active:scale-90"
                          >
                            <Plus className="w-3.5 h-3.5 text-white" />
                          </button>
                        </div>
                      </div>

                      {/* Remove */}
                      <button
                        onClick={() => dispatch(removeFromCart(item.listingId))}
                        className="self-start w-8 h-8 rounded-xl bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center transition-colors"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className="px-6 py-5 border-t border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm font-bold uppercase tracking-widest">Total</span>
                  <span className="text-white text-2xl font-black">
                    {formatPrice(total, items[0]?.currency || 'GBP')}
                  </span>
                </div>
                <button
                  onClick={checkout}
                  className="w-full py-4 rounded-2xl bg-[#CDFF00] text-black font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-[#d9ff33] transition-all hover:scale-[1.02] active:scale-95 shadow-[0_8px_30px_rgba(205,255,0,0.25)]"
                >
                  Proceed to Checkout <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating cart button (shown when closed and has items) */}
      <AnimatePresence>
        {!open && count > 0 && (
          <motion.button
            key="fab"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => dispatch({ type: 'cart/openCart' })}
            className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-[#CDFF00] text-black flex items-center justify-center shadow-[0_8px_30px_rgba(205,255,0,0.4)]"
          >
            <ShoppingBag className="w-6 h-6" />
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-black text-[#CDFF00] text-[10px] font-black flex items-center justify-center">
              {count}
            </span>
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
}
