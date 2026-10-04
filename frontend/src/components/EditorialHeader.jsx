import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
export default function EditorialHeader({ section, title, description }) {
  return <header className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 sm:pt-14 pb-8">
    <nav aria-label="Community reads and opportunities" className="flex items-center gap-2 mb-8 text-sm"><Link to="/news" className={`min-h-11 px-4 rounded-full flex items-center ${section === 'News' ? 'bg-[#CDFF00] text-black font-semibold' : 'border border-white/15 text-gray-400'}`}>The edit</Link><Link to="/jobs" className={`min-h-11 px-4 rounded-full flex items-center ${section === 'Jobs' ? 'bg-[#CDFF00] text-black font-semibold' : 'border border-white/15 text-gray-400'}`}>Opportunities</Link></nav>
    <div className="flex items-end justify-between gap-6 border-b border-white/15 pb-7"><div><p className="text-xs font-semibold tracking-[.2em] text-gray-400 uppercase mb-3">HustleSpace / {section}</p><h1 className="text-4xl sm:text-6xl font-bold tracking-tight max-w-3xl leading-[1.05]">{title}</h1><p className="text-sm sm:text-base text-gray-400 mt-4 max-w-xl leading-relaxed">{description}</p></div><ArrowUpRight className="hidden sm:block w-14 h-14 text-[#CDFF00] shrink-0" /></div>
  </header>;
}
