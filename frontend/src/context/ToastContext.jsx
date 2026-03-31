import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'error') => {
    const id = window.crypto.randomUUID ? window.crypto.randomUUID() : Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    // Auto-dismiss after 5s
    setTimeout(() => {
      removeToast(id);
    }, 5000);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  // Listen for global toast events (from axios interceptors)
  React.useEffect(() => {
    const handleToastEvent = (e) => {
      const { message, type } = e.detail;
      showToast(message, type);
    };
    window.addEventListener('hustleup-toast', handleToastEvent);
    return () => window.removeEventListener('hustleup-toast', handleToastEvent);
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast Portal - Rendered at bottom center */}
      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-3 pointer-events-none w-full max-w-sm px-6">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onRemove={() => removeToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

// Internal Toast Component
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, CheckCircle, X } from 'lucide-react';

const Toast = ({ toast, onRemove }) => {
  const isError = toast.type === 'error';
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
      className={`pointer-events-auto flex items-center gap-4 p-4 rounded-2xl shadow-2xl border ${
        isError 
          ? 'bg-[#7D39EB] border-white/20 text-white' 
          : 'bg-[#CDFF00] border-black/10 text-black'
      } glass-strong backdrop-blur-xl`}
    >
      <div className="shrink-0">
        {isError ? (
          <AlertCircle className="w-6 h-6 text-white" />
        ) : (
          <CheckCircle className="w-6 h-6 text-black" />
        )}
      </div>
      
      <p className="flex-1 text-sm font-black uppercase tracking-tight leading-tight">
        {toast.message}
      </p>

      <button 
        onClick={onRemove}
        className={`p-1 rounded-full hover:bg-white/10 transition-colors ${isError ? 'text-white' : 'text-black'}`}
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
};
