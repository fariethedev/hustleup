import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  useWindowDimensions,
  RefreshControl,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { directMessagesApi, notificationsApi, usersApi } from '../../src/api/client';
import { selectUser } from '../../src/store/authSlice';

const LIME         = '#CDFF00';
const VIOLET       = '#7C3AED';
const VIOLET_LIGHT = '#A78BFA';
const BG           = '#0A0A0F';
const CARD         = '#12121A';
const BORDER       = 'rgba(124,62,237,0.18)';
const BASE_W       = 390; // iPhone 14 logical width — baseline for scaling

// ─── Responsive helpers ───────────────────────────────────────────────────────
// rs  = scale a spacing/size value relative to screen width
// rf  = scale a font size (capped so text never gets too huge on tablets)
// cols = how many grid columns to show based on width
const rs  = (size, w) => Math.round(size * (w / BASE_W));
const rf  = (size, w) => Math.round(size * Math.min(w / BASE_W, 1.25));
const cols = (w) => (w >= 768 ? 3 : 2); // 3 cols on iPad, 2 on phone

const EMOJIS = [
  '😀','😂','🥹','😊','😍','🥰','😘','😎','🤩','😜',
  '😏','🙄','😮','😢','😭','😡','🤔','🤗','😴','🤭',
  '👍','👎','👏','🙌','🤝','🙏','💪','👋','✌️','🤞',
  '❤️','🧡','💛','💚','💙','💜','🖤','💔','💕','💯',
  '🔥','✨','💫','⭐','🌟','💥','🎉','🎊','💎','👑',
  '🚀','💰','🏆','😈','🤑','💀','👀','🌈','🍕','🎵',
];

const NOTIF_ICONS = {
  FOLLOW:         { name: 'user-plus',     color: VIOLET_LIGHT },
  LIKE:           { name: 'heart',          color: '#F472B6' },
  COMMENT:        { name: 'message-circle', color: LIME },
  MATCH:          { name: 'zap',            color: '#FB923C' },
  POST:           { name: 'image',          color: LIME },
  LISTING:        { name: 'tag',            color: '#34D399' },
  DIRECT_MESSAGE: { name: 'message-square', color: VIOLET_LIGHT },
  SYSTEM:         { name: 'bell',           color: VIOLET_LIGHT },
};

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60)    return 'now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ─── Avatar helper ────────────────────────────────────────────────────────────
function Avatar({ uri, name, size = 48, radius = 16 }) {
  const initials = (name || '?')[0]?.toUpperCase();
  if (uri) return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: radius }} />;
  return (
    <View style={{
      width: size, height: size, borderRadius: radius,
      backgroundColor: `${VIOLET}30`, alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: BORDER,
    }}>
      <Text style={{ color: VIOLET_LIGHT, fontSize: size * 0.38, fontWeight: '900' }}>{initials}</Text>
    </View>
  );
}

// ─── Notification Card ────────────────────────────────────────────────────────
function NotifCard({ item, onPress }) {
  const icon = NOTIF_ICONS[item.notificationType] || NOTIF_ICONS.SYSTEM;
  return (
    <TouchableOpacity
      style={[styles.notifCard, !item.read && styles.notifCardUnread]}
      onPress={() => onPress?.(item)}
      activeOpacity={0.75}
    >
      <View style={[styles.notifIconWrap, { backgroundColor: `${icon.color}18`, borderColor: `${icon.color}28` }]}>
        <Feather name={icon.name} size={17} color={icon.color} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
          <Text style={styles.notifTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.notifTime}>{timeAgo(item.createdAt)}</Text>
        </View>
        <Text style={styles.notifMessage} numberOfLines={2}>{item.message}</Text>
      </View>
      {!item.read && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );
}

// ─── Partner Row ──────────────────────────────────────────────────────────────
function PartnerRow({ partner, onPress }) {
  const name     = partner.name || partner.fullName || 'Anonymous';
  const lastMsg  = partner.lastMessage || 'Tap to start chatting';
  const ago      = timeAgo(partner.lastMessageAt);
  const isUnread = (partner.unreadCount || 0) > 0;

  return (
    <TouchableOpacity style={styles.partnerRow} onPress={onPress} activeOpacity={0.7}>
      <View style={{ position: 'relative' }}>
        <Avatar uri={partner.avatarUrl} name={name} size={52} radius={18} />
        {partner.online && <View style={styles.onlineDot} />}
      </View>
      <View style={{ flex: 1, marginLeft: 14 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <Text style={[styles.partnerName, isUnread && { color: '#FFF', fontWeight: '900' }]} numberOfLines={1}>
            {name}
          </Text>
          <Text style={[styles.partnerTime, isUnread && { color: LIME }]}>{ago}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={[styles.partnerLastMsg, isUnread && { color: 'rgba(255,255,255,0.7)' }]} numberOfLines={1}>
            {lastMsg}
          </Text>
          {isUnread && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{partner.unreadCount > 9 ? '9+' : partner.unreadCount}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── User Card (2-col grid) ───────────────────────────────────────────────────
function UserCard({ user, onPress, cardWidth }) {
  const name    = user.fullName || user.username || 'User';
  const avatarS = cardWidth ? Math.round(cardWidth * 0.38) : 64;
  return (
    <TouchableOpacity style={[styles.userCard, { width: cardWidth }]} onPress={onPress} activeOpacity={0.7}>
      <View style={{ position: 'relative' }}>
        <Avatar uri={user.avatarUrl} name={name} size={avatarS} radius={Math.round(avatarS * 0.3)} />
        {user.online && (
          <View style={[styles.userCardOnline, { top: avatarS - 14, right: 2 }]} />
        )}
      </View>
      <Text style={styles.userCardName} numberOfLines={1}>{name}</Text>
      {user.verified && (
        <View style={styles.verifiedBadge}><Feather name="check" size={8} color={BG} /></View>
      )}
    </TouchableOpacity>
  );
}

// ─── New Chat Screen ──────────────────────────────────────────────────────────
function NewChatScreen({ visible, onClose, onSelectUser, currentUserId }) {
  const [users,      setUsers]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const { width: w } = useWindowDimensions();
  const insets   = useSafeAreaInsets();
  const numCols  = cols(w);
  const hPad     = rs(16, w);
  const gap      = rs(12, w);
  const cardW    = Math.floor((w - hPad * 2 - gap * (numCols - 1)) / numCols);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await usersApi.getAll();
      const all = Array.isArray(res.data) ? res.data : [];
      setUsers(all.filter(u => u.id !== currentUserId));
    } catch { /* silent */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUserId]);

  useEffect(() => { if (visible) load(); }, [visible, load]);

  const filtered = users.filter(u =>
    (u.fullName || u.username || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <StatusBar style="light" />
      <View style={{ flex: 1, backgroundColor: BG }}>
        {/* paddingTop from insets directly — SafeAreaView unreliable inside Modal */}
        <View style={{ backgroundColor: BG, paddingTop: insets.top }}>
          <View style={styles.modalHeader}>
            <TouchableOpacity style={styles.backBtn} onPress={onClose} activeOpacity={0.75}>
              <Feather name="arrow-left" size={18} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>New Message</Text>
            <View style={{ width: 40 }} />
          </View>
          <View style={styles.searchWrap}>
            <Feather name="search" size={15} color={VIOLET_LIGHT} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search people..."
              placeholderTextColor="rgba(255,255,255,0.25)"
              value={search}
              onChangeText={setSearch}
              autoFocus
            />
            {!!search && (
              <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Feather name="x" size={14} color="rgba(255,255,255,0.3)" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {loading ? (
          <View style={styles.centerLoader}><ActivityIndicator color={VIOLET_LIGHT} /></View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={item => String(item.id)}
            key={numCols} // re-mount when column count changes (orientation)
            numColumns={numCols}
            columnWrapperStyle={numCols > 1 ? { gap, paddingHorizontal: hPad, marginBottom: gap } : null}
            contentContainerStyle={{ paddingTop: 8, paddingBottom: 4 }}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={LIME} />}
            renderItem={({ item }) => (
              <UserCard
                user={item}
                cardWidth={cardW}
                onPress={() => {
                  onSelectUser({ id: item.id, name: item.fullName || item.username || 'User', avatarUrl: item.avatarUrl || null, online: false });
                  onClose();
                }}
              />
            )}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Feather name="users" size={36} color={`${VIOLET}40`} />
                <Text style={styles.emptyText}>{search ? 'No results' : 'No users found'}</Text>
              </View>
            }
          />
        )}
      </View>
    </Modal>
  );
}

// ─── Conversation View ────────────────────────────────────────────────────────
function ConversationView({ visible, partner, onClose, currentUserId }) {
  const [messages,  setMessages]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [text,      setText]      = useState('');
  const [sending,   setSending]   = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const inputRef  = useRef(null);
  const listRef   = useRef(null);
  const pollRef   = useRef(null);
  const insets    = useSafeAreaInsets();
  const { width: w, height: h } = useWindowDimensions();
  const isTablet  = w >= 768;
  const bubbleMax = w * (isTablet ? 0.55 : 0.72);
  const emojiH    = Math.round(h * 0.26); // 26% of screen height

  const name    = partner?.name || partner?.fullName || 'User';
  const initial = name[0]?.toUpperCase() || '?';

  const loadMessages = useCallback(async () => {
    if (!partner?.id) return;
    try {
      const res = await directMessagesApi.getConversation(partner.id);
      setMessages(Array.isArray(res.data) ? res.data : []);
    } catch { /* silent */ } finally { setLoading(false); }
  }, [partner?.id]);

  useEffect(() => {
    if (!visible || !partner?.id) return;
    setLoading(true);
    setMessages([]);
    loadMessages();
    pollRef.current = setInterval(loadMessages, 4000);
    return () => clearInterval(pollRef.current);
  }, [visible, partner?.id]);

  const send = async () => {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    setText('');
    setShowEmoji(false);
    try {
      await directMessagesApi.sendMessage(partner.id, content);
      await loadMessages();
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch { /* silent */ }
    setSending(false);
  };

  const renderBubble = ({ item, index }) => {
    const isMine   = item.senderId === currentUserId;
    const prevItem = messages[index - 1];
    const showAv   = !isMine && (!prevItem || prevItem.senderId !== item.senderId);

    return (
      <View style={[styles.bubbleRow, isMine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
        <View style={styles.bubbleAvatarSlot}>
          {showAv && !isMine && <Avatar uri={partner?.avatarUrl} name={name} size={28} radius={10} />}
        </View>
        <View style={[styles.bubble, { maxWidth: bubbleMax }, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
          <Text style={[styles.bubbleText, isMine ? styles.bubbleTextMine : styles.bubbleTextTheirs]}>
            {item.content}
          </Text>
          <Text style={[styles.bubbleTime, isMine ? styles.bubbleTimeMine : styles.bubbleTimeTheirs]}>
            {formatTime(item.createdAt)}
          </Text>
        </View>
      </View>
    );
  };

  if (!partner) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <StatusBar style="light" />
      <View style={{ flex: 1, backgroundColor: BG }}>

        {/* Header — paddingTop from insets directly, SafeAreaView unreliable inside Modal */}
        <View style={{ backgroundColor: CARD, borderBottomWidth: 1, borderBottomColor: BORDER, paddingTop: insets.top }}>
          <View style={styles.convHeader}>
            <TouchableOpacity style={styles.backBtn} onPress={onClose} activeOpacity={0.75}>
              <Feather name="chevron-left" size={22} color="#FFF" />
            </TouchableOpacity>
            <Avatar uri={partner.avatarUrl} name={name} size={40} radius={13} />
            <TouchableOpacity style={{ flex: 1, marginLeft: 10 }} onPress={() => Alert.alert(`${name}`, 'View profile?', [{ text: 'Cancel' }, { text: 'OK' }])} activeOpacity={0.7}>
              <Text style={styles.convName}>{name}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: partner.online ? '#22C55E' : '#444' }} />
                <Text style={{ color: partner.online ? '#22C55E' : 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: '600' }}>
                  {partner.online ? 'Online' : 'Offline'}
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerAction} onPress={() => Alert.alert('📞 Voice Call', `Call ${name}?`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Call', onPress: () => Alert.alert('Calling...', `Connecting to ${name}...`) }])} activeOpacity={0.75}>
              <Feather name="phone" size={17} color={VIOLET_LIGHT} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerAction} onPress={() => Alert.alert('📹 Video Call', `Video call ${name}?`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Call', onPress: () => Alert.alert('Connecting...', `Video calling ${name}...`) }])} activeOpacity={0.75}>
              <Feather name="video" size={17} color={VIOLET_LIGHT} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Messages */}
        <View style={{ flex: 1 }}>
          {loading ? (
            <View style={styles.centerLoader}><ActivityIndicator color={VIOLET_LIGHT} /></View>
          ) : (
            <FlatList
              ref={listRef}
              data={messages}
              renderItem={renderBubble}
              keyExtractor={(item, idx) => item.id?.toString() || String(idx)}
              contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 16, gap: 4 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
              ListEmptyComponent={
                <View style={styles.emptyConv}>
                  <Text style={{ fontSize: 40 }}>👋</Text>
                  <Text style={styles.emptyText}>Say hello to {name}!</Text>
                </View>
              }
            />
          )}
        </View>

        {/* Input */}
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          {showEmoji && (
            <View style={[styles.emojiPanel, { height: emojiH }]}>
              <ScrollView horizontal={false} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="always" contentContainerStyle={styles.emojiGrid}>
                {EMOJIS.map((e, i) => (
                  <TouchableOpacity key={i} style={styles.emojiBtn} onPress={() => { setText(p => p + e); inputRef.current?.focus(); }} activeOpacity={0.6}>
                    <Text style={{ fontSize: 26 }}>{e}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
          <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.inputInner}>
              <TouchableOpacity
                style={styles.emojiToggle}
                onPress={() => { if (!showEmoji) Keyboard.dismiss(); setShowEmoji(v => !v); }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 22 }}>{showEmoji ? '⌨️' : '😊'}</Text>
              </TouchableOpacity>
              <TextInput
                ref={inputRef}
                style={styles.inputField}
                placeholder="Message..."
                placeholderTextColor="rgba(255,255,255,0.28)"
                value={text}
                onChangeText={setText}
                multiline
                maxLength={1000}
                onFocus={() => setShowEmoji(false)}
              />
              <TouchableOpacity
                style={[styles.sendBtn, (!text.trim() || sending) && { opacity: 0.35 }]}
                onPress={send}
                disabled={!text.trim() || sending}
                activeOpacity={0.8}
              >
                {sending ? <ActivityIndicator size="small" color={BG} /> : <Feather name="send" size={16} color={BG} />}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>

      </View>
    </Modal>
  );
}

// ─── Notifications Tab ────────────────────────────────────────────────────────
function NotificationsTab() {
  const [notifs,     setNotifs]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await notificationsApi.getAll();
      setNotifs(Array.isArray(res.data) ? res.data : []);
    } catch { /* silent */ } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const markRead = async (item) => {
    if (item.read) return;
    try {
      await notificationsApi.markRead(item.id);
      setNotifs(prev => prev.map(n => n.id === item.id ? { ...n, read: true } : n));
    } catch { /* silent */ }
  };

  const unreadCount = notifs.filter(n => !n.read).length;

  if (loading) return <View style={styles.centerLoader}><ActivityIndicator color={VIOLET_LIGHT} /></View>;

  return (
    <FlatList
      data={notifs}
      keyExtractor={item => String(item.id)}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 4 }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={LIME} />}
      ListHeaderComponent={
        unreadCount > 0 ? (
          <TouchableOpacity style={styles.markAllBtn} onPress={async () => {
            try { await notificationsApi.markAllRead(); setNotifs(prev => prev.map(n => ({ ...n, read: true }))); } catch { /* silent */ }
          }} activeOpacity={0.8}>
            <Feather name="check-circle" size={13} color={LIME} />
            <Text style={{ color: LIME, fontSize: 12, fontWeight: '800' }}>Mark all read</Text>
          </TouchableOpacity>
        ) : null
      }
      renderItem={({ item }) => <NotifCard item={item} onPress={markRead} />}
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <Feather name="bell-off" size={36} color={`${VIOLET}40`} />
          <Text style={styles.emptyText}>No notifications yet</Text>
        </View>
      }
    />
  );
}

// ─── Messages Tab ─────────────────────────────────────────────────────────────
function MessagesTab({ onSelectPartner }) {
  const [partners,   setPartners]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search,     setSearch]     = useState('');
  const { width: w } = useWindowDimensions();
  const hPad = rs(16, w);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await directMessagesApi.getPartners();
      setPartners(Array.isArray(res.data) ? res.data : []);
    } catch { /* silent */ } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = partners.filter(p =>
    (p.name || p.fullName || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <View style={styles.searchWrap}>
        <Feather name="search" size={15} color={VIOLET_LIGHT} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search messages..."
          placeholderTextColor="rgba(255,255,255,0.25)"
          value={search}
          onChangeText={setSearch}
        />
        {!!search && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="x" size={14} color="rgba(255,255,255,0.3)" />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.centerLoader}><ActivityIndicator color={VIOLET_LIGHT} /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={{ paddingHorizontal: hPad, paddingBottom: 4 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={LIME} />}
          renderItem={({ item }) => <PartnerRow partner={item} onPress={() => onSelectPartner(item)} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Feather name="message-circle" size={36} color={`${VIOLET}40`} />
              <Text style={styles.emptyText}>{search ? 'No results' : 'No conversations yet'}</Text>
              <Text style={styles.emptySubText}>{search ? '' : 'Tap ✏️ to start a chat'}</Text>
            </View>
          }
        />
      )}
    </>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function MessagesScreen() {
  const [activeTab,        setActiveTab]       = useState('messages');
  const [selectedPartner,  setSelectedPartner] = useState(null);
  const [showNewChat,      setShowNewChat]      = useState(false);
  const [unreadCount,      setUnreadCount]      = useState(0);
  const currentUser  = useSelector(selectUser);
  const router       = useRouter();
  const { width: w } = useWindowDimensions();
  const isTablet     = w >= 768;
  const { partnerId, partnerName, partnerAvatar } = useLocalSearchParams();

  // Auto-open from profile
  useEffect(() => {
    if (!partnerId) return;
    if (partnerName) {
      setSelectedPartner({ id: partnerId, name: partnerName, avatarUrl: partnerAvatar || null, online: false });
    } else {
      usersApi.getProfile(partnerId)
        .then(res => {
          const u = res.data;
          setSelectedPartner({ id: u.id, name: u.fullName || u.username || 'User', avatarUrl: u.avatarUrl || null, online: false });
        })
        .catch(() => setSelectedPartner({ id: partnerId, name: 'User', avatarUrl: null, online: false }));
    }
  }, [partnerId]);

  useEffect(() => {
    notificationsApi.unreadCount().then(r => setUnreadCount(r.data?.count || 0)).catch(() => {});
  }, [activeTab]);

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar style="light" />

      {/* Modals — render above everything including tab bar */}
      <NewChatScreen
        visible={showNewChat}
        currentUserId={currentUser?.id}
        onClose={() => setShowNewChat(false)}
        onSelectUser={(partner) => { setSelectedPartner(partner); setShowNewChat(false); }}
      />
      <ConversationView
        visible={!!selectedPartner}
        partner={selectedPartner}
        currentUserId={currentUser?.id}
        onClose={() => {
          setSelectedPartner(null);
          router.setParams({ partnerId: '', partnerName: '', partnerAvatar: '' });
        }}
      />

      <SafeAreaView edges={['top']} style={{ backgroundColor: BG }}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Inbox</Text>
          <View style={{ flex: 1 }} />
          {unreadCount > 0 && (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
            </View>
          )}
          <TouchableOpacity style={styles.composeBtn} onPress={() => setShowNewChat(true)} activeOpacity={0.8}>
            <Feather name="edit" size={17} color={BG} />
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={styles.tabBar}>
          {['messages', 'notifications'].map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.8}
            >
              <Feather
                name={tab === 'messages' ? 'message-circle' : 'bell'}
                size={14}
                color={activeTab === tab ? '#FFF' : 'rgba(255,255,255,0.3)'}
              />
              <Text style={[styles.tabBtnText, activeTab === tab && styles.tabBtnTextActive]}>
                {tab === 'messages' ? 'Messages' : 'Notifications'}
              </Text>
              {tab === 'notifications' && unreadCount > 0 && (
                <View style={styles.tabBadge}><Text style={styles.tabBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text></View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </SafeAreaView>

      {activeTab === 'messages'
        ? <MessagesTab onSelectPartner={setSelectedPartner} />
        : <NotificationsTab />
      }
    </View>
  );
}

const styles = StyleSheet.create({
  centerLoader: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14,
  },
  headerTitle: { color: '#FFF', fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  headerBadge: {
    backgroundColor: '#FF3B30', borderRadius: 10,
    paddingHorizontal: 7, paddingVertical: 2, minWidth: 20, alignItems: 'center',
  },
  headerBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '900' },
  composeBtn: {
    width: 40, height: 40, borderRadius: 13,
    backgroundColor: LIME, alignItems: 'center', justifyContent: 'center',
  },

  // Tab bar
  tabBar: {
    flexDirection: 'row', marginHorizontal: 16, marginBottom: 12,
    backgroundColor: CARD, borderRadius: 14, padding: 3,
    borderWidth: 1, borderColor: BORDER,
  },
  tabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 9, borderRadius: 11,
  },
  tabBtnActive: { backgroundColor: VIOLET },
  tabBtnText: { color: 'rgba(255,255,255,0.3)', fontSize: 13, fontWeight: '800' },
  tabBtnTextActive: { color: '#FFF' },
  tabBadge: {
    backgroundColor: '#FF3B30', borderRadius: 8,
    paddingHorizontal: 5, paddingVertical: 1, minWidth: 16, alignItems: 'center',
  },
  tabBadgeText: { color: '#FFF', fontSize: 9, fontWeight: '900' },

  // Search
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  searchInput: { flex: 1, color: '#FFF', fontSize: 14 },

  // Partner row
  partnerRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: CARD, borderRadius: 18, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: BORDER,
  },
  onlineDot: {
    position: 'absolute', bottom: 1, right: 1,
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: '#22C55E', borderWidth: 2, borderColor: BG,
  },
  partnerName: { color: 'rgba(255,255,255,0.75)', fontSize: 15, fontWeight: '700', flex: 1, marginRight: 8 },
  partnerTime: { color: 'rgba(255,255,255,0.25)', fontSize: 11, fontWeight: '600' },
  partnerLastMsg: { color: 'rgba(255,255,255,0.35)', fontSize: 13, flex: 1, marginRight: 8 },
  unreadBadge: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: LIME,
    alignItems: 'center', justifyContent: 'center',
  },
  unreadBadgeText: { color: BG, fontSize: 10, fontWeight: '900' },

  // Notification
  notifCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: CARD, borderRadius: 16, padding: 13, marginBottom: 8,
    borderWidth: 1, borderColor: BORDER,
  },
  notifCardUnread: { borderColor: `${VIOLET}40`, backgroundColor: `${VIOLET}08` },
  notifIconWrap: {
    width: 42, height: 42, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12, borderWidth: 1, flexShrink: 0,
  },
  notifTitle: { color: '#FFF', fontSize: 14, fontWeight: '800', flex: 1, marginRight: 8 },
  notifTime:  { color: 'rgba(255,255,255,0.25)', fontSize: 11, fontWeight: '600' },
  notifMessage: { color: 'rgba(255,255,255,0.45)', fontSize: 13, lineHeight: 18 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: LIME, marginLeft: 10 },
  markAllBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-end', marginBottom: 12,
    paddingHorizontal: 12, paddingVertical: 7,
    backgroundColor: `${LIME}12`, borderRadius: 10, borderWidth: 1, borderColor: `${LIME}25`,
  },

  // User card grid — width set dynamically via prop
  userCard: {
    backgroundColor: CARD, borderRadius: 20, borderWidth: 1, borderColor: BORDER,
    padding: 16, alignItems: 'center', gap: 10, position: 'relative',
  },
  userCardOnline: {
    position: 'absolute', top: 16 + 44, right: 16 + 4,
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: '#22C55E', borderWidth: 2, borderColor: CARD,
  },
  userCardName: { color: '#FFF', fontSize: 14, fontWeight: '800', textAlign: 'center' },
  verifiedBadge: {
    position: 'absolute', top: 10, right: 10,
    width: 18, height: 18, borderRadius: 9, backgroundColor: LIME,
    alignItems: 'center', justifyContent: 'center',
  },

  // Modal header
  modalHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 14,
  },
  modalTitle: {
    flex: 1, textAlign: 'center',
    color: '#FFF', fontSize: 17, fontWeight: '900',
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: `${VIOLET}25`, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: BORDER,
  },

  // Conversation
  convHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  convName: { color: '#FFF', fontSize: 16, fontWeight: '900' },
  headerAction: {
    width: 36, height: 36, borderRadius: 11,
    backgroundColor: `${VIOLET}20`, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: BORDER,
  },

  // Bubbles
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginBottom: 2 },
  bubbleRowMine:   { justifyContent: 'flex-end' },
  bubbleRowTheirs: { justifyContent: 'flex-start' },
  bubbleAvatarSlot: { width: 28, flexShrink: 0 },
  // Bubbles — maxWidth set dynamically via inline style
  bubble: { borderRadius: 18, paddingHorizontal: 13, paddingVertical: 9 },
  bubbleMine: { backgroundColor: LIME, borderBottomRightRadius: 4 },
  bubbleTheirs: {
    backgroundColor: `${VIOLET}22`, borderBottomLeftRadius: 4,
    borderWidth: 1, borderColor: `${VIOLET}40`,
  },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  bubbleTextMine:   { color: '#0A0A0F', fontWeight: '700' },
  bubbleTextTheirs: { color: '#FFF' },
  bubbleTime: { fontSize: 10, fontWeight: '600', marginTop: 3, alignSelf: 'flex-end' },
  bubbleTimeMine:   { color: 'rgba(0,0,0,0.4)' },
  bubbleTimeTheirs: { color: `${VIOLET_LIGHT}80` },

  // Input
  inputBar: {
    paddingHorizontal: 12, paddingTop: 10,
    backgroundColor: CARD,
    borderTopWidth: 1, borderTopColor: BORDER,
  },
  emojiToggle: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  inputField: {
    flex: 1, color: '#FFF', fontSize: 15,
    minHeight: 36, maxHeight: 120, paddingVertical: 6, paddingHorizontal: 4,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 13,
    backgroundColor: LIME, alignItems: 'center', justifyContent: 'center',
  },

  // Emoji panel
  emojiPanel: {
    height: 200, backgroundColor: CARD,
    borderTopWidth: 1, borderTopColor: BORDER,
  },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 6, paddingVertical: 8 },
  emojiBtn: { width: '16.66%', alignItems: 'center', paddingVertical: 6 },

  // Input inner row
  inputInner: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    backgroundColor: `${VIOLET}12`,
    borderRadius: 18, borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 10, paddingVertical: 6,
    marginBottom: 4,
  },

  // Empty states
  emptyState: { paddingTop: 80, alignItems: 'center', gap: 10 },
  emptyText:  { color: 'rgba(255,255,255,0.2)', fontSize: 15, fontWeight: '700' },
  emptySubText: { color: 'rgba(255,255,255,0.1)', fontSize: 12 },
  emptyConv: { flex: 1, paddingTop: 100, alignItems: 'center', gap: 12 },
});

