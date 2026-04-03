import { motion } from 'framer-motion';

export default function HeroCard({ image, handle, rotate, x, zIndex, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50, rotate: 0 }}
      animate={{ opacity: 1, y: 0, rotate }}
      transition={{ 
        delay, 
        duration: 0.8, 
        ease: [0.16, 1, 0.3, 1] 
      }}
      whileHover={{ y: -20, rotate: rotate * 0.8, zIndex: 100, scale: 1.05 }}
      style={{ x, zIndex }}
      className="absolute bottom-0 w-44 h-64 sm:w-56 sm:h-80 rounded-[2rem] overflow-hidden border border-white/10 shadow-2xl bg-gray-900 group cursor-pointer"
    >
      <img src={image} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt={handle} />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60" />
      
      {/* Speech Bubble Badge */}
      {handle && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: delay + 0.3 }}
          className="absolute -top-12 left-1/2 -translate-x-1/2"
        >
          <div className="relative bg-[#CDFF00] text-black font-black text-[10px] px-4 py-2 rounded-full whitespace-nowrap shadow-xl">
             @{handle}
             {/* Tail */}
             <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#CDFF00] rotate-45" />
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
