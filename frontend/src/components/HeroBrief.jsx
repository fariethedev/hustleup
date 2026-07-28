import React from 'react';
import { motion } from 'framer-motion';

// Compact centered page header — sized so the page content below it
// stays above the fold (no scrolling needed to reach the main UI).
export default function HeroBrief({ pillText, title, subtitle }) {
  return (
    <div className="pt-5 pb-5 px-6 max-w-7xl mx-auto">
      <div className="flex flex-col items-center text-center">
        {pillText && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-2.5 flex items-center justify-center"
          >
            <span className="text-[9px] font-black uppercase tracking-[0.35em] text-[#CDFF00] bg-[#CDFF00]/10 px-4 py-1.5 rounded-full border border-[#CDFF00]/20">
              {pillText}
            </span>
          </motion.div>
        )}

        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.19, 1, 0.22, 1] }}
          className="text-2xl sm:text-3xl md:text-4xl font-heading font-black text-white tracking-tighter uppercase leading-tight m-0"
        >
          {title}
        </motion.h1>

        {subtitle && (
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.6 }}
            className="max-w-xl text-gray-400 text-[11px] md:text-xs font-bold leading-relaxed uppercase tracking-widest opacity-80 whitespace-pre-line mt-2"
          >
            {subtitle}
          </motion.p>
        )}
      </div>
    </div>
  );
}
