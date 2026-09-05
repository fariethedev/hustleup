import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, CheckCircle, X } from 'lucide-react';

const ToastContext = createContext(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

/**
 * Application-wide toasts.
 *
 * <h3>Where they sit, and why it matters on a phone</h3>
 * The stack used to be pinned at `bottom-10` — 40px from the bottom edge. On mobile that is
 * exactly where the floating tab bar lives: it starts at `0.875rem + safe-area` and stands
 * 58px tall, so every toast landed on top of it. Two things went wrong at once. The message
 * was drawn across the navigation, and because each toast sets `pointer-events-auto` it also
 * swallowed taps on Home, Explore, Feed, Bond and DMs for the full five seconds it was up.
 *
 * The offset now clears the bar on mobile and drops back to a normal margin from `md` up,
 * where no such bar exists. `env(safe-area-inset-bottom)` is added rather than assumed so the
 * stack sits above the home indicator on a notched iPhone instead of under it.
 *
 * <h3>Why AnimatePresence is here</h3>
 * It was imported but never used, so the `exit` variant on each toast never ran: a toast
 * popped in smoothly and then vanished between frames. Removal is the moment the animation is
 * actually worth having — it is what distinguishes "that message finished" from "the app just
 * dropped something".
 */
export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((message, type = 'error') => {
    // A message with nothing in it renders as an empty coloured slab; there is nothing to
    // read and no reason to cover the screen with it.
    const text = typeof message === 'string' ? message.trim() : '';
    if (!text) return;

    const id = window.crypto?.randomUUID
      ? window.crypto.randomUUID()
      : Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message: text, type }]);

    setTimeout(() => removeToast(id), 5000);
  }, [removeToast]);

  // Bridge for non-React callers (the axios interceptors, and `dispatchToast` in api/client).
  React.useEffect(() => {
    const handleToastEvent = (e) => {
      const { message, type } = e.detail || {};
      showToast(message, type);
    };
    window.addEventListener('hustleup-toast', handleToastEvent);
    return () => window.removeEventListener('hustleup-toast', handleToastEvent);
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        // aria-live so the message is announced rather than only drawn — a toast that
        // disappears after five seconds is easy to miss even when it is visible.
        role="status"
        aria-live="polite"
        className="fixed left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-3 pointer-events-none w-full max-w-sm px-4 sm:px-6
                   bottom-[calc(5.5rem+env(safe-area-inset-bottom))] md:bottom-10"
      >
        <AnimatePresence initial={false}>
          {toasts.map((toast) => (
            <Toast key={toast.id} toast={toast} onRemove={() => removeToast(toast.id)} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

const Toast = ({ toast, onRemove }) => {
  const isError = toast.type === 'error';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 24, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.95, transition: { duration: 0.2 } }}
      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      className={`pointer-events-auto flex items-center gap-3 p-3.5 sm:p-4 rounded-2xl shadow-2xl border ${
        isError
          ? 'bg-[#7D39EB] border-white/20 text-white'
          : 'bg-[#CDFF00] border-black/10 text-black'
      } glass-strong backdrop-blur-xl`}
    >
      <div className="shrink-0">
        {isError ? (
          <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
        ) : (
          <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-black" />
        )}
      </div>

      {/* min-w-0 + break-words: a long server message used to force the toast wider than the
          screen instead of wrapping inside it. */}
      <p className="flex-1 min-w-0 text-[13px] sm:text-sm font-black tracking-tight leading-tight break-words">
        {toast.message}
      </p>

      <button
        onClick={onRemove}
        aria-label="Dismiss notification"
        className={`shrink-0 p-1 rounded-full hover:bg-white/10 transition-colors ${isError ? 'text-white' : 'text-black'}`}
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
};
