import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Search, Calendar, Filter, Share2, ArrowLeft, TrendingUp, Newspaper, Zap, Heart } from 'lucide-react';
import { Link } from 'react-router-dom';
import HeroBrief from '../components/HeroBrief';

const NEWS_DATA = [
  {
    id: 1,
    tag: "REGULATION",
    tagColor: "bg-orange-500/20 text-orange-500",
    city: "Lagos, NG",
    title: "New TRC regulations for digital creators effective next month.",
    desc: "The Trade Regulatory Commission has announced updated licensing requirements for freelance consultants and digital agencies across West Africa.",
    date: "Oct 24, 2026",
    content: "Full details of the regulation indicate a shift towards centralized registration for all income-generating digital activities...",
    image: "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&q=80"
  },
  {
    id: 2,
    tag: "EVENT",
    tagColor: "bg-[#CDFF00]/20 text-[#CDFF00]",
    city: "Nairobi, KE",
    title: "Global Diaspora Hustle Meetup at iHub Nairobi.",
    desc: "Join over 500+ creators for a night of networking, collaboration, and funding pitches. RSVP now for early access.",
    date: "Nov 02, 2026",
    content: "The meetup intends to bridge the gap between local talent and international investors...",
    image: "https://images.unsplash.com/photo-1540575861501-7ad0582371f3?w=800&q=80"
  },
  {
    id: 3,
    tag: "OPPORTUNITY",
    tagColor: "bg-purple-500/20 text-purple-500",
    city: "Harare, ZW",
    title: "City Council opens $1M grant for youth-led marketplaces.",
    desc: "A new initiative to support digital infrastructure in the local commerce sector. Applications open for registered hustlers.",
    date: "Oct 28, 2026",
    content: "The grant aims to accelerate the growth of home-grown platforms that solve logistical challenges...",
    image: "https://images.unsplash.com/photo-1553484771-047a44eee27b?w=800&q=80"
  },
  {
    id: 4,
    tag: "TECH",
    tagColor: "bg-blue-500/20 text-blue-500",
    city: "Cape Town, SA",
    title: "HustleUp to trial decentralized storage for all creators.",
    desc: "A new node-based architecture is arriving to ensure censorship-resistant content for all hustlers.",
    date: "Oct 30, 2026",
    content: "Decentralization is the next logical step for a platform built on independence...",
    image: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=800&q=80"
  }
];

export default function News() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNews, setSelectedNews] = useState(null);

  const filteredNews = NEWS_DATA.filter(n => 
    n.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    n.desc.toLowerCase().includes(searchQuery.toLowerCase()) ||
    n.city.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-24">
      <HeroBrief 
        pillText="COMMUNITY SYNDICATION"
        title="HUSTLE PULSE"
        subtitle={"Global perspectives, local impact.\nYour direct feed into the trends, laws, and events shaping the future of work."}
      />

      <div className="max-w-7xl mx-auto px-4 -mt-16 relative z-20">
        {/* Search & Stats Bar */}
        <div className="glass bg-black/60 border border-white/10 rounded-[3rem] p-4 flex flex-col md:flex-row items-center gap-4 shadow-2xl backdrop-blur-3xl mb-12">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input 
              type="text" 
              placeholder="Search news, locations, or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/5 rounded-2xl py-5 pl-16 pr-6 text-sm placeholder-gray-600 focus:border-[#CDFF00] transition-colors outline-none font-bold" 
            />
          </div>
          <div className="flex gap-4 px-6 md:border-l border-white/10">
            <div className="text-center">
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Active Alerts</p>
              <p className="text-lg font-black text-[#CDFF00]">12</p>
            </div>
            <div className="w-px h-10 bg-white/10" />
            <div className="text-center">
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Global Reach</p>
              <p className="text-lg font-black text-white">42</p>
            </div>
          </div>
        </div>

        {/* News Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <AnimatePresence mode="popLayout">
            {filteredNews.map((news, i) => (
              <motion.div
                key={news.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="glass-card rounded-[2.5rem] overflow-hidden border border-white/10 hover:border-[#CDFF00]/30 transition-all group flex flex-col h-full bg-black/20"
              >
                <div className="aspect-[16/10] overflow-hidden relative">
                  <img src={news.image} alt={news.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                  <div className="absolute top-4 left-4">
                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest ${news.tagColor}`}>
                      {news.tag}
                    </span>
                  </div>
                </div>
                
                <div className="p-8 flex flex-col flex-grow">
                  <div className="flex items-center justify-between mb-4">
                    <span className="flex items-center gap-1.5 text-gray-500 text-[10px] font-black uppercase tracking-widest">
                      <MapPin className="w-3.5 h-3.5 text-[#CDFF00]" /> {news.city}
                    </span>
                    <span className="text-gray-600 text-[10px] font-bold uppercase tracking-widest">{news.date}</span>
                  </div>
                  
                  <h4 className="text-2xl font-black text-white mb-4 group-hover:text-[#CDFF00] transition-colors line-clamp-2 uppercase tracking-tight">
                    {news.title}
                  </h4>
                  <p className="text-gray-400 text-sm leading-relaxed mb-8 flex-grow line-clamp-3">
                    {news.desc}
                  </p>
                  
                  <div className="flex items-center justify-between pt-6 border-t border-white/5">
                    <button 
                      onClick={() => setSelectedNews(news)}
                      className="text-white font-black text-xs uppercase tracking-widest group-hover:text-[#CDFF00] transition-colors flex items-center gap-2"
                    >
                      Read Analysis <ArrowLeft className="w-4 h-4 rotate-180" />
                    </button>
                    <button className="p-2 rounded-full hover:bg-white/5 text-gray-600 hover:text-white transition-all">
                      <Share2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {filteredNews.length === 0 && (
          <div className="py-32 text-center">
            <Newspaper className="w-16 h-16 mx-auto text-gray-800 mb-6" />
            <h3 className="text-2xl font-black text-white uppercase tracking-tight">Zero signals found</h3>
            <p className="text-gray-600 text-sm font-bold mt-2 uppercase tracking-widest">Try adjusting your filters</p>
          </div>
        )}
      </div>

      {/* Modal - Full Article Analysis */}
      <AnimatePresence>
        {selectedNews && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/90 backdrop-blur-xl"
              onClick={() => setSelectedNews(null)}
            />
            <motion.div 
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.95 }}
              className="w-full max-w-3xl bg-[#0a0a0a] border border-white/10 rounded-[3rem] overflow-hidden relative z-10 flex flex-col max-h-[90vh]"
            >
              <div className="aspect-video shrink-0 relative">
                <img src={selectedNews.image} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] to-transparent" />
                <button 
                  onClick={() => setSelectedNews(null)}
                  className="absolute top-8 right-8 w-12 h-12 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-[#CDFF00] hover:text-black transition-all"
                >
                  <ArrowLeft className="w-6 h-6" />
                </button>
              </div>

              <div className="p-10 pt-4 overflow-y-auto custom-scrollbar">
                <span className={`px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest ${selectedNews.tagColor} mb-6 inline-block`}>
                  {selectedNews.tag}
                </span>
                <h2 className="text-4xl font-black text-white mb-6 uppercase tracking-tighter leading-tight">{selectedNews.title}</h2>
                
                <div className="flex items-center gap-8 mb-10 text-[10px] font-black uppercase tracking-widest text-[#CDFF00]">
                  <div className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5" /> {selectedNews.city}</div>
                  <div className="flex items-center gap-2"><Calendar className="w-3.5 h-3.5" /> {selectedNews.date}</div>
                </div>

                <div className="space-y-6 text-gray-400 text-lg leading-relaxed font-bold">
                  <p>{selectedNews.content}</p>
                  <p>As the landscape continues to evolve, HustleUp remains committed to providing our community with the latest insights and legal guidance to thrive in the modern economy.</p>
                  <p>Our scouts are constantly monitoring global channels to ensure you're never out of the loop. Stay tuned for further updates on this developing story.</p>
                </div>
                
                <div className="mt-12 p-8 rounded-3xl bg-[#CDFF00]/5 border border-[#CDFF00]/10 flex flex-col sm:flex-row items-center justify-between gap-6">
                  <div>
                    <h5 className="text-white font-black uppercase tracking-tight mb-1">Join the conversation</h5>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Share this signal with your network</p>
                  </div>
                  <div className="flex gap-4">
                    <button className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-[#CDFF00] hover:text-black transition-all">
                      <Share2 className="w-3.5 h-3.5" /> Copy Link
                    </button>
                    <button className="w-12 h-12 rounded-xl bg-[#CDFF00] text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all">
                      <Heart className="w-5 h-5 fill-black" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
