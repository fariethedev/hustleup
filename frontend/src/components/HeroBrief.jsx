import React from 'react';
import { motion } from 'framer-motion';

export default function HeroBrief({ pillText, title, subtitle }) {
  return (
    <div className="pt-24 pb-16 px-6 max-w-7xl mx-auto">
      <div className="flex flex-col items-center text-center">
        {/* Top Tag - Minimal Centered Pill */}
        {pillText && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 flex items-center justify-center"
          >
            <span className="text-[10px] md:text-[11px] font-black uppercase tracking-[0.4em] text-[#CDFF00] bg-[#CDFF00]/10 px-6 py-2 rounded-full border border-[#CDFF00]/20">
              {pillText}
            </span>
          </motion.div>
        )}
        
        {/* Main Title - Centered, Smaller, High Impact */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.19, 1, 0.22, 1] }}
          className="mb-6"
        >
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-heading font-black text-white tracking-tighter uppercase leading-tight m-0">
            {title}
          </h1>
        </motion.div>

        {/* Subtitle - Centered, Smaller, Clean Typography */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.8 }}
          className="max-w-2xl"
        >
          <p className="text-gray-400 text-sm md:text-base lg:text-lg font-bold leading-relaxed uppercase tracking-widest opacity-80 whitespace-pre-line pt-2">
            {subtitle}
          </p>
        </motion.div>
        
        {/* Subtle separator */}
        <div className="w-16 h-px bg-white/10 mt-10 rounded-full" />
      </div>
    </div>
  );
}
