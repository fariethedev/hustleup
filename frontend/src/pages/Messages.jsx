import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useSelector } from 'react-redux';
import { selectUser, selectIsAuthenticated } from '../store/authSlice';
import { bookingsApi, messagesApi } from '../api/client';
import { Client } from '@stomp/stompjs';
import { MessageSquareOff, Send, User } from 'lucide-react';

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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 mt-6">
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="h-[calc(100vh-160px)]">
        <div className="flex h-full gap-6">
          {/* Sidebar: Booking threads */}
          <div className="w-80 shrink-0 hidden lg:flex flex-col glass rounded-3xl overflow-hidden border border-white/5">
            <div className="p-6 border-b border-white/5">
              <h2 className="text-xl font-heading font-black text-white uppercase tracking-wider">Messages</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-hide">
              {loading ? (
                [...Array(3)].map((_, i) => <div key={i} className="h-20 rounded-2xl bg-surface-50/50 animate-pulse" />)
              ) : bookings.length === 0 ? (
                <div className="p-8 text-center text-gray-500 font-bold uppercase tracking-widest text-xs">No conversations yet</div>
              ) : (
                bookings.map((b) => {
                  const isActive = b.id === activeBooking;
                  const peerName = user?.id === b.buyerId ? b.sellerName : b.buyerName;
                  return (
                    <button
                      key={b.id}
                      onClick={() => setActiveBooking(b.id)}
                      className={`w-full text-left p-4 rounded-2xl transition-all border outline-none ${
                        isActive 
                          ? 'bg-[#CDFF00]/10 border-[#CDFF00]/30 shadow-[0_0_15px_rgba(205,255,0,0.05)]' 
                          : 'bg-black/40 border-transparent hover:bg-white/5 hover:border-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg shrink-0 border transition-colors ${
                          isActive ? 'bg-[#CDFF00] text-black border-[#CDFF00]' : 'bg-black text-white border-white/20'
                        }`}>
                          {peerName?.[0] || '?'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm font-bold truncate uppercase tracking-wider ${isActive ? 'text-[#CDFF00]' : 'text-white'}`}>{peerName || 'User'}</p>
                          <p className="text-xs text-gray-500 truncate font-medium mt-1">{b.listingTitle || 'Booking'}</p>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Chat area */}
          <div className="flex-1 flex flex-col glass rounded-3xl overflow-hidden border border-white/5">
            {activeBooking ? (
              <>
                {/* Header */}
                <div className="p-6 border-b border-white/5 flex items-center gap-4 bg-black/40">
                  <div className="w-12 h-12 rounded-xl bg-black border border-[#CDFF00]/50 flex items-center justify-center text-[#CDFF00] font-black text-lg">
                    {(user?.id === activeBk?.buyerId ? activeBk?.sellerName : activeBk?.buyerName)?.[0] || <User className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white uppercase tracking-wider">
                      {user?.id === activeBk?.buyerId ? activeBk?.sellerName : activeBk?.buyerName || 'Chat'}
                    </h3>
                    <p className="text-xs font-bold text-[#CDFF00] tracking-widest uppercase mt-0.5">{activeBk?.listingTitle}</p>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center text-gray-500 gap-4">
                      <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                        <User className="w-8 h-8 opacity-50" />
                      </div>
                      <p className="text-sm font-bold uppercase tracking-widest">No messages yet, say hello!</p>
                    </div>
                  ) : (
                    messages.map((msg, i) => {
                      const isMe = msg.senderId === user?.id;
                      return (
                        <div key={msg.id || i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[75%] px-5 py-4 text-sm font-medium shadow-lg ${
                            isMe
                              ? 'bg-[#CDFF00] text-black rounded-3xl rounded-br-sm'
                              : 'bg-surface-50 border border-white/10 text-gray-200 rounded-3xl rounded-bl-sm'
                          }`}>
                            {!isMe && <p className="text-[10px] font-black uppercase tracking-widest text-[#CDFF00] mb-2">{msg.senderName}</p>}
                            <p className="leading-relaxed">{msg.content}</p>
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
                    placeholder="Type your message..."
                    className="flex-1 px-6 py-4 rounded-xl bg-black border border-white/10 text-white placeholder-gray-600 focus:border-[#CDFF00] focus:ring-1 focus:ring-[#CDFF00] outline-none transition-all font-medium"
                  />
                  <button
                    type="submit"
                    className="px-8 py-4 rounded-xl bg-[#CDFF00] text-black font-black hover:bg-[#E0FF4D] transition-all flex items-center justify-center"
                    disabled={!newMsg.trim()}
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </form>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <MessageSquareOff className="w-16 h-16 mx-auto text-gray-600 mb-6" />
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
