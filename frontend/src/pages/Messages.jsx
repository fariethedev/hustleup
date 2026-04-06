import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useSelector } from 'react-redux';
import { selectUser, selectIsAuthenticated } from '../store/authSlice';
import { bookingsApi, messagesApi } from '../api/client';
import { Client } from '@stomp/stompjs';
import { MessageSquareOff, Send, User, ChevronLeft, Zap, Terminal, Signal, Shield, Info } from 'lucide-react';

export default function Messages() {
  const { bookingId } = useParams();
  const user = useSelector(selectUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const navigate = useNavigate();
  
  const [bookings, setBookings] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState('');
  const [activeBooking, setActiveBooking] = useState(bookingId || null);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);
  const stompRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return; }
    bookingsApi.my().then((r) => {
      setBookings(r.data);
      if (!activeBooking && r.data.length > 0) setActiveBooking(r.data[0].id);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (!activeBooking) return;
    messagesApi.getHistory(activeBooking)
      .then((r) => setMessages(r.data))
      .catch(() => setMessages([]));

    // WebSocket connection
    try {
      const client = new Client({
        brokerURL: `ws://${window.location.host}/ws`,
        onConnect: () => {
          client.subscribe(`/topic/booking/${activeBooking}`, (msg) => {
            const data = JSON.parse(msg.body);
            setMessages((prev) => [...prev, data]);
          });
        },
      });
      client.activate();
      stompRef.current = client;
    } catch { /* WebSocket not available */ }

    return () => { stompRef.current?.deactivate(); };
  }, [activeBooking]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (!newMsg.trim() || !activeBooking) return;

    if (stompRef.current?.connected) {
      stompRef.current.publish({
        destination: `/app/chat.send/${activeBooking}`,
        body: JSON.stringify({
          senderId: user.id,
          content: newMsg,
          messageType: 'TEXT',
        }),
      });
    }
    setNewMsg('');
  };

  const activeBk = bookings.find((b) => b.id === activeBooking);
  const isBuyer = user?.id === activeBk?.buyerId;
  const peerId = activeBk ? (isBuyer ? activeBk.sellerId : activeBk.buyerId) : null;
  const peerName = activeBk ? (isBuyer ? activeBk.sellerName : activeBk.buyerName) : null;

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-8 py-10 h-[calc(100vh-100px)] flex flex-col">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        className="flex-1 flex gap-8 overflow-hidden"
      >
        {/* Sidebar: Inbound Feed */}
        <aside className={`w-full lg:w-[400px] shrink-0 flex flex-col glass rounded-[3rem] border border-white/5 bg-black/40 backdrop-blur-2xl overflow-hidden transition-all duration-500 ${activeBooking ? 'hidden lg:flex' : 'flex'}`}>
          <div className="p-10 border-b border-white/5 space-y-4">
             <div className="flex items-center justify-between">
                <h2 className="text-4xl font-black text-white uppercase tracking-tighter">INBOUND</h2>
                <div className="p-3 bg-[#CDFF00]/10 border border-[#CDFF00]/20 rounded-2xl">
                   <Signal className="w-5 h-5 text-[#CDFF00] animate-pulse" />
                </div>
             </div>
             <div className="relative group">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                   <Terminal className="w-4 h-4 text-[#CDFF00]" />
                </div>
                <input 
                  type="text" 
                  placeholder="Filter identifiers..." 
                  className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-xs font-black uppercase tracking-widest text-[#CDFF00] placeholder-gray-600 outline-none focus:border-[#CDFF00]/50 transition-all"
                />
             </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-hide">
            {loading ? (
              [...Array(4)].map((_, i) => (
                <div key={i} className="h-28 rounded-3xl bg-white/[0.02] border border-white/5 animate-pulse" />
              ))
            ) : bookings.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-10">
                 <Shield className="w-12 h-12 text-gray-700 mb-6" />
                 <p className="text-[10px] font-black text-gray-600 uppercase tracking-[0.4em]">Zero Active Protocols</p>
              </div>
            ) : (
              bookings.map((b) => {
                const active = b.id === activeBooking;
                const pName = user?.id === b.buyerId ? b.sellerName : b.buyerName;
                return (
                  <button
                    key={b.id}
                    onClick={() => setActiveBooking(b.id)}
                    className={`w-full text-left p-6 rounded-[2.5rem] transition-all relative group border-2 ${
                      active 
                        ? 'bg-[#CDFF00] border-[#CDFF00] shadow-[0_20px_40px_rgba(205,255,0,0.15)] scale-[1.02]' 
                        : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.05] hover:border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-5">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl transition-all ${
                        active ? 'bg-black text-[#CDFF00]' : 'bg-black text-white border border-white/10'
                      }`}>
                        {pName?.[0] || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                           <span className={`text-sm font-black uppercase tracking-widest truncate ${active ? 'text-black' : 'text-white'}`}>
                              {pName}
                           </span>
                           <span className={`text-[9px] font-black uppercase tracking-widest shrink-0 ${active ? 'text-black/40' : 'text-gray-500'}`}>09:42</span>
                        </div>
                        <p className={`text-[11px] font-black uppercase tracking-tighter truncate opacity-60 ${active ? 'text-black' : 'text-[#CDFF00]'}`}>
                           {b.listingTitle || 'PROTOCOL_ACTIVE'}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Chat Control Center */}
        <main className={`flex-1 flex flex-col glass rounded-[3rem] border border-white/5 bg-black/40 backdrop-blur-2xl overflow-hidden transition-all duration-500 ${activeBooking ? 'flex' : 'hidden lg:flex'}`}>
          {activeBooking ? (
            <>
              {/* Cinematic Header */}
              <header className="p-8 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                <div className="flex items-center gap-6">
                   <button 
                     onClick={() => setActiveBooking(null)} 
                     className="lg:hidden p-4 rounded-2xl bg-white/5 border border-white/10 text-white"
                   >
                     <ChevronLeft className="w-5 h-5" />
                   </button>
                   <Link to={`/profile/${peerId}`} className="relative group cursor-pointer">
                      <div className="w-16 h-16 rounded-3xl bg-black border-2 border-white/10 group-hover:border-[#CDFF00] shadow-[0_0_30px_rgba(205,255,0,0.1)] flex items-center justify-center text-[#CDFF00] font-black text-2xl transition-all">
                        {peerName?.[0]}
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-lg bg-[#22C55E] border-4 border-black" />
                   </Link>
                   <Link to={`/profile/${peerId}`} className="group cursor-pointer">
                      <h3 className="text-2xl font-black text-white uppercase tracking-tighter group-hover:text-[#CDFF00] transition-colors">{peerName || 'Direct Signal'}</h3>
                      <div className="flex items-center gap-3 mt-1 text-[10px] font-black text-[#CDFF00] uppercase tracking-[0.3em]">
                         <SignalsIcon className="w-3 h-3" /> Encrypted Channel Active
                      </div>
                   </Link>
                </div>
                
                <div className="hidden sm:flex items-center gap-4">
                   <button className="p-4 rounded-2xl bg-white/5 border border-white/10 text-gray-400 hover:text-white transition-all">
                      <Info className="w-5 h-5" />
                   </button>
                </div>
              </header>

              {/* Data Feed (Messages) */}
              <div className="flex-1 overflow-y-auto p-10 space-y-8 scrollbar-hide">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-6 opacity-30">
                     <Zap className="w-20 h-20 text-[#CDFF00]" />
                     <p className="text-xs font-black uppercase tracking-[0.5em]">Initiate Handshake</p>
                  </div>
                ) : (
                  messages.map((msg, i) => {
                    const isMe = msg.senderId === user?.id;
                    return (
                      <div key={msg.id || i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                         <div className={`max-w-[70%] space-y-2`}>
                            <div className={`px-6 py-4 rounded-[2rem] border-2 shadow-2xl transition-all ${
                              isMe 
                                ? 'bg-[#CDFF00] border-[#CDFF00] text-black rounded-br-sm' 
                                : 'bg-white/[0.03] border-white/10 text-white rounded-bl-sm'
                            }`}>
                               <p className="text-sm font-black leading-relaxed">{msg.content}</p>
                            </div>
                            <div className={`flex items-center gap-3 px-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                               <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest">
                                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                               </span>
                               {isMe && <Zap className="w-2.5 h-2.5 text-[#CDFF00] opacity-50" />}
                            </div>
                         </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Matrix */}
              <div className="p-8 bg-white/[0.02] border-t border-white/5">
                <form onSubmit={sendMessage} className="flex gap-6 items-end group">
                  <div className="flex-1 relative">
                     <textarea
                       value={newMsg}
                       onChange={(e) => setNewMsg(e.target.value)}
                       placeholder="Inject protocol sequence..."
                       className="w-full bg-black border-2 border-white/10 rounded-[2rem] px-8 py-5 text-white placeholder-gray-700 outline-none focus:border-[#CDFF00] transition-all font-black text-xs uppercase tracking-widest resize-none min-h-[72px] max-h-[200px] scrollbar-hide"
                       onKeyDown={(e) => {
                         if (e.key === 'Enter' && !e.shiftKey) {
                           e.preventDefault();
                           sendMessage(e);
                         }
                       }}
                     />
                     <div className="absolute right-6 bottom-5 flex gap-2">
                        <Terminal className="w-4 h-4 text-gray-700 group-focus-within:text-[#CDFF00]" />
                     </div>
                  </div>
                  <button
                    type="submit"
                    disabled={!newMsg.trim()}
                    className="p-6 rounded-[2rem] bg-[#CDFF00] text-black shadow-[0_10px_30px_rgba(205,255,0,0.3)] hover:scale-110 active:scale-95 transition-all disabled:opacity-20 disabled:scale-100"
                  >
                    <Send className="w-6 h-6 stroke-[3px]" />
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-20 text-center space-y-8">
               <div className="w-32 h-32 rounded-[3rem] bg-white/[0.02] border border-white/10 flex items-center justify-center relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-tr from-[#CDFF00]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <MessageSquareOff className="w-12 h-12 text-gray-700 relative z-10" />
               </div>
               <div className="space-y-4">
                  <h3 className="text-4xl font-black text-white uppercase tracking-tighter">Standby Mode</h3>
                  <p className="text-[10px] font-black text-[#CDFF00] uppercase tracking-[0.5em]">Select an active signal to engage</p>
               </div>
            </div>
          )}
        </main>
      </motion.div>
    </div>
  );
}

function SignalsIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
       <circle cx="12" cy="12" r="3" fill="currentColor" />
       <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.58 20 4 16.42 4 12C4 7.58 7.58 4 12 4C16.42 4 20 7.58 20 12C20 16.42 16.42 20 12 20Z" fill="currentColor" opacity="0.2" />
    </svg>
  );
}
