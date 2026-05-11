import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useSelector } from 'react-redux';
import { selectUser, selectIsAuthenticated } from '../store/authSlice';
import { directMessagesApi, notificationsApi, usersApi } from '../api/client';
import { 
  MessageSquareOff, Send, User, BadgeCheck, ArrowLeft, 
  ShoppingCart, Paperclip, Smile, MoreVertical, Search,
  Phone, Video, Info, Shield, Zap
} from 'lucide-react';

const buildFallbackStory = (person) => {
  if (!person) return 'Ready to chat';
  if (person.online === true || person.online === 'true') return 'online now';
  if (person.city && person.role) return `${person.role.toLowerCase()} in ${person.city}`;
  if (person.city) return `based in ${person.city}`;
  if (person.role) return `${person.role.toLowerCase()} on HustleUp`;
  return 'Ready to connect';
};

const getStatusLine = (person) => {
  if (!person) return 'Ready to chat';
  if (person.story) return person.story;
  return buildFallbackStory(person);
};

export default function DirectMessages() {
  const { partnerId } = useParams();
  const { state: navState } = useLocation();
  const user = useSelector(selectUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const navigate = useNavigate();
  
  const [partners, setPartners] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState(navState?.prefillMessage || '');
  const [activePartner, setActivePartner] = useState(partnerId || null);
  const [loading, setLoading] = useState(true);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [listingContext, setListingContext] = useState(navState?.listing || null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return; }
    loadPartners();
    const partnerInterval = setInterval(loadPartners, 8000);
    return () => clearInterval(partnerInterval);
  }, [isAuthenticated, navigate]);

  const loadPartners = () => {
    Promise.allSettled([directMessagesApi.getPartners(), usersApi.getAll()])
      .then(([partnersRes, usersRes]) => {
        const partnerData = partnersRes.status === 'fulfilled' ? (partnersRes.value.data || []) : [];
        const userData = usersRes.status === 'fulfilled' ? (usersRes.value.data || []) : [];
        setPartners(partnerData);
        setAllUsers(userData);
        if (!activePartner && partnerData.length > 0) setActivePartner(partnerData[0].id);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      })
      .finally(() => setLoading(false));

    notificationsApi.getUnreadCount()
      .then(res => setUnreadNotifications(res.data.count))
      .catch(() => setUnreadNotifications(0));
  };

  useEffect(() => {
    if (activePartner) {
      loadMessages(activePartner);
      const interval = setInterval(() => loadMessages(activePartner), 5000);
      return () => clearInterval(interval);
    }
  }, [activePartner]);

  const loadMessages = (id) => {
    directMessagesApi.getConversation(id)
      .then(res => setMessages(res.data || []))
      .catch(e => console.error(e));
    notificationsApi.markAllRead().catch(() => {});
    setUnreadNotifications(0);
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMsg.trim() || !activePartner) return;
    try {
      let content = newMsg;
      if (listingContext) content = `[Negotiation for: ${listingContext.title}] ${newMsg}`;
      const res = await directMessagesApi.sendMessage(activePartner, content);
      setMessages([...messages, res.data]);
      setNewMsg('');
      setListingContext(null);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (e) { console.error(e); }
  };

  const activePartnerData = partners.find(p => p.id === activePartner)
    || allUsers.find(p => p.id === activePartner)
    || { name: "User", fullName: "User" };

  return (
    <div className="min-h-screen bg-[#050505] text-white pt-24 font-sans selection:bg-[#CDFF00] selection:text-black">
      <div className="max-w-7xl mx-auto px-4 lg:px-8 pb-12 space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <span className="inline-block px-3 py-1 text-[9px] font-black uppercase tracking-[0.4em] bg-[#CDFF00]/10 text-[#CDFF00] border border-[#CDFF00]/20 rounded-full mb-3">Node Connectivity Active</span>
            <h1 className="text-5xl font-black text-white uppercase tracking-tighter">Hustle <span className="text-[#CDFF00]">Wire</span></h1>
            <p className="text-gray-500 text-sm font-bold uppercase tracking-tight mt-1 opacity-60">The direct line to your next breakthrough. Secure, seamless, and strictly business.</p>
          </div>
          <div className="flex items-center gap-4">
             <div className="flex flex-col items-end">
                <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Global Relay</span>
                <span className="text-[10px] font-black text-[#CDFF00] uppercase tracking-tighter">12 ms Latency</span>
             </div>
             <div className="w-3 h-3 rounded-full bg-[#CDFF00] animate-pulse shadow-[0_0_15px_#CDFF00]" />
          </div>
        </div>

        {/* Main Interface */}
        <div className="flex h-[calc(100vh-320px)] min-h-[650px] gap-6 relative z-10">
          
          {/* Sidebar */}
          <div className={`w-full lg:w-80 shrink-0 flex flex-col glass rounded-[2.5rem] overflow-hidden border border-white/5 bg-black/40 backdrop-blur-3xl ${activePartner ? 'hidden lg:flex' : 'flex'}`}>
            <div className="p-8 border-b border-white/5 flex items-center justify-between">
              <h2 className="text-sm font-black text-[#CDFF00] uppercase tracking-[0.3em]">Directives</h2>
              <Search className="w-4 h-4 text-gray-500" />
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-hide">
              {(() => {
                const partnerIds = new Set(partners.map(p => p.id));
                const otherUsers = allUsers.filter(u => !partnerIds.has(u.id) && u.id !== user?.id);
                const combined = [...partners, ...otherUsers];
                return combined.map((p) => {
                  const isActive = p.id === activePartner;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setActivePartner(p.id)}
                      className={`w-full text-left p-4 rounded-2xl transition-all border ${isActive ? 'bg-[#CDFF00] text-black scale-105 shadow-xl shadow-[#CDFF00]/10' : 'bg-white/5 border-transparent hover:border-white/10'}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`relative w-12 h-12 rounded-xl flex items-center justify-center font-black overflow-hidden ${isActive ? 'bg-black text-[#CDFF00]' : 'bg-[#1e1e1e] text-white border border-white/10'}`}>
                          {p.avatarUrl ? <img src={p.avatarUrl} className="w-full h-full object-cover" /> : (p.name || p.fullName)?.[0] || '?'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`text-[11px] font-black truncate uppercase tracking-wider ${isActive ? 'text-black' : 'text-white'}`}>{p.name || p.fullName}</p>
                          <p className={`text-[8px] font-bold truncate mt-0.5 uppercase tracking-widest ${isActive ? 'text-black/60' : 'text-gray-500'}`}>{getStatusLine(p)}</p>
                        </div>
                      </div>
                    </button>
                  );
                });
              })()}
            </div>
          </div>

          {/* Chat Window */}
          <div className={`flex-1 flex flex-col bg-black/60 rounded-[3rem] overflow-hidden border border-white/5 backdrop-blur-3xl shadow-2xl ${activePartner ? 'flex' : 'hidden lg:flex'}`}>
            {activePartner ? (
              <>
                <div className="p-8 border-b border-white/5 flex items-center gap-6 bg-white/[0.02]">
                  <button onClick={() => setActivePartner(null)} className="lg:hidden p-3 rounded-xl bg-white/5 border border-white/10 text-white"><ArrowLeft className="w-5 h-5" /></button>
                  <div className="w-14 h-14 rounded-2xl bg-black border border-[#CDFF00]/30 flex items-center justify-center overflow-hidden shadow-2xl">
                    {activePartnerData.avatarUrl ? <img src={activePartnerData.avatarUrl} className="w-full h-full object-cover" /> : <User className="w-6 h-6 text-[#CDFF00]" />}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-black text-white uppercase tracking-tight">{activePartnerData.name || activePartnerData.fullName}</h3>
                    <div className="flex items-center gap-2 mt-1">
                       <span className="w-2 h-2 rounded-full bg-[#CDFF00] shadow-[0_0_10px_#CDFF00]" />
                       <p className="text-[10px] font-black text-[#CDFF00] tracking-widest uppercase opacity-80">{getStatusLine(activePartnerData)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                     <button className="p-3.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"><Phone className="w-4 h-4 text-gray-400" /></button>
                     <button className="p-3.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"><Video className="w-4 h-4 text-gray-400" /></button>
                     <div className="w-px h-8 bg-white/5 mx-2" />
                     <button className="p-3.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"><MoreVertical className="w-4 h-4 text-gray-400" /></button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-hide">
                  <AnimatePresence>
                    {messages.map((msg, i) => {
                      const isMe = msg.senderId === user?.id;
                      return (
                        <motion.div key={msg.id || i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[70%] space-y-2`}>
                            <div className={`px-6 py-4 text-xs font-black tracking-tight leading-relaxed rounded-[2rem] ${isMe ? 'bg-[#CDFF00] text-black rounded-br-sm shadow-xl shadow-[#CDFF00]/5' : 'bg-white/5 text-white rounded-bl-sm border border-white/10'}`}>
                              {msg.content}
                            </div>
                            <p className={`text-[7px] font-black text-gray-600 uppercase tracking-[0.3em] px-2 ${isMe ? 'text-right' : 'text-left'}`}>Delivered • Node Relay Alpha</p>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                  <div ref={messagesEndRef} />
                </div>

                <form onSubmit={sendMessage} className="p-8 border-t border-white/5 flex gap-4 bg-white/[0.01]">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={newMsg}
                      onChange={(e) => setNewMsg(e.target.value)}
                      placeholder="Broadcast encrypted signal..."
                      className="w-full px-8 py-5 rounded-[2rem] bg-white/5 border border-white/10 text-white placeholder-gray-700 focus:border-[#CDFF00] outline-none font-black text-[11px] uppercase tracking-widest transition-all"
                    />
                    <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center gap-3">
                       <Paperclip className="w-4 h-4 text-gray-600 hover:text-white cursor-pointer transition-colors" />
                       <Smile className="w-4 h-4 text-gray-600 hover:text-white cursor-pointer transition-colors" />
                    </div>
                  </div>
                  <button type="submit" disabled={!newMsg.trim()} className="px-10 py-5 rounded-[2rem] bg-[#CDFF00] text-black font-black uppercase tracking-widest text-[11px] hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-[#CDFF00]/10 disabled:opacity-30 disabled:scale-100">SEND</button>
                </form>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
                <div className="w-24 h-24 rounded-[3rem] bg-[#CDFF00]/5 flex items-center justify-center mb-8 border border-[#CDFF00]/10">
                  <Shield className="w-10 h-10 text-[#CDFF00]/20" />
                </div>
                <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">Initialize Hub</h3>
                <p className="text-[10px] text-gray-600 font-black tracking-[0.4em] uppercase">Select a node to begin encrypted transmission</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
