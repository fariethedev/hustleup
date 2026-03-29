import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useSelector } from 'react-redux';
import { selectUser, selectIsAuthenticated } from '../store/authSlice';
import { directMessagesApi } from '../api/client';
import { MessageSquareOff, Send, User, BadgeCheck } from 'lucide-react';

export default function DirectMessages() {
  const { partnerId } = useParams();
  const user = useSelector(selectUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const navigate = useNavigate();
  
  const [partners, setPartners] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState('');
  const [activePartner, setActivePartner] = useState(partnerId || null);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return; }
    loadPartners();
  }, [isAuthenticated, navigate]);

  const loadPartners = () => {
    directMessagesApi.getPartners()
      .then((r) => {
        setPartners(r.data);
        if (!activePartner && r.data.length > 0) setActivePartner(r.data[0].id);
        
        // If we navigated here with a parterId that isn't in our history yet, we'll just set it
        if (partnerId && !r.data.find(p => p.id === partnerId)) {
           // We might want to fetch user details to append to partners list, but for now we just rely on activePartner
        }
      })
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!activePartner) return;
    
    // Simple polling for now instead of complex WS setup for DMs
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
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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

  const activePartnerData = partners.find(p => p.id === activePartner) || { name: "User", verified: "false" };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 mt-6">
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="h-[calc(100vh-160px)]">
        <div className="flex h-full gap-6">
          {/* Sidebar */}
          <div className="w-80 shrink-0 hidden lg:flex flex-col glass rounded-3xl overflow-hidden border border-white/5 bg-[#121212]">
            <div className="p-6 border-b border-white/5">
              <h2 className="text-xl font-heading font-black text-[#CDFF00] uppercase tracking-wider">Direct Messages</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-hide">
              {loading ? (
                [...Array(3)].map((_, i) => <div key={i} className="h-20 rounded-2xl bg-white/5 animate-pulse" />)
              ) : partners.length === 0 && !partnerId ? (
                <div className="p-8 text-center text-gray-500 font-bold uppercase tracking-widest text-xs">No conversations yet</div>
              ) : (
                partners.map((p) => {
                  const isActive = p.id === activePartner;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setActivePartner(p.id)}
                      className={`w-full text-left p-4 rounded-2xl transition-all border outline-none ${
                        isActive 
                          ? 'bg-[#CDFF00]/10 border-[#CDFF00]/50 shadow-[0_0_15px_rgba(205,255,0,0.1)]' 
                          : 'bg-black border-transparent hover:bg-white/5 hover:border-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`relative w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg shrink-0 border transition-colors ${
                          isActive ? 'bg-[#CDFF00] text-black border-[#CDFF00]' : 'bg-[#1e1e1e] text-white border-white/10'
                        }`}>
                          {p.name?.[0] || '?'}
                          {p.verified === "true" && <BadgeCheck className="absolute -bottom-2 -right-2 w-5 h-5 fill-black text-[#CDFF00]" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm font-bold truncate uppercase tracking-wider ${isActive ? 'text-[#CDFF00]' : 'text-white'}`}>{p.name}</p>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Chat area */}
          <div className="flex-1 flex flex-col bg-[#111111] rounded-3xl overflow-hidden border border-white/5">
            {activePartner ? (
              <>
                {/* Header */}
                <div className="p-6 border-b border-white/5 flex items-center gap-4 bg-black/40">
                  <div className="w-12 h-12 rounded-xl bg-black border border-[#CDFF00]/50 flex items-center justify-center text-[#CDFF00] font-black text-lg relative">
                    {activePartnerData.name?.[0] || <User className="w-5 h-5" />}
                    {activePartnerData.verified === "true" && <BadgeCheck className="absolute -bottom-2 -right-2 w-5 h-5 fill-black text-[#CDFF00]" />}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      {activePartnerData.name}
                    </h3>
                    <p className="text-[10px] font-bold text-[#CDFF00] tracking-widest uppercase mt-0.5">DIRECT MESSAGE</p>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center text-gray-500 gap-4">
                      <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                        <User className="w-8 h-8 opacity-50 text-[#CDFF00]" />
                      </div>
                      <p className="text-sm font-bold uppercase tracking-widest text-[#CDFF00]">No messages yet, start networking!</p>
                    </div>
                  ) : (
                    messages.map((msg, i) => {
                      const isMe = msg.senderId === user?.id;
                      return (
                        <div key={msg.id || i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[75%] px-5 py-4 text-sm font-medium shadow-lg ${
                            isMe
                              ? 'bg-[#CDFF00] text-black rounded-3xl rounded-br-sm'
                              : 'bg-[#1E1E1E] text-white rounded-3xl rounded-bl-sm'
                          }`}>
                            <p className="leading-relaxed font-bold">{msg.content}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <form onSubmit={sendMessage} className="p-6 border-t border-white/5 flex gap-4 bg-black/40">
                  <input
                    type="text"
                    value={newMsg}
                    onChange={(e) => setNewMsg(e.target.value)}
                    placeholder="Write your message..."
                    className="flex-1 px-6 py-4 rounded-xl bg-[#1E1E1E] border border-white/10 text-white placeholder-gray-500 focus:border-[#CDFF00] focus:ring-1 focus:ring-[#CDFF00] outline-none transition-all font-bold"
                  />
                  <button
                    type="submit"
                    className="px-8 py-4 rounded-xl bg-[#CDFF00] text-black font-black uppercase tracking-widest text-xs hover:bg-[#E0FF4D] transition-all flex items-center justify-center shadow-[0_0_15px_rgba(205,255,0,0.2)] disabled:opacity-50"
                    disabled={!newMsg.trim()}
                  >
                    SEND <Send className="w-4 h-4 ml-2" />
                  </button>
                </form>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <MessageSquareOff className="w-16 h-16 mx-auto text-[#CDFF00]/50 mb-6" />
                  <h3 className="text-2xl font-black text-white uppercase tracking-wider mb-2">No Thread Selected</h3>
                  <p className="text-sm text-gray-500 font-bold tracking-widest uppercase">Select a conversation to start chatting</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
