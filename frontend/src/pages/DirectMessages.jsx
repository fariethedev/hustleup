import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useSelector } from 'react-redux';
import { selectUser, selectIsAuthenticated } from '../store/authSlice';
import { directMessagesApi, notificationsApi, usersApi } from '../api/client';
import { MessageSquareOff, Send, User, BadgeCheck, ArrowLeft, ShoppingCart } from 'lucide-react';
import StoryBar from '../components/stories/StoryBar';

const buildFallbackStory = (person) => {
  if (!person) return 'Ready to chat';
  if (person.online === true || person.online === 'true') return 'online now';
  if (person.city && person.role) return `${person.role.toLowerCase()} in ${person.city}`;
  if (person.city) return `based in ${person.city}`;
  if (person.role) return `${person.role.toLowerCase()} on HustleUp`;
  if (person.bio) return person.bio.length > 42 ? `${person.bio.slice(0, 42)}...` : person.bio;
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
  const [currentUserProfile, setCurrentUserProfile] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState(navState?.prefillMessage || '');
  const [activePartner, setActivePartner] = useState(partnerId || null);
  const [loading, setLoading] = useState(true);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [listingContext, setListingContext] = useState(navState?.listing || null);
  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return; }
    loadPartners();
    // Poll for new conversations / partner list updates every 8 seconds
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
        setCurrentUserProfile(user || null);

        if (!activePartner && partnerData.length > 0) {
          setActivePartner(partnerData[0].id);
        }
        setTimeout(() => scrollToBottom(), 100);
      })
      .finally(() => setLoading(false));

    notificationsApi.getUnreadCount()
      .then(res => setUnreadNotifications(res.data.count))
      .catch(() => setUnreadNotifications(0));
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (activePartner) {
      loadMessages(activePartner);
      
      const interval = setInterval(() => {
        loadMessages(activePartner);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [activePartner]);

  const loadMessages = (id) => {
    directMessagesApi.getConversation(id)
      .then(res => setMessages(res.data || []))
      .catch(e => console.error(e));
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMsg.trim() || !activePartner) return;
    try {
      let content = newMsg;
      if (listingContext) {
        content = `[Negotiation for: ${listingContext.title}] ${newMsg}`;
      }
      const res = await directMessagesApi.sendMessage(activePartner, content);
      setMessages([...messages, res.data]);
      setNewMsg('');
      setListingContext(null);
      setTimeout(() => scrollToBottom(), 100);
    } catch (e) {
      console.error(e);
    }
  };

  const activePartnerData = partners.find(p => p.id === activePartner)
    || allUsers.find(p => p.id === activePartner)
    || { name: "User", fullName: "User", verified: "false" };

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <div className="pt-8 pb-6 px-4 max-w-7xl mx-auto">
        <span className="inline-block px-3 py-1 text-[10px] font-black uppercase tracking-widest bg-[#CDFF00]/10 text-[#CDFF00] border border-[#CDFF00]/20 rounded-full mb-3">ENCRYPTED CHANNEL V3</span>
        <h1 className="text-4xl font-black text-white uppercase tracking-tight">Hustle <span className="text-[#CDFF00]">Wire</span></h1>
        <p className="text-gray-500 text-sm mt-1">The direct line to your next breakthrough. Secure, seamless, and strictly business.</p>
      </div>
      
      <div className="max-w-7xl mx-auto px-4 lg:px-8 pb-12 space-y-12">
        {/* Alerts Bar */}
        <div className="flex items-center justify-between">
           <div className="flex items-center gap-4">
              <span className="w-3 h-3 rounded-full bg-[#CDFF00] animate-pulse shadow-[0_0_15px_rgba(205,255,0,0.5)]" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">Node Status: Active</span>
           </div>
           <button className="group relative px-6 py-2 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 transition-all">
              <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.25em] text-white">
                <span>Alerts</span>
                <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full font-black ${unreadNotifications > 0 ? 'bg-[#CDFF00] text-black' : 'bg-white/10 text-gray-500'}`}>
                  {unreadNotifications}
                </span>
              </div>
           </button>
        </div>

        {/* Story Bar - FULL WIDTH */}
        <div className="relative w-full">
          <StoryBar />
        </div>

        {/* Chat Area */}
        <div className="flex h-[calc(100vh-450px)] min-h-[600px] gap-6 relative z-10 text-white">
          {/* Sidebar */}
          <div className={`w-full lg:w-80 shrink-0 flex flex-col glass rounded-3xl overflow-hidden border border-white/5 bg-[#121212] ${activePartner ? 'hidden lg:flex' : 'flex'}`}>
            <div className="p-6 border-b border-white/5">
              <h2 className="text-xl font-heading font-black text-[#CDFF00] uppercase tracking-wider">Messages</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-hide">
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
                      className={`w-full text-left p-4 rounded-2xl transition-all border ${isActive ? 'bg-[#CDFF00]/10 border-[#CDFF00]/50' : 'bg-black/40 border-transparent hover:border-white/10'}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`relative w-12 h-12 rounded-xl flex items-center justify-center font-black overflow-hidden ${isActive ? 'bg-[#CDFF00] text-black' : 'bg-[#1e1e1e] text-white border border-white/10'}`}>
                          {p.avatarUrl ? <img src={p.avatarUrl} className="w-full h-full object-cover" /> : (p.name || p.fullName)?.[0] || '?'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm font-bold truncate uppercase tracking-wider ${isActive ? 'text-[#CDFF00]' : 'text-white'}`}>{p.name || p.fullName}</p>
                          <p className="text-[10px] text-gray-500 truncate mt-1 uppercase tracking-widest">{getStatusLine(p)}</p>
                        </div>
                      </div>
                    </button>
                  );
                });
              })()}
            </div>
          </div>

          {/* Main Chat Content */}
          <div className={`flex-1 flex flex-col bg-[#111111] rounded-3xl overflow-hidden border border-white/5 ${activePartner ? 'flex' : 'hidden lg:flex'}`}>
            {activePartner ? (
              <>
                <div className="p-6 border-b border-white/5 flex items-center gap-4 bg-black/40">
                  <button onClick={() => setActivePartner(null)} className="lg:hidden p-2 rounded-xl bg-white/5 border border-white/10 text-white">
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div className="w-12 h-12 rounded-xl bg-black border border-[#CDFF00]/30 flex items-center justify-center overflow-hidden">
                    {activePartnerData.avatarUrl ? <img src={activePartnerData.avatarUrl} className="w-full h-full object-cover" /> : <User className="w-6 h-6 text-[#CDFF00]" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-white uppercase tracking-wider">{activePartnerData.name || activePartnerData.fullName}</h3>
                    <p className="text-[10px] font-bold text-[#CDFF00] tracking-widest uppercase">{getStatusLine(activePartnerData)}</p>
                  </div>
                  {listingContext && activePartner === partnerId && (
                    <button
                      onClick={() => navigate('/checkout')}
                      className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-[#CDFF00] text-black font-black text-[10px] uppercase tracking-widest shrink-0 hover:bg-[#d9ff33] transition-colors"
                    >
                      <ShoppingCart className="w-3.5 h-3.5" /> Pay Now
                    </button>
                  )}
                </div>

                <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
                  {messages.map((msg, i) => {
                    const isMe = msg.senderId === user?.id;
                    return (
                      <div key={msg.id || i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] px-5 py-4 text-sm font-bold rounded-3xl ${isMe ? 'bg-[#CDFF00] text-black rounded-br-sm' : 'bg-[#1E1E1E] text-white rounded-bl-sm border border-white/5'}`}>
                          {msg.content}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                <form onSubmit={sendMessage} className="p-6 border-t border-white/5 flex gap-4 bg-black/40">
                  <input
                    type="text"
                    value={newMsg}
                    onChange={(e) => setNewMsg(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 px-6 py-4 rounded-xl bg-[#1E1E1E] border border-white/5 text-white placeholder-gray-600 focus:border-[#CDFF00] outline-none font-bold"
                  />
                  <button type="submit" disabled={!newMsg.trim()} className="px-8 py-4 rounded-xl bg-[#CDFF00] text-black font-black uppercase tracking-widest text-xs disabled:opacity-50">SEND</button>
                </form>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-center p-10">
                <div>
                  <MessageSquareOff className="w-16 h-16 mx-auto text-[#CDFF00]/20 mb-6" />
                  <h3 className="text-2xl font-black text-white uppercase tracking-wider mb-2">No active thread</h3>
                  <p className="text-xs text-gray-600 font-black tracking-widest uppercase">Select a partner to start a conversation</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
