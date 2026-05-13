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
    <div className="min-h-screen bg-[#050505] text-white pt-24 font-sans selection:bg-[#FF00FF] selection:text-white relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 z-0 flex opacity-[0.15] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 10px 10px, #FF00FF 2px, transparent 0), radial-gradient(circle at 30px 30px, #00FFFF 2px, transparent 0)', backgroundSize: '40px 40px' }}></div>
      <div className="absolute top-0 left-0 right-0 h-[30vh] bg-gradient-to-b from-[#FF00FF]/10 to-transparent z-0 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 lg:px-8 pb-12 space-y-8 relative z-10">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <span className="inline-block px-4 py-1 text-[10px] font-black uppercase tracking-[0.4em] bg-black text-[#00FFFF] border-2 border-[#00FFFF] rounded-full mb-4 shadow-[0_0_10px_#00FFFF]">Secure Messaging</span>
            <h1 className="text-5xl font-black text-white uppercase tracking-tighter drop-shadow-[2px_2px_0_#FF00FF]">Direct <span className="text-[#00FFFF]">Messages</span></h1>
            <p className="text-[#FF00FF] font-bold uppercase tracking-widest text-xs mt-3 drop-shadow-[1px_1px_0_#000]">Connect directly with creators and collaborators.</p>
          </div>
          <div className="flex items-center gap-4">
             <div className="flex flex-col items-end">
                <span className="text-[10px] font-black text-white uppercase tracking-widest">Status</span>
                <span className="text-[12px] font-black text-[#00FFFF] uppercase tracking-tighter drop-shadow-[0_0_5px_#00FFFF]">Connected</span>
             </div>
             <div className="w-4 h-4 rounded-full bg-[#00FFFF] animate-pulse shadow-[0_0_20px_#00FFFF]" />
          </div>
        </div>

        {/* Main Interface */}
        <div className="flex h-[calc(100vh-320px)] min-h-[650px] gap-6 relative z-10">
          
          {/* Sidebar */}
          <div className={`w-full lg:w-80 shrink-0 flex flex-col bg-[#0A0A0A] rounded-[2.5rem] overflow-hidden border-2 border-[#FF00FF] shadow-[0_0_20px_rgba(255,0,255,0.1)] ${activePartner ? 'hidden lg:flex' : 'flex'}`}>
            <div className="p-8 border-b-2 border-[#FF00FF]/30 flex items-center justify-between">
              <h2 className="text-sm font-black text-[#FF00FF] uppercase tracking-[0.3em] drop-shadow-[0_0_5px_#FF00FF]">Messages</h2>
              <Search className="w-5 h-5 text-[#00FFFF]" />
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
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
                      className={`w-full text-left p-4 rounded-[1.5rem] transition-all border-2 ${isActive ? 'bg-[#FF00FF] border-[#FF00FF] text-white scale-105 shadow-[0_0_15px_#FF00FF]' : 'bg-black border-transparent hover:border-[#00FFFF]/50 hover:bg-[#00FFFF]/5'}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`relative w-12 h-12 rounded-xl flex items-center justify-center font-black overflow-hidden border-2 ${isActive ? 'border-white bg-black text-[#FF00FF]' : 'border-[#00FFFF]/30 bg-black text-white'}`}>
                          {p.avatarUrl ? <img src={p.avatarUrl} className="w-full h-full object-cover" /> : (p.name || p.fullName)?.[0] || '?'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`text-[11px] font-black truncate uppercase tracking-wider ${isActive ? 'text-white' : 'text-white'}`}>{p.name || p.fullName}</p>
                          <p className={`text-[9px] font-bold truncate mt-0.5 uppercase tracking-widest ${isActive ? 'text-white/80' : 'text-[#00FFFF]'}`}>{getStatusLine(p)}</p>
                        </div>
                      </div>
                    </button>
                  );
                });
              })()}
            </div>
          </div>

          {/* Chat Window */}
          <div className={`flex-1 flex flex-col bg-[#0A0A0A] rounded-[3rem] overflow-hidden border-2 border-[#00FFFF] shadow-[0_0_30px_rgba(0,255,255,0.15)] ${activePartner ? 'flex' : 'hidden lg:flex'}`}>
            {activePartner ? (
              <>
                <div className="p-6 border-b-2 border-[#00FFFF]/30 flex items-center gap-6 bg-black">
                  <button onClick={() => setActivePartner(null)} className="lg:hidden p-3 rounded-xl bg-black border-2 border-[#FF00FF] text-[#FF00FF] shadow-[0_0_10px_#FF00FF]"><ArrowLeft className="w-5 h-5" /></button>
                  <div className="w-16 h-16 rounded-2xl bg-black border-2 border-[#FF00FF] flex items-center justify-center overflow-hidden shadow-[0_0_15px_#FF00FF]">
                    {activePartnerData.avatarUrl ? <img src={activePartnerData.avatarUrl} className="w-full h-full object-cover" /> : <User className="w-8 h-8 text-[#FF00FF]" />}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-2xl font-black text-white uppercase tracking-tighter drop-shadow-[2px_2px_0_#FF00FF]">{activePartnerData.name || activePartnerData.fullName}</h3>
                    <div className="flex items-center gap-2 mt-1">
                       <span className="w-3 h-3 rounded-full bg-[#00FFFF] shadow-[0_0_10px_#00FFFF]" />
                       <p className="text-[10px] font-black text-[#00FFFF] tracking-widest uppercase">{getStatusLine(activePartnerData)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                     <button className="p-3.5 rounded-xl bg-black border-2 border-[#00FFFF]/50 hover:border-[#00FFFF] hover:bg-[#00FFFF]/10 transition-all text-[#00FFFF]"><Phone className="w-5 h-5" /></button>
                     <button className="p-3.5 rounded-xl bg-black border-2 border-[#00FFFF]/50 hover:border-[#00FFFF] hover:bg-[#00FFFF]/10 transition-all text-[#00FFFF]"><Video className="w-5 h-5" /></button>
                     <div className="w-px h-8 bg-[#00FFFF]/30 mx-2" />
                     <button className="p-3.5 rounded-xl bg-black border-2 border-[#00FFFF]/50 hover:border-[#00FFFF] hover:bg-[#00FFFF]/10 transition-all text-[#00FFFF]"><MoreVertical className="w-5 h-5" /></button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-hide bg-black/50">
                  <AnimatePresence>
                    {messages.map((msg, i) => {
                      const isMe = msg.senderId === user?.id;
                      return (
                        <motion.div key={msg.id || i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[70%] space-y-2`}>
                            <div className={`px-6 py-4 text-sm font-bold tracking-wide leading-relaxed rounded-[2rem] border-2 ${isMe ? 'bg-[#FF00FF]/10 border-[#FF00FF] text-white rounded-br-sm shadow-[0_0_15px_rgba(255,0,255,0.2)]' : 'bg-[#00FFFF]/10 border-[#00FFFF] text-white rounded-bl-sm shadow-[0_0_15px_rgba(0,255,255,0.2)]'}`}>
                              {msg.content}
                            </div>
                            <p className={`text-[8px] font-black text-gray-500 uppercase tracking-[0.3em] px-2 ${isMe ? 'text-right' : 'text-left'}`}>Delivered</p>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                  <div ref={messagesEndRef} />
                </div>

                <form onSubmit={sendMessage} className="p-8 border-t-2 border-[#00FFFF]/30 flex gap-4 bg-black">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={newMsg}
                      onChange={(e) => setNewMsg(e.target.value)}
                      placeholder="Type a message..."
                      className="w-full px-8 py-5 rounded-[2rem] bg-black border-2 border-[#FF00FF]/50 text-white placeholder-[#FF00FF]/50 focus:border-[#FF00FF] focus:shadow-[0_0_15px_rgba(255,0,255,0.3)] outline-none font-black text-[12px] uppercase tracking-widest transition-all"
                    />
                    <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center gap-3">
                       <Paperclip className="w-5 h-5 text-[#00FFFF] hover:scale-110 cursor-pointer transition-transform" />
                       <Smile className="w-5 h-5 text-[#00FFFF] hover:scale-110 cursor-pointer transition-transform" />
                    </div>
                  </div>
                  <button type="submit" disabled={!newMsg.trim()} className="px-10 py-5 rounded-[2rem] bg-[#00FFFF] text-black font-black uppercase tracking-widest text-[12px] hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_#00FFFF] disabled:opacity-30 disabled:scale-100">SEND</button>
                </form>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-black/50">
                <div className="w-32 h-32 rounded-[3rem] bg-black border-4 border-[#00FFFF] flex items-center justify-center mb-8 shadow-[0_0_30px_#00FFFF] animate-pulse">
                  <MessageSquareOff className="w-16 h-16 text-[#00FFFF]" />
                </div>
                <h3 className="text-3xl font-black text-white uppercase tracking-tighter mb-4 drop-shadow-[2px_2px_0_#FF00FF]">Select a Conversation</h3>
                <p className="text-[11px] text-[#FF00FF] font-black tracking-[0.4em] uppercase drop-shadow-[0_0_5px_#FF00FF]">Choose a chat from the sidebar to start messaging</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
