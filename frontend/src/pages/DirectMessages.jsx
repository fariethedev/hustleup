import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useSelector } from 'react-redux';
import { selectUser, selectIsAuthenticated } from '../store/authSlice';
import { authApi, directMessagesApi, notificationsApi, usersApi } from '../api/client';
import { MessageSquareOff, Send, User, BadgeCheck, ArrowLeft } from 'lucide-react';
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
  const user = useSelector(selectUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const navigate = useNavigate();
  
  const [partners, setPartners] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [currentUserProfile, setCurrentUserProfile] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState('');
  const [activePartner, setActivePartner] = useState(partnerId || null);
  const [loading, setLoading] = useState(true);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return; }
    loadPartners();
  }, [isAuthenticated, navigate]);

  const loadPartners = () => {
    Promise.all([directMessagesApi.getPartners(), usersApi.getAll(), authApi.me()])
      .then(([partnersRes, usersRes, meRes]) => {
        const partnerData = partnersRes.data || [];
        const userData = usersRes.data || [];
        setPartners(partnerData);
        setAllUsers(userData);
        setCurrentUserProfile(meRes.data || null);

        if (!activePartner) {
          if (partnerId) setActivePartner(partnerId);
          else if (partnerData.length > 0) setActivePartner(partnerData[0].id);
          else if (userData.length > 0) setActivePartner(userData[0].id);
        }
      })
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!activePartner) return;
    const fetchMsgs = () => {
      directMessagesApi.getConversation(activePartner)
        .then(r => setMessages(r.data))
        .catch(() => setMessages([]));
    };
    fetchMsgs();
    const interval = setInterval(fetchMsgs, 5000);
    return () => clearInterval(interval);
  }, [activePartner]);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMsg.trim() || !activePartner) return;
    try {
      const res = await directMessagesApi.sendMessage(activePartner, newMsg);
      setMessages([...messages, res.data]);
      setNewMsg('');
      if (!partners.find(p => p.id === activePartner)) {
        loadPartners();
      }
    } catch(err) {
      alert("Failed to send message");
    }
  };

  const activePartnerData = partners.find(p => p.id === activePartner)
    || allUsers.find(p => p.id === activePartner)
    || { name: "User", fullName: "User", verified: "false" };

  return (
    <div className="w-full py-10 mt-6 min-h-screen">
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-10">
        
        {/* Header - Centered */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between border-b border-white/5 pb-8">
            <div>
              <h1 className="text-5xl font-heading font-black text-white uppercase tracking-tighter leading-none italic">
                Direct <span className="text-[#CDFF00]">Messages</span>
              </h1>
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-500 mt-4 ml-1">
                Stories, chats, and quick replies
              </p>
            </div>
            <button className="group relative px-8 py-3 rounded-full border border-white/10 bg-black/40 hover:bg-white/5 transition-all">
              <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-[0.25em] text-white">
                <span>Notifications</span>
                <span className={`inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-full font-black ${unreadNotifications > 0 ? 'bg-[#CDFF00] text-black shadow-[0_0_15px_rgba(205,255,0,0.5)]' : 'bg-white/10'}`}>
                  {unreadNotifications}
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* Story Bar - FULL WIDTH */}
        <div className="relative w-full">
          <StoryBar />
        </div>

        {/* Chat Area - Centered */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-[calc(100vh-450px)] min-h-[600px] gap-6">
            
            {/* Sidebar */}
            <div className={`w-full lg:w-80 shrink-0 flex flex-col glass rounded-3xl overflow-hidden border border-white/5 bg-[#121212] ${activePartner ? 'hidden lg:flex' : 'flex'}`}>
              <div className="p-6 border-b border-white/5">
                <h2 className="text-xl font-heading font-black text-[#CDFF00] uppercase tracking-wider">Messages</h2>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-hide">
                {partners.map((p) => {
                  const isActive = p.id === activePartner;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setActivePartner(p.id)}
                      className={`w-full text-left p-4 rounded-2xl transition-all border ${isActive ? 'bg-[#CDFF00]/10 border-[#CDFF00]/50' : 'bg-black/40 border-transparent hover:border-white/10'}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`relative w-12 h-12 rounded-xl flex items-center justify-center font-black overflow-hidden ${isActive ? 'bg-[#CDFF00] text-black' : 'bg-[#1e1e1e] text-white border border-white/10'}`}>
                          {p.avatarUrl ? <img src={p.avatarUrl} className="w-full h-full object-cover" /> : p.name?.[0] || '?'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm font-bold truncate uppercase tracking-wider ${isActive ? 'text-[#CDFF00]' : 'text-white'}`}>{p.name}</p>
                          <p className="text-[10px] text-gray-500 truncate mt-1 uppercase tracking-widest">{getStatusLine(p)}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
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
                    <div>
                      <h3 className="text-lg font-bold text-white uppercase tracking-wider">{activePartnerData.name || activePartnerData.fullName}</h3>
                      <p className="text-[10px] font-bold text-[#CDFF00] tracking-widest uppercase">{getStatusLine(activePartnerData)}</p>
                    </div>
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
                    
                    {/* Event Banner */}
                    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-[2rem] border border-[#CDFF00]/20 bg-black/60 p-8 shadow-2xl">
                      <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                        <div>
                          <h4 className="text-3xl font-black italic tracking-tighter uppercase text-white">FREEMAN <span className="text-[#CDFF00]">EVENT</span></h4>
                          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">Secure your VIP tickets now</p>
                        </div>
                        <button className="px-10 py-3 rounded-full bg-[#CDFF00] text-black font-black text-xs uppercase tracking-widest hover:scale-105 transition-all">Secure Tickets</button>
                      </div>
                    </motion.div>
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
      </motion.div>
    </div>
  );
}
