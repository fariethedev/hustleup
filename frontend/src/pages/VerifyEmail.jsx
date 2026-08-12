import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { authApi } from '../api/client';
import { Check, X } from 'lucide-react';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState('checking'); // checking | success | error

  useEffect(() => {
    if (!token) { setStatus('error'); return; }
    authApi.verifyEmail(token)
      .then(() => setStatus('success'))
      .catch(() => setStatus('error'));
  }, [token]);

  return (
    <div className="min-h-[calc(100vh-7.5rem)] md:min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-4">
      <motion.div className="w-full max-w-sm text-center" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="glass bg-black/60 border border-white/10 rounded-3xl p-8 shadow-2xl backdrop-blur-3xl">
          {status === 'checking' && (
            <>
              <div className="w-8 h-8 border-2 border-[#CDFF00]/20 border-t-[#CDFF00] rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-400 text-sm">Verifying your email…</p>
            </>
          )}
          {status === 'success' && (
            <>
              <div className="w-12 h-12 rounded-full bg-[#CDFF00]/10 flex items-center justify-center mx-auto mb-4">
                <Check className="w-5 h-5 text-[#CDFF00]" />
              </div>
              <p className="text-white font-semibold mb-1">Email verified</p>
              <p className="text-gray-400 text-sm mb-5">Your account is fully set up.</p>
              <Link to="/dashboard" className="block w-full py-3 rounded-xl bg-[#CDFF00] text-black font-bold text-sm hover:brightness-110 active:scale-[0.98] transition-all">
                Go to dashboard
              </Link>
            </>
          )}
          {status === 'error' && (
            <>
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                <X className="w-5 h-5 text-red-400" />
              </div>
              <p className="text-white font-semibold mb-1">Link invalid or expired</p>
              <p className="text-gray-400 text-sm">Ask for a new verification email from your profile settings.</p>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
