import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowUpRight, Store, User, Zap } from 'lucide-react';

export default function TrendingCard({ item, index = 0 }) {
  const { title, subtitle, image, description, link, type } = item;
  
  const Icon = type === 'shop' ? Store : type === 'user' ? User : Zap;
  const badgeColor = type === 'shop' ? 'glass-purple' : type === 'user' ? 'glass-lime' : 'glass-amber';

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1, duration: 0.6 }}
      className="group relative aspect-[4/5] rounded-[3.5rem] overflow-hidden border border-white/5 bg-gray-900 shadow-2xl hover:border-white/20 transition-all duration-500 hover:-translate-y-2"
    >
      <Link to={link || "#"} className="block w-full h-full">
        {/* Background Image */}
        <div className="absolute inset-0 w-full h-full">
          {image ? (
             <img 
               src={image} 
               alt={title} 
               className="w-full h-full object-cover opacity-70 group-hover:scale-110 transition-transform duration-1000 ease-out" 
             />
          ) : (
             <div className="w-full h-full bg-gradient-to-br from-gray-800 to-black flex items-center justify-center">
                <Icon className="w-20 h-20 text-white/10" />
             </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />
        </div>

        {/* Top Badge */}
        <div className="absolute top-6 left-6">
          <span className={`flex items-center gap-2 px-4 py-2 rounded-2xl ${badgeColor} text-[10px] font-black uppercase tracking-widest text-white border border-white/10`}>
            <Icon className="w-3.5 h-3.5" />
            {type}
          </span>
        </div>

        {/* Content Overlay */}
        <div className="absolute inset-x-0 bottom-0 p-8 flex flex-col items-start translate-y-4 group-hover:translate-y-0 transition-all duration-500">
           <div className="w-full">
              <h4 className="text-2xl font-black text-white mb-1 group-hover:text-[#CDFF00] transition-colors leading-tight line-clamp-2">
                {title}
              </h4>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">
                {subtitle}
              </p>
              <p className="text-xs text-gray-400 font-medium leading-relaxed italic opacity-0 group-hover:opacity-100 transition-opacity duration-700 line-clamp-2 mb-6">
                 "{description || 'Discover the best trending content on HustleUp.'}"
              </p>
           </div>
           
           <div className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-black font-black text-[10px] uppercase tracking-widest opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all duration-700 delay-100 hover:bg-[#CDFF00]">
              Explore <ArrowUpRight className="w-3.5 h-3.5" />
           </div>
        </div>
      </Link>
    </motion.div>
  );
}
