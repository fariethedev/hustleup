import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  SectionList,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Feather } from '../../src/components/native/Icon';
import { blocksApi, directMessagesApi, storiesApi, usersApi } from '../../src/api/client';
import { selectUser } from '../../src/store/authSlice';
import { Screen, usePalette, BackButton } from '../../src/components/native/Kit';
import { mediaUrl, uploadAsset } from '../../src/utils/media';
import { errorMessage, money } from '../../src/utils/marketplace';
import { chatVisible, messageVisible, useChatPrefs } from '../../src/components/chat/chatPrefs';
import { RecordingBar, VoicePlayer, useVoiceRecorder } from '../../src/components/chat/VoiceNote';
import StoryViewer from '../../src/components/stories/StoryViewer';
import CreateStoryModal from '../../src/components/stories/CreateStoryModal';
import { SafetyNotice } from '../../src/components/trust/TrustWidgets';

const READ_BLUE = '#53BDEB';
const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
const EMOJIS = [
  '😀', '😂', '🥹', '😊', '😍', '🥰', '😘', '😎', '🤩', '😜', '😏', '🙄', '😮', '😢', '😭', '😡', '🤔', '🤗', '😴', '🤭',
  '👍', '👎', '👏', '🙌', '🤝', '🙏', '💪', '👋', '✌️', '🤞', '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '💔', '💕', '💯',
  '🔥', '✨', '💫', '⭐', '🌟', '💥', '🎉', '🎊', '💎', '👑', '🚀', '💰', '🏆', '😈', '🤑', '💀', '👀', '🌈', '🍕', '🎵',
];
const AUDIENCES = [
  ['EVERYONE', 'Everyone'],
  ['FOLLOWERS', 'People who follow me'],
  ['MUTUALS', 'People I follow back'],
  ['NOBODY', 'Nobody'],
];
const POLL_MS = 3000;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const dayKey = d => new Date(d).toDateString();
function dayLabel(dateStr) {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' });
}
function listTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const diffDays = (now - d) / 86400000;
  if (diffDays < 2 && new Date(now - 86400000).toDateString() === d.toDateString()) return 'Yesterday';
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: '2-digit' });
}
const clock = d => (d ? new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '');
function lastSeenLabel(p) {
  if (!p) return '';
  if (p.typing) return 'typing…';
  if (p.online) return 'online';
  if (!p.lastSeen) return '';
  const d = new Date(p.lastSeen);
  return `last seen ${dayLabel(d).toLowerCase() === 'today' ? 'today' : dayLabel(d)} at ${clock(d)}`;
}
const reactionsOf = (m) => { try { return m.reactions ? JSON.parse(m.reactions) : {}; } catch { return {}; } };
const haptic = () => { try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch { /* optional */ } };

function Avatar({ uri, name, size = 48, ring }) {
  const theme = usePalette();
  const inner = uri
    ? <Image source={{ uri: mediaUrl(uri) }} style={{ width: size, height: size, borderRadius: size / 2 }} />
    : (
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: theme.soft, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: theme.accent, fontSize: size * 0.4, fontWeight: '900' }}>{(name || '?')[0]?.toUpperCase()}</Text>
      </View>
    );
  if (!ring) return inner;
  return <View style={{ padding: 2, borderRadius: size, borderWidth: 2.5, borderColor: ring }}>{inner}</View>;
}

function Ticks({ message, theme }) {
  if (message.pending) return <Feather name="clock" size={12} color={theme.muted} />;
  if (message.failed) return <Feather name="alert-circle" size={13} color="#FF5C5C" />;
  const read = !!message.readAt;
  const color = read ? READ_BLUE : theme.muted;
  return (
    <View style={{ flexDirection: 'row', width: read ? 18 : 12 }}>
      <Feather name="check" size={13} color={color} />
      {read && <Feather name="check" size={13} color={color} style={{ marginLeft: -8 }} />}
    </View>
  );
}

/** Bottom sheet with a list of actions — Android's Alert caps at three buttons. */
function ActionSheet({ visible, title, header, options, onClose }) {
  const theme = usePalette();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={st.backdrop} onPress={onClose} />
      <View style={[st.sheet, { backgroundColor: theme.card, paddingBottom: insets.bottom + 10 }]}>
        {!!title && <Text style={[st.sheetTitle, { color: theme.muted }]}>{title}</Text>}
        {header}
        {options.filter(Boolean).map(o => (
          <TouchableOpacity key={o.label} style={st.sheetRow} onPress={() => { onClose(); setTimeout(o.onPress, 150); }} accessibilityRole="button">
            <Feather name={o.icon} size={20} color={o.destructive ? '#FF5C5C' : theme.text} />
            <Text style={[st.sheetLabel, { color: o.destructive ? '#FF5C5C' : theme.text }]}>{o.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </Modal>
  );
}

function MediaViewer({ media, onClose }) {
  const player = useVideoPlayer(media?.type === 'VIDEO' ? mediaUrl(media.url) : null, p => { p.loop = false; p.play(); });
  if (!media) return null;
  return (
    <Modal visible animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center' }}>
        {media.type === 'VIDEO'
          ? <VideoView player={player} style={{ width: '100%', height: '80%' }} contentFit="contain" nativeControls />
          : <Image source={{ uri: mediaUrl(media.url) }} style={{ width: '100%', height: '80%' }} resizeMode="contain" />}
        {!!media.caption && <Text style={{ color: '#FFF', textAlign: 'center', padding: 16, fontSize: 15 }}>{media.caption}</Text>}
        <TouchableOpacity accessibilityLabel="Close" onPress={onClose} style={st.viewerClose}><Feather name="x" size={26} color="#FFF" /></TouchableOpacity>
      </View>
    </Modal>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────
const Bubble = memo(function Bubble({ item, mine, theme, maxWidth, partnerName, onLongPress, onReply, onOpenMedia, onOpenShared, onReact, myId }) {
  const dx = useRef(new Animated.Value(0)).current;
  const pan = useMemo(() => PanResponder.create({
    // Swipe right to reply (WhatsApp). Only claims clearly horizontal drags so the list scrolls.
    onMoveShouldSetPanResponder: (_, g) => g.dx > 12 && Math.abs(g.dy) < 10,
    onPanResponderMove: (_, g) => dx.setValue(Math.max(0, Math.min(80, g.dx))),
    onPanResponderRelease: (_, g) => {
      if (g.dx > 60) { haptic(); onReply(item); }
      Animated.spring(dx, { toValue: 0, useNativeDriver: true }).start();
    },
    onPanResponderTerminate: () => Animated.spring(dx, { toValue: 0, useNativeDriver: true }).start(),
  }), [dx, item, onReply]);

  const deleted = !!item.deletedAt;
  const type = item.messageType || 'TEXT';
  const bg = mine ? (theme.light ? '#D9FDD3' : '#144D37') : theme.card;
  const fg = theme.text;
  const sub = theme.light ? '#667781' : 'rgba(255,255,255,0.6)';
  const reactions = Object.entries(reactionsOf(item));
  const grouped = reactions.reduce((acc, [, e]) => { acc[e] = (acc[e] || 0) + 1; return acc; }, {});

  let body;
  if (deleted) {
    body = <Text style={[st.deleted, { color: sub }]}><Feather name="slash" size={13} color={sub} /> {mine ? 'You deleted this message' : 'This message was deleted'}</Text>;
  } else if (type === 'IMAGE' || type === 'VIDEO') {
    body = (
      <View style={{ gap: 6 }}>
        <TouchableOpacity activeOpacity={0.85} onPress={() => onOpenMedia({ type, url: item.mediaUrl, caption: item.content })}>
          {type === 'IMAGE'
            ? <Image source={{ uri: mediaUrl(item.localUri || item.mediaUrl) }} style={[st.media, { width: maxWidth - 16 }]} />
            : <View style={[st.media, st.videoThumb, { width: maxWidth - 16 }]}><Feather name="play-circle" size={44} color="#FFF" /><Text style={{ color: '#FFF', marginTop: 6 }}>Video</Text></View>}
        </TouchableOpacity>
        {!!item.content && <Text style={[st.text, { color: fg }]}>{item.content}</Text>}
      </View>
    );
  } else if (type === 'AUDIO') {
    body = <VoicePlayer uri={mediaUrl(item.localUri || item.mediaUrl)} durationMs={item.mediaDurationMs} tint={theme.accent} muted={sub} />;
  } else if (type === 'LISTING' || type === 'ENQUIRY') {
    body = (
      <TouchableOpacity onPress={() => onOpenShared({ kind: 'listing', id: item.sharedListingId })} style={[st.shared, { borderColor: theme.line }]}>
        {!!item.sharedListingImage && <Image source={{ uri: mediaUrl(item.sharedListingImage) }} style={st.sharedImg} />}
        <View style={{ padding: 10, gap: 2 }}>
          <Text style={{ color: sub, fontSize: 11, fontWeight: '700' }}>{type === 'ENQUIRY' ? 'ENQUIRY' : 'LISTING'}</Text>
          <Text style={{ color: fg, fontWeight: '800' }} numberOfLines={2}>{item.sharedListingTitle || 'Listing'}</Text>
          {item.sharedListingPrice != null && <Text style={{ color: theme.accent, fontWeight: '800' }}>{money(item.sharedListingPrice, item.sharedListingCurrency)}</Text>}
        </View>
        {!!item.content && <Text style={[st.text, { color: fg, paddingHorizontal: 10, paddingBottom: 8 }]}>{item.content}</Text>}
      </TouchableOpacity>
    );
  } else if (type === 'POST') {
    body = (
      <TouchableOpacity onPress={() => onOpenShared({ kind: 'profile', id: item.sharedPostAuthorId })} style={[st.shared, { borderColor: theme.line }]}>
        {!!item.sharedPostImage && <Image source={{ uri: mediaUrl(item.sharedPostImage) }} style={st.sharedImg} />}
        <View style={{ padding: 10, gap: 4 }}>
          <Text style={{ color: fg, fontWeight: '800' }}>{item.sharedPostAuthorName || 'Post'}</Text>
          {!!item.sharedPostContent && <Text style={{ color: sub }} numberOfLines={3}>{item.sharedPostContent}</Text>}
        </View>
      </TouchableOpacity>
    );
  } else if (type === 'STORY') {
    body = (
      <View style={{ gap: 6 }}>
        <View style={[st.storyReply, { borderLeftColor: theme.accent }]}>
          <Text style={{ color: sub, fontSize: 12, fontWeight: '700' }}>Status · {item.sharedStoryAuthorName || ''}</Text>
          {!!item.sharedStoryImage && <Image source={{ uri: mediaUrl(item.sharedStoryImage) }} style={{ width: 54, height: 80, borderRadius: 6, marginTop: 4 }} />}
        </View>
        {!!item.content && <Text style={[st.text, { color: fg }]}>{item.content}</Text>}
      </View>
    );
  } else if (type === 'OFFER') {
    body = (
      <TouchableOpacity onPress={() => onOpenShared({ kind: 'orders', id: item.offerBookingId })} style={[st.shared, { borderColor: theme.line, padding: 12, gap: 4 }]}>
        <Text style={{ color: theme.accent, fontWeight: '900' }}>🤝 Price offer</Text>
        {!!item.content && <Text style={{ color: fg }}>{item.content}</Text>}
        <Text style={{ color: sub, fontSize: 12 }}>Tap to review the offer</Text>
      </TouchableOpacity>
    );
  } else if (type === 'STICKER') {
    body = <Text style={{ fontSize: 46 }}>{item.content}</Text>;
  } else {
    body = <>
      <Text style={[st.text, { color: fg }]} selectable>{item.content}</Text>
      {!!item.safetyFlag && <SafetyNotice flag={item.safetyFlag} mine={mine} />}
    </>;
  }

  return (
    <Animated.View {...pan.panHandlers} style={[st.row, mine ? st.rowMine : st.rowTheirs, { transform: [{ translateX: dx }] }]}>
      <Pressable
        onLongPress={() => { haptic(); onLongPress(item); }}
        delayLongPress={280}
        style={[st.bubble, { maxWidth, backgroundColor: bg }, mine ? st.bubbleMine : st.bubbleTheirs, !theme.light && !mine && { borderWidth: 1, borderColor: theme.line }]}
      >
        {!!item.replyPreview && !deleted && (
          <View style={[st.quote, { borderLeftColor: theme.accent, backgroundColor: theme.light ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.07)' }]}>
            <Text style={{ color: theme.accent, fontWeight: '800', fontSize: 12 }}>{item.replySenderId === myId ? 'You' : partnerName}</Text>
            <Text style={{ color: sub, fontSize: 13 }} numberOfLines={2}>{item.replyPreview}</Text>
          </View>
        )}
        {body}
        <View style={st.meta}>
          {!!item.editedAt && !deleted && <Text style={[st.metaText, { color: sub }]}>edited</Text>}
          <Text style={[st.metaText, { color: sub }]}>{clock(item.createdAt)}</Text>
          {mine && !deleted && <Ticks message={item} theme={{ ...theme, muted: sub }} />}
        </View>
      </Pressable>
      {Object.keys(grouped).length > 0 && (
        <TouchableOpacity
          onPress={() => onReact(item, reactionsOf(item)[myId] || Object.keys(grouped)[0])}
          style={[st.reactions, { backgroundColor: theme.card, borderColor: theme.line }, mine ? { alignSelf: 'flex-end', marginRight: 8 } : { marginLeft: 8 }]}
        >
          {Object.entries(grouped).map(([e, n]) => <Text key={e} style={{ fontSize: 14 }}>{e}{n > 1 ? <Text style={{ fontSize: 11, color: theme.muted }}> {n}</Text> : null}</Text>)}
        </TouchableOpacity>
      )}
    </Animated.View>
  );
});

// ─── Conversation ─────────────────────────────────────────────────────────────
function ConversationView({ partner, me, prefsApi, onClose, onChanged }) {
  const theme = usePalette();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const maxWidth = Math.min(width * 0.78, 420);
  const { prefs, hideMessage, clearChat, toggleMute } = prefsApi;

  const [messages, setMessages] = useState([]);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [presence, setPresence] = useState(null);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [editing, setEditing] = useState(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [actionFor, setActionFor] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [viewer, setViewer] = useState(null);
  const [blocked, setBlocked] = useState(false);
  const [sendingMedia, setSendingMedia] = useState(false);
  const inputRef = useRef(null);
  const lastTypingPing = useRef(0);
  const recorder = useVoiceRecorder();
  const name = partner.name || partner.fullName || 'User';

  const load = useCallback(async () => {
    try {
      const res = await directMessagesApi.getConversation(partner.id);
      setMessages(Array.isArray(res.data) ? res.data : []);
    } catch { /* keep the last good copy on a transient failure */ } finally { setLoading(false); }
  }, [partner.id]);
  const loadPresence = useCallback(async () => {
    try { setPresence((await directMessagesApi.presence(partner.id)).data); } catch { /* optional */ }
  }, [partner.id]);

  useEffect(() => {
    load(); loadPresence();
    blocksApi.list().then(r => setBlocked((r.data || []).some(u => String(u.id) === String(partner.id)))).catch(() => {});
    const a = setInterval(load, POLL_MS);
    const b = setInterval(loadPresence, POLL_MS + 1000);
    return () => { clearInterval(a); clearInterval(b); };
  }, [load, loadPresence, partner.id]);

  // Newest first for the inverted list, with WhatsApp-style day separators.
  const rows = useMemo(() => {
    const visible = [...messages, ...pending].filter(m => messageVisible(prefs, partner.id, m));
    const out = [];
    let lastDay = null;
    visible.forEach(m => {
      const day = m.createdAt ? dayKey(m.createdAt) : null;
      if (day && day !== lastDay) { out.push({ id: `day-${day}`, separator: dayLabel(m.createdAt) }); lastDay = day; }
      out.push(m);
    });
    return out.reverse();
  }, [messages, pending, prefs, partner.id]);

  const onChangeText = (value) => {
    setText(value);
    const now = Date.now();
    if (value && now - lastTypingPing.current > 2500) {
      lastTypingPing.current = now;
      directMessagesApi.typing(partner.id).catch(() => {});
    }
  };

  const sendText = async () => {
    const content = text.trim();
    if (!content) return;
    if (editing) {
      const target = editing;
      setEditing(null); setText('');
      try {
        const { data } = await directMessagesApi.edit(target.id, content);
        setMessages(list => list.map(m => (m.id === data.id ? data : m)));
      } catch (e) { setText(content); Alert.alert('Couldn’t edit', errorMessage(e, 'Please try again.')); }
      return;
    }
    const tmpId = `tmp-${Date.now()}`;
    const quote = replyTo;
    const optimistic = {
      id: tmpId, pending: true, senderId: me.id, receiverId: partner.id, content, messageType: 'TEXT', createdAt: new Date().toISOString(),
      replyToId: quote?.id, replyPreview: quote ? (quote.content || 'Media') : null, replySenderId: quote?.senderId,
    };
    setPending(p => [...p, optimistic]);
    setText(''); setReplyTo(null); setShowEmoji(false);
    try {
      const { data } = await directMessagesApi.sendMessage(partner.id, content, quote ? { replyToId: quote.id } : {});
      setMessages(list => [...list, data]);
      setPending(p => p.filter(m => m.id !== tmpId));
      onChanged?.();
    } catch (e) {
      setPending(p => p.map(m => (m.id === tmpId ? { ...m, pending: false, failed: true, error: errorMessage(e) } : m)));
    }
  };

  const sendMedia = async (asset, extra = {}) => {
    setSendingMedia(true);
    const caption = text.trim();
    try {
      const fd = new FormData();
      fd.append('image', extra.file || uploadAsset(asset));
      if (caption && !extra.durationMs) fd.append('caption', caption);
      if (extra.durationMs) fd.append('durationMs', String(Math.round(extra.durationMs)));
      if (replyTo) fd.append('replyToId', replyTo.id);
      const { data } = await directMessagesApi.sendMedia(partner.id, fd);
      setMessages(list => [...list, data]);
      if (!extra.durationMs) setText('');
      setReplyTo(null);
      onChanged?.();
    } catch (e) {
      Alert.alert('Not sent', errorMessage(e, 'Could not send this file.'));
    } finally { setSendingMedia(false); }
  };

  const pick = async (camera) => {
    try {
      const permission = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted && permission.accessPrivileges !== 'limited') { Alert.alert('Permission needed', camera ? 'Allow camera access to take photos.' : 'Allow photo access to share photos and videos.'); return; }
      const opts = { mediaTypes: ['images', 'videos'], quality: 0.8, videoMaxDuration: 180 };
      const result = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      if (!result.canceled && result.assets?.[0]) await sendMedia(result.assets[0]);
    } catch (e) { Alert.alert('Couldn’t open', e.message); }
  };

  const finishVoice = async () => {
    const { uri, durationMs } = await recorder.stop();
    if (!uri || durationMs < 700) return; // an accidental tap, not a message
    await sendMedia(null, { durationMs, file: { uri, name: `voice-${Date.now()}.m4a`, type: 'audio/m4a' } });
  };

  const react = useCallback(async (message, emoji) => {
    try {
      const { data } = await directMessagesApi.react(message.id, emoji);
      setMessages(list => list.map(m => (m.id === data.id ? data : m)));
    } catch (e) { Alert.alert('Couldn’t react', errorMessage(e)); }
  }, []);

  const openShared = useCallback(({ kind, id }) => {
    if (kind === 'listing' && id) { onClose(); router.push({ pathname: '/listing/[id]', params: { id } }); }
    else if (kind === 'profile' && id) { onClose(); router.push(`/profile/${id}`); }
    else if (kind === 'orders') { onClose(); router.push(id ? { pathname: '/profile/orders', params: { bookingId: String(id) } } : '/profile/orders'); }
  }, [onClose, router]);

  const retry = (m) => {
    setPending(p => p.filter(x => x.id !== m.id));
    setText(m.content);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const action = actionFor;
  const actionMine = action?.senderId === me.id;
  const ageMs = action?.createdAt ? Date.now() - new Date(action.createdAt).getTime() : 0;
  const actionOptions = action ? (action.failed ? [
    { label: 'Retry', icon: 'refresh-cw', onPress: () => retry(action) },
    { label: 'Discard', icon: 'trash-2', destructive: true, onPress: () => setPending(p => p.filter(x => x.id !== action.id)) },
  ] : [
    !action.deletedAt && { label: 'Reply', icon: 'corner-up-left', onPress: () => { setReplyTo(action); inputRef.current?.focus(); } },
    !action.deletedAt && action.content && { label: 'Copy', icon: 'copy', onPress: () => Share.share({ message: action.content }) },
    !action.deletedAt && action.content && { label: 'Forward', icon: 'share', onPress: () => Share.share({ message: action.content }) },
    actionMine && !action.deletedAt && (action.messageType || 'TEXT') === 'TEXT' && ageMs < 15 * 60000 && { label: 'Edit', icon: 'edit-2', onPress: () => { setEditing(action); setText(action.content); inputRef.current?.focus(); } },
    { label: 'Delete for me', icon: 'trash', destructive: true, onPress: () => hideMessage(action.id) },
    actionMine && !action.deletedAt && action.messageType !== 'OFFER' && ageMs < 48 * 3600000 && {
      label: 'Delete for everyone', icon: 'trash-2', destructive: true,
      onPress: async () => {
        try { const { data } = await directMessagesApi.deleteForEveryone(action.id); setMessages(list => list.map(m => (m.id === data.id ? data : m))); }
        catch (e) { Alert.alert('Couldn’t delete', errorMessage(e)); }
      },
    },
  ]) : [];

  const toggleBlock = () => {
    if (blocked) {
      blocksApi.unblock(partner.id).then(() => setBlocked(false)).catch(e => Alert.alert('Couldn’t unblock', errorMessage(e)));
      return;
    }
    Alert.alert(`Block ${name}?`, 'Blocked contacts can no longer message you or see your status.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Block', style: 'destructive', onPress: () => blocksApi.block(partner.id).then(() => setBlocked(true)).catch(e => Alert.alert('Couldn’t block', errorMessage(e))) },
    ]);
  };

  const muted = !!prefs.muted[partner.id];
  const status = lastSeenLabel(presence);

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <StatusBar style={theme.light ? 'dark' : 'light'} />
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <View style={[st.convHeader, { paddingTop: insets.top + 6, backgroundColor: theme.card, borderBottomColor: theme.line }]}>
          <BackButton onPress={onClose} />
          <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }} onPress={() => { onClose(); router.push(`/profile/${partner.id}`); }}>
            <Avatar uri={partner.avatarUrl} name={name} size={40} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.text, fontSize: 16, fontWeight: '800' }} numberOfLines={1}>{name}{partner.isBondMatch ? ' 💚' : ''}</Text>
              {!!status && <Text style={{ color: presence?.typing || presence?.online ? theme.accent : theme.muted, fontSize: 12 }} numberOfLines={1}>{status}</Text>}
            </View>
          </TouchableOpacity>
          <TouchableOpacity accessibilityLabel="Chat options" onPress={() => setMenuOpen(true)} style={st.iconBtn}><Feather name="more-vertical" size={20} color={theme.text} /></TouchableOpacity>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {loading ? <View style={st.center}><ActivityIndicator color={theme.accent} /></View> : (
            <FlatList
              inverted
              data={rows}
              keyExtractor={item => String(item.id)}
              contentContainerStyle={{ paddingHorizontal: 10, paddingVertical: 12 }}
              keyboardShouldPersistTaps="handled"
              initialNumToRender={20}
              maxToRenderPerBatch={20}
              windowSize={11}
              renderItem={({ item }) => item.separator
                ? <View style={st.dayWrap}><Text style={[st.day, { backgroundColor: theme.card, color: theme.muted }]}>{item.separator}</Text></View>
                : (
                  <Bubble
                    item={item}
                    mine={item.senderId === me.id}
                    theme={theme}
                    maxWidth={maxWidth}
                    partnerName={name}
                    myId={me.id}
                    onLongPress={setActionFor}
                    onReply={setReplyTo}
                    onOpenMedia={setViewer}
                    onOpenShared={openShared}
                    onReact={react}
                  />
                )}
              ListEmptyComponent={
                <View style={[st.center, { transform: [{ scaleY: -1 }], paddingTop: 80 }]}>
                  <Text style={{ fontSize: 40 }}>👋</Text>
                  <Text style={{ color: theme.text, fontWeight: '700', marginTop: 8 }}>Say hello to {name}</Text>
                  <View style={[st.e2e, { backgroundColor: theme.card }]}><Feather name="lock" size={12} color={theme.muted} /><Text style={{ color: theme.muted, fontSize: 12 }}> Messages are private between you and {name}.</Text></View>
                </View>
              }
            />
          )}

          {blocked ? (
            <TouchableOpacity onPress={toggleBlock} style={[st.blockedBar, { backgroundColor: theme.card, paddingBottom: insets.bottom + 12 }]}>
              <Text style={{ color: theme.muted, textAlign: 'center' }}>You blocked {name}. <Text style={{ color: theme.accent, fontWeight: '700' }}>Tap to unblock.</Text></Text>
            </TouchableOpacity>
          ) : (
            <View style={{ backgroundColor: theme.bg, paddingBottom: Math.max(insets.bottom, 8) }}>
              {(replyTo || editing) && (
                <View style={[st.replyBar, { backgroundColor: theme.card, borderLeftColor: theme.accent }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.accent, fontWeight: '800', fontSize: 12 }}>{editing ? 'Edit message' : replyTo.senderId === me.id ? 'Replying to yourself' : `Replying to ${name}`}</Text>
                    <Text style={{ color: theme.muted }} numberOfLines={1}>{(editing || replyTo).content || 'Media'}</Text>
                  </View>
                  <TouchableOpacity accessibilityLabel="Cancel" onPress={() => { setReplyTo(null); if (editing) { setEditing(null); setText(''); } }}><Feather name="x" size={18} color={theme.muted} /></TouchableOpacity>
                </View>
              )}
              {recorder.active ? (
                <View style={[st.composer, { backgroundColor: theme.card }]}>
                  <RecordingBar durationMs={recorder.durationMs} onCancel={recorder.cancel} onSend={finishVoice} accent={theme.accent} text={theme.text} />
                </View>
              ) : (
                <View style={st.composerRow}>
                  <View style={[st.composer, { backgroundColor: theme.card, borderColor: theme.line }]}>
                    <TouchableOpacity accessibilityLabel={showEmoji ? 'Keyboard' : 'Emoji'} onPress={() => { if (!showEmoji) Keyboard.dismiss(); setShowEmoji(v => !v); }} style={st.iconBtn}>
                      <Feather name={showEmoji ? 'type' : 'smile'} size={22} color={theme.muted} />
                    </TouchableOpacity>
                    <TextInput
                      ref={inputRef}
                      style={[st.input, { color: theme.text }]}
                      placeholder="Message"
                      placeholderTextColor={theme.muted}
                      value={text}
                      onChangeText={onChangeText}
                      multiline
                      maxLength={2000}
                      onFocus={() => setShowEmoji(false)}
                    />
                    {!editing && <TouchableOpacity accessibilityLabel="Attach" onPress={() => setAttachOpen(true)} style={st.iconBtn}><Feather name="paperclip" size={20} color={theme.muted} /></TouchableOpacity>}
                    {!editing && !text && <TouchableOpacity accessibilityLabel="Camera" onPress={() => pick(true)} style={st.iconBtn}><Feather name="camera" size={20} color={theme.muted} /></TouchableOpacity>}
                  </View>
                  <TouchableOpacity
                    accessibilityLabel={text.trim() ? 'Send' : 'Record voice message'}
                    onPress={text.trim() ? sendText : () => recorder.start().catch(e => Alert.alert('Can’t record', e.message))}
                    style={[st.sendBtn, { backgroundColor: theme.accent }]}
                    disabled={sendingMedia}
                  >
                    {sendingMedia ? <ActivityIndicator color="#111" /> : <Feather name={text.trim() ? (editing ? 'check' : 'send') : 'mic'} size={20} color="#111" />}
                  </TouchableOpacity>
                </View>
              )}
              {showEmoji && (
                <ScrollView style={{ maxHeight: 220 }} contentContainerStyle={st.emojiGrid} keyboardShouldPersistTaps="always">
                  {EMOJIS.map(e => <TouchableOpacity key={e} style={st.emojiBtn} onPress={() => setText(t => t + e)}><Text style={{ fontSize: 26 }}>{e}</Text></TouchableOpacity>)}
                </ScrollView>
              )}
            </View>
          )}
        </KeyboardAvoidingView>

        <ActionSheet
          visible={!!action}
          onClose={() => setActionFor(null)}
          header={action && !action.failed && !action.deletedAt ? (
            <View style={st.reactRow}>
              {QUICK_REACTIONS.map(e => (
                <TouchableOpacity key={e} onPress={() => { const m = action; setActionFor(null); react(m, e); }} style={[st.reactBtn, reactionsOf(action)[me.id] === e && { backgroundColor: theme.soft }]}>
                  <Text style={{ fontSize: 28 }}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
          options={actionOptions}
        />
        <ActionSheet
          visible={attachOpen}
          title="Share"
          onClose={() => setAttachOpen(false)}
          options={[
            { label: 'Camera', icon: 'camera', onPress: () => pick(true) },
            { label: 'Photo & video', icon: 'image', onPress: () => pick(false) },
          ]}
        />
        <ActionSheet
          visible={menuOpen}
          title={name}
          onClose={() => setMenuOpen(false)}
          options={[
            { label: 'View profile', icon: 'user', onPress: () => { onClose(); router.push(`/profile/${partner.id}`); } },
            { label: muted ? 'Unmute notifications' : 'Mute notifications', icon: muted ? 'bell' : 'bell-off', onPress: () => toggleMute(partner.id) },
            { label: 'Clear chat', icon: 'delete', onPress: () => Alert.alert('Clear this chat?', 'Messages are removed from this device only.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Clear', style: 'destructive', onPress: () => clearChat(partner.id) }]) },
            { label: blocked ? `Unblock ${name}` : `Block ${name}`, icon: 'slash', destructive: !blocked, onPress: toggleBlock },
          ]}
        />
        <MediaViewer media={viewer} onClose={() => setViewer(null)} />
      </View>
    </Modal>
  );
}

// ─── Chat list row ────────────────────────────────────────────────────────────
const ChatRow = memo(function ChatRow({ partner, theme, pinned, muted, hasStatus, first, last, onPress, onLongPress }) {
  const unread = Number(partner.unreadCount) || 0;
  const preview = partner.typing ? 'typing…' : (partner.lastMessage || (partner.isBondMatch ? 'New Bond match. Say hi!' : 'Tap to start chatting'));
  const name = partner.name || 'User';
  const label = `${name}${partner.online ? ', online' : ''}. ${preview}.${unread ? ` ${unread} unread message${unread === 1 ? '' : 's'}.` : ''}`;
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} delayLongPress={300} accessibilityRole="button" accessibilityLabel={label} accessibilityHint="Long press for options"
      android_ripple={{ color: theme.soft }}
      style={({ pressed }) => [st.chatRow, { backgroundColor: pressed ? theme.soft : theme.card, borderTopLeftRadius: first ? 20 : 0, borderTopRightRadius: first ? 20 : 0, borderBottomLeftRadius: last ? 20 : 0, borderBottomRightRadius: last ? 20 : 0 }]}>
      <View>
        <Avatar uri={partner.avatarUrl} name={name} size={52} ring={hasStatus ? theme.purple : null} />
        {partner.online && <View style={[st.onlineDot, { backgroundColor: theme.success, borderColor: theme.card }]} />}
      </View>
      <View style={[st.rowBody, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.line }]}>
        <View style={st.rowTop}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 }}>
            <Text style={[st.chatName, { color: theme.text }]} numberOfLines={1}>{name}</Text>
            {partner.isBondMatch && <Feather name="heart" size={13} color="#DB2777" />}
            {partner.streak > 1 && <View style={st.streak}><Feather name="flame" size={12} color="#EA580C" /><Text style={{ color: '#EA580C', fontSize: 12, fontWeight: '800' }}>{partner.streak}</Text></View>}
          </View>
          <Text style={{ color: unread ? theme.purple : theme.muted, fontSize: 12, fontWeight: unread ? '700' : '500' }}>{listTime(partner.lastMessageAt || partner.matchedAt)}</Text>
        </View>
        <View style={st.rowTop}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 4 }}>
            {partner.lastMessageMine && !partner.typing && !partner.lastMessageDeleted && <Ticks message={{ readAt: partner.lastMessageRead }} theme={theme} />}
            <Text style={{ color: partner.typing ? theme.purple : unread ? theme.text : theme.muted, fontSize: 14, fontWeight: unread ? '600' : '400', flex: 1, fontStyle: partner.lastMessageDeleted ? 'italic' : 'normal' }} numberOfLines={1}>{preview}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {muted && <Feather name="bell-off" size={14} color={theme.muted} />}
            {pinned && <Feather name="pin" size={14} color={theme.muted} />}
            {unread > 0 && <View style={[st.unread, { backgroundColor: muted ? theme.muted : theme.purple }]}><Text style={st.unreadText}>{unread > 99 ? '99+' : unread}</Text></View>}
          </View>
        </View>
      </View>
    </Pressable>
  );
});

/** People you chat with who are online right now, as a strip above the list. */
function ActiveNow({ people, theme, onOpen }) {
  if (!people.length) return null;
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={[st.sectionHeader, { color: theme.muted, paddingTop: 2 }]}>Active now</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingHorizontal: 16 }}>
        {people.map(p => (
          <Pressable key={p.id} onPress={() => onOpen(p)} accessibilityRole="button" accessibilityLabel={`Chat with ${p.name || 'user'}, online`} style={{ alignItems: 'center', width: 60, gap: 5 }}>
            <View>
              <Avatar uri={p.avatarUrl} name={p.name} size={54} />
              <View style={[st.onlineDot, { width: 15, height: 15, borderRadius: 8, backgroundColor: theme.success, borderColor: theme.bg }]} />
            </View>
            <Text numberOfLines={1} style={{ color: theme.text, fontSize: 12, fontWeight: '600' }}>{(p.name || 'User').split(' ')[0]}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

// ─── Status tab (WhatsApp Status = HustleSpace stories) ──────────────────────
function StatusTab({ me, theme, onOpenPrivacy, refreshKey }) {
  const [groups, setGroups] = useState([]);
  const [mine, setMine] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await storiesApi.getAll();
      const byAuthor = {};
      (Array.isArray(data) ? data : []).forEach(story => {
        const g = byAuthor[story.authorId] ||= { id: story.authorId, name: story.authorName, avatar: story.authorAvatarUrl, stories: [] };
        g.stories.push(story);
      });
      const list = Object.values(byAuthor).map(g => ({
        ...g,
        latest: g.stories.reduce((t, s) => (s.createdAt > t ? s.createdAt : t), ''),
        allViewed: g.stories.every(s => s.viewedByCurrentUser),
      }));
      setMine(list.find(g => String(g.id) === String(me?.id)) || null);
      setGroups(list.filter(g => String(g.id) !== String(me?.id)).sort((a, b) => (b.latest > a.latest ? 1 : -1)));
    } catch { /* show whatever we had */ } finally { setLoading(false); }
  }, [me?.id]);
  useEffect(() => { load(); }, [load, refreshKey]);

  const sections = [
    { title: 'Recent updates', data: groups.filter(g => !g.allViewed) },
    { title: 'Viewed updates', data: groups.filter(g => g.allViewed) },
  ].filter(s => s.data.length);

  const row = (g, label, onPress, onAdd) => (
    <Pressable onPress={onPress} style={({ pressed }) => [st.chatRow, pressed && { backgroundColor: theme.soft }]}>
      <View>
        <Avatar uri={g?.avatar || me?.avatarUrl} name={g?.name || me?.fullName} size={54} ring={g ? (g.allViewed ? theme.line : theme.purple) : null} />
        {onAdd && <TouchableOpacity onPress={onAdd} accessibilityLabel="Add a status update" hitSlop={10} style={[st.addStatus, { backgroundColor: theme.purple, borderColor: theme.bg }]}><Feather name="plus" size={14} color="#FFFFFF" /></TouchableOpacity>}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[st.chatName, { color: theme.text }]}>{label}</Text>
        <Text style={{ color: theme.muted, fontSize: 13 }}>{g ? `${g.stories.length} update${g.stories.length > 1 ? 's' : ''} · ${listTime(g.latest)}` : 'Tap to add status update'}</Text>
      </View>
    </Pressable>
  );

  return (
    <>
      <SectionList
        sections={sections}
        keyExtractor={g => String(g.id)}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={theme.accent} />}
        contentContainerStyle={{ paddingBottom: 120 }}
        ListHeaderComponent={
          <View>
            {row(mine, 'My status', () => (mine ? setViewing(mine) : setCreating(true)), () => setCreating(true))}
            <Pressable onPress={onOpenPrivacy} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 18, minHeight: 44 }}><Feather name="lock" size={13} color={theme.purple} /><Text style={{ color: theme.purple, fontSize: 13, fontWeight: '700' }}>Status privacy</Text></Pressable>
          </View>
        }
        renderSectionHeader={({ section }) => <Text style={[st.sectionHeader, { color: theme.muted, backgroundColor: theme.bg }]}>{section.title}</Text>}
        renderItem={({ item }) => row(item, item.name || 'Member', () => setViewing(item))}
        ListEmptyComponent={!loading && <Text style={{ color: theme.muted, textAlign: 'center', padding: 30 }}>No status updates from people you can see yet.</Text>}
      />
      <StoryViewer visible={!!viewing} stories={viewing?.stories || []} onClose={() => { setViewing(null); load(); }} onAddStory={() => { setViewing(null); setCreating(true); }} />
      <CreateStoryModal visible={creating} onClose={() => setCreating(false)} onCreated={() => { setCreating(false); load(); }} />
    </>
  );
}

// ─── Privacy settings ─────────────────────────────────────────────────────────
function AudienceChoice({ field, title, hint, settings, onSave, theme }) {
  return (
    <View style={[st.privacyCard, { backgroundColor: theme.card, borderColor: theme.line }]}>
      <Text style={{ color: theme.text, fontWeight: '800', fontSize: 15 }}>{title}</Text>
      {!!hint && <Text style={{ color: theme.muted, fontSize: 12, marginBottom: 6 }}>{hint}</Text>}
      {AUDIENCES.map(([value, label]) => (
        <TouchableOpacity key={value} style={st.radioRow} onPress={() => onSave({ [field]: value })} accessibilityRole="radio" accessibilityState={{ checked: settings?.[field] === value }}>
          <View style={[st.radio, { borderColor: settings?.[field] === value ? theme.accent : theme.muted }]}>{settings?.[field] === value && <View style={[st.radioDot, { backgroundColor: theme.accent }]} />}</View>
          <Text style={{ color: theme.text, fontSize: 15 }}>{label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function PrivacySheet({ visible, onClose }) {
  const theme = usePalette();
  const insets = useSafeAreaInsets();
  const [settings, setSettings] = useState(null);
  const [blocked, setBlocked] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    setError('');
    directMessagesApi.getPrivacy().then(r => setSettings(r.data)).catch(e => setError(errorMessage(e)));
    blocksApi.list().then(r => setBlocked(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, [visible]);

  const save = async (patch) => {
    const previous = settings;
    setSettings(s => ({ ...s, ...patch }));
    try { setSettings((await directMessagesApi.updatePrivacy(patch)).data); }
    catch (e) { setSettings(previous); Alert.alert('Not saved', errorMessage(e)); }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <View style={{ flex: 1, backgroundColor: theme.bg, paddingTop: Platform.OS === 'android' ? insets.top : 0 }}>
        <View style={[st.convHeader, { borderBottomColor: theme.line }]}>
          <TouchableOpacity accessibilityLabel="Close" onPress={onClose} style={st.iconBtn}><Feather name="x" size={22} color={theme.text} /></TouchableOpacity>
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: '800', flex: 1 }}>Privacy</Text>
        </View>
        {!settings ? <View style={st.center}>{error ? <Text style={{ color: theme.muted }}>{error}</Text> : <ActivityIndicator color={theme.accent} />}</View> : (
          <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
            <AudienceChoice field="lastSeenVisibility" title="Last seen & online" hint="If you don’t share your last seen, you won’t see other people’s either." settings={settings} onSave={save} theme={theme} />
            <View style={[st.privacyCard, { backgroundColor: theme.card, borderColor: theme.line, flexDirection: 'row', alignItems: 'center' }]}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={{ color: theme.text, fontWeight: '800', fontSize: 15 }}>Read receipts</Text>
                <Text style={{ color: theme.muted, fontSize: 12 }}>If turned off, you won’t send or receive blue ticks.</Text>
              </View>
              <Switch value={!!settings.readReceipts} onValueChange={v => save({ readReceipts: v })} trackColor={{ true: theme.accent }} />
            </View>
            <AudienceChoice field="statusAudience" title="Status" hint="Who can see your status updates." settings={settings} onSave={save} theme={theme} />
            <View style={[st.privacyCard, { backgroundColor: theme.card, borderColor: theme.line }]}>
              <Text style={{ color: theme.text, fontWeight: '800', fontSize: 15 }}>Blocked contacts ({blocked.length})</Text>
              {blocked.length === 0 && <Text style={{ color: theme.muted, fontSize: 13, marginTop: 4 }}>Nobody blocked.</Text>}
              {blocked.map(u => (
                <View key={u.id} style={[st.radioRow, { justifyContent: 'space-between' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Avatar uri={u.avatarUrl} name={u.fullName} size={34} /><Text style={{ color: theme.text }}>{u.fullName || u.username}</Text></View>
                  <TouchableOpacity onPress={() => blocksApi.unblock(u.id).then(() => setBlocked(list => list.filter(x => x.id !== u.id))).catch(e => Alert.alert('Couldn’t unblock', errorMessage(e)))}>
                    <Text style={{ color: theme.accent, fontWeight: '700' }}>Unblock</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

// ─── New chat picker ──────────────────────────────────────────────────────────
function NewChat({ visible, onClose, onSelect, myId }) {
  const theme = usePalette();
  const insets = useSafeAreaInsets();
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    usersApi.getAll().then(r => setUsers((Array.isArray(r.data) ? r.data : []).filter(u => u.id !== myId))).catch(() => {}).finally(() => setLoading(false));
  }, [visible, myId]);
  const q = search.trim().toLowerCase();
  const filtered = q ? users.filter(u => `${u.fullName || ''} ${u.username || ''}`.toLowerCase().includes(q)) : users;
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      <View style={{ flex: 1, backgroundColor: theme.bg, paddingTop: insets.top }}>
        <View style={[st.convHeader, { borderBottomColor: theme.line }]}>
          <BackButton onPress={onClose} />
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: '800', flex: 1 }}>New chat</Text>
        </View>
        <View style={[st.search, { backgroundColor: theme.card, borderColor: theme.line }]}>
          <Feather name="search" size={16} color={theme.muted} />
          <TextInput autoFocus style={{ flex: 1, color: theme.text, fontSize: 15 }} placeholder="Search name or username" placeholderTextColor={theme.muted} value={search} onChangeText={setSearch} />
        </View>
        {loading ? <ActivityIndicator color={theme.accent} style={{ marginTop: 30 }} /> : (
          <FlatList
            data={filtered}
            keyExtractor={u => String(u.id)}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={15}
            renderItem={({ item }) => (
              <Pressable style={st.chatRow} onPress={() => onSelect({ id: item.id, name: item.fullName || item.username || 'User', avatarUrl: item.avatarUrl })}>
                <Avatar uri={item.avatarUrl} name={item.fullName} size={46} />
                <View style={{ flex: 1 }}>
                  <Text style={[st.chatName, { color: theme.text }]}>{item.fullName || item.username}</Text>
                  {!!item.username && <Text style={{ color: theme.muted, fontSize: 13 }}>@{item.username}</Text>}
                </View>
              </Pressable>
            )}
            ListEmptyComponent={<Text style={{ color: theme.muted, textAlign: 'center', padding: 30 }}>No people found</Text>}
          />
        )}
      </View>
    </Modal>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function MessagesScreen() {
  const theme = usePalette();
  const router = useRouter();
  const me = useSelector(selectUser);
  const prefsApi = useChatPrefs(me?.id);
  const { prefs, togglePin, toggleMute, toggleArchive, deleteChat } = prefsApi;
  const { partnerId, partnerName, partnerAvatar } = useLocalSearchParams();

  const [tab, setTab] = useState('chats');
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [open, setOpen] = useState(null);
  const [newChat, setNewChat] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [rowMenu, setRowMenu] = useState(null);
  const [statusAuthors, setStatusAuthors] = useState(new Set());
  const [statusKey, setStatusKey] = useState(0);

  const load = useCallback(async () => {
    try {
      const { data } = await directMessagesApi.getPartners();
      setPartners(Array.isArray(data) ? data : []);
    } catch { /* keep previous list */ } finally { setLoading(false); setRefreshing(false); }
  }, []);

  // Poll the list while the tab is focused, and keep "online" accurate with a heartbeat.
  useFocusEffect(useCallback(() => {
    load();
    directMessagesApi.heartbeat().catch(() => {});
    storiesApi.getAll().then(r => setStatusAuthors(new Set((r.data || []).filter(s => !s.viewedByCurrentUser).map(s => String(s.authorId))))).catch(() => {});
    const list = setInterval(load, 5000);
    const beat = setInterval(() => directMessagesApi.heartbeat().catch(() => {}), 45000);
    return () => { clearInterval(list); clearInterval(beat); };
  }, [load]));

  // Deep link from a profile, a listing or a Bond match.
  useEffect(() => {
    if (!partnerId) return;
    if (partnerName) { setOpen({ id: partnerId, name: partnerName, avatarUrl: partnerAvatar || null }); return; }
    usersApi.getProfile(partnerId)
      .then(r => setOpen({ id: r.data.id, name: r.data.fullName || r.data.username || 'User', avatarUrl: r.data.avatarUrl }))
      .catch(() => setOpen({ id: partnerId, name: 'User', avatarUrl: null }));
  }, [partnerId, partnerName, partnerAvatar]);

  const visible = useMemo(() => partners.filter(p => chatVisible(prefs, p)), [partners, prefs]);
  const archivedCount = visible.filter(p => prefs.archived[p.id]).length;
  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return visible
      .filter(p => (filter === 'archived' ? prefs.archived[p.id] : !prefs.archived[p.id]))
      .filter(p => filter !== 'unread' || Number(p.unreadCount) > 0)
      .filter(p => filter !== 'bond' || p.isBondMatch)
      .filter(p => !q || (p.name || '').toLowerCase().includes(q) || (p.lastMessage || '').toLowerCase().includes(q))
      .sort((a, b) => (prefs.pinned[b.id] || 0) - (prefs.pinned[a.id] || 0));
  }, [visible, filter, search, prefs]);
  const unreadChats = visible.filter(p => Number(p.unreadCount) > 0 && !prefs.archived[p.id]).length;

  const closeChat = () => {
    setOpen(null);
    load();
    if (partnerId) router.setParams({ partnerId: '', partnerName: '', partnerAvatar: '' });
  };

  return (
    <Screen scroll={false} showHeader={false}>
      <View style={{ flex: 1 }}>
        <View style={st.topBar}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.text, fontSize: 24, fontWeight: '800' }} accessibilityRole="header">Messages</Text>
            <Text style={{ color: theme.muted, fontSize: 13 }}>{unreadChats ? `${unreadChats} unread chat${unreadChats === 1 ? '' : 's'}` : 'You’re all caught up'}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Privacy settings" onPress={() => setPrivacy(true)} style={({ pressed }) => [st.iconBtn, { backgroundColor: theme.card, borderColor: theme.line, opacity: pressed ? 0.7 : 1 }]}>
            <Feather name="lock" size={18} color={theme.text} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="New chat" onPress={() => setNewChat(true)} style={({ pressed }) => [st.fab, { backgroundColor: theme.purple, opacity: pressed ? 0.85 : 1 }]}>
            <Feather name="square-pen" size={18} color="#FFFFFF" />
          </Pressable>
        </View>
        <View style={[st.segment, { backgroundColor: theme.soft }]} accessibilityRole="tablist">
          {[['chats', 'Chats', unreadChats], ['status', 'Status', statusAuthors.size]].map(([key, label, count]) => {
            const on = tab === key;
            return (
              <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={count ? `${label}, ${count} new` : label} onPress={() => setTab(key)}
                style={[st.segmentBtn, on && { backgroundColor: theme.card, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 }]}>
                <Text style={{ color: on ? theme.text : theme.muted, fontWeight: '700', fontSize: 14 }}>{label}</Text>
                {count > 0 && <View style={[st.segmentCount, { backgroundColor: on ? theme.purple : theme.line }]}><Text style={{ color: on ? '#FFFFFF' : theme.text, fontSize: 11, fontWeight: '800' }}>{count > 99 ? '99+' : count}</Text></View>}
              </Pressable>
            );
          })}
        </View>

        {tab === 'status' ? (
          <StatusTab me={me} theme={theme} onOpenPrivacy={() => setPrivacy(true)} refreshKey={statusKey} />
        ) : (
          <>
            <View style={[st.search, { backgroundColor: theme.card, borderColor: theme.line }]}>
              <Feather name="search" size={17} color={theme.muted} />
              <TextInput style={{ flex: 1, color: theme.text, fontSize: 15 }} placeholder="Search chats" placeholderTextColor={theme.muted} value={search} onChangeText={setSearch} accessibilityLabel="Search chats" returnKeyType="search" />
              {!!search && <Pressable onPress={() => setSearch('')} hitSlop={10} accessibilityLabel="Clear search"><Feather name="circle-x" size={17} color={theme.muted} /></Pressable>}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.filters} style={{ flexGrow: 0 }}>
              {[['all', 'All', 0], ['unread', 'Unread', unreadChats], ['bond', 'Bond', 0], ['archived', 'Archived', archivedCount]].map(([key, label, count]) => {
                const on = filter === key;
                return (
                  <Pressable key={key} onPress={() => setFilter(key)} accessibilityRole="button" accessibilityState={{ selected: on }} hitSlop={{ top: 4, bottom: 4 }}
                    style={[st.filter, { backgroundColor: on ? theme.text : theme.card, borderColor: on ? theme.text : theme.line }]}>
                    <Text style={{ color: on ? theme.bg : theme.text, fontWeight: '700', fontSize: 13 }}>{label}{count ? ` ${count}` : ''}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            {loading ? <View style={st.center}><ActivityIndicator color={theme.purple} /></View> : (
              <FlatList
                data={list}
                keyExtractor={p => String(p.id)}
                initialNumToRender={12}
                windowSize={9}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); setStatusKey(k => k + 1); }} tintColor={theme.purple} />}
                contentContainerStyle={{ paddingTop: 4, paddingBottom: 140 }}
                ListHeaderComponent={filter === 'all' && !search ? <ActiveNow people={visible.filter(p => p.online && !prefs.archived[p.id]).slice(0, 12)} theme={theme} onOpen={setOpen} /> : null}
                renderItem={({ item, index }) => (
                  <View style={{ marginHorizontal: 12 }}>
                    <ChatRow
                      partner={item}
                      theme={theme}
                      first={index === 0}
                      last={index === list.length - 1}
                      pinned={!!prefs.pinned[item.id]}
                      muted={!!prefs.muted[item.id]}
                      hasStatus={statusAuthors.has(String(item.id))}
                      onPress={() => setOpen(item)}
                      onLongPress={() => setRowMenu(item)}
                    />
                  </View>
                )}
                ListEmptyComponent={
                  <View style={[st.center, { paddingTop: 50, paddingHorizontal: 32 }]}>
                    <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: theme.purpleSoft, alignItems: 'center', justifyContent: 'center' }}>
                      <Feather name={search ? 'search-x' : filter === 'unread' ? 'circle-check' : filter === 'archived' ? 'archive' : 'messages-square'} size={34} color={theme.purple} />
                    </View>
                    <Text style={{ color: theme.text, fontWeight: '800', fontSize: 17, marginTop: 14 }}>{search ? 'No chats found' : filter === 'unread' ? 'You’re all caught up' : filter === 'archived' ? 'No archived chats' : filter === 'bond' ? 'No Bond chats yet' : 'No chats yet'}</Text>
                    <Text style={{ color: theme.muted, fontSize: 14, textAlign: 'center', marginTop: 4, lineHeight: 20 }}>{search ? 'Try a different name or word.' : filter === 'all' ? 'Message a seller from any listing, or start a chat with someone you follow.' : 'Nothing here right now.'}</Text>
                    {!search && filter === 'all' && <Pressable onPress={() => setNewChat(true)} accessibilityRole="button" style={({ pressed }) => [st.cta, { backgroundColor: theme.purple, opacity: pressed ? 0.85 : 1 }]}><Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 15 }}>Start a chat</Text></Pressable>}
                  </View>
                }
              />
            )}
          </>
        )}
      </View>

      <ActionSheet
        visible={!!rowMenu}
        title={rowMenu?.name}
        onClose={() => setRowMenu(null)}
        options={rowMenu ? [
          { label: prefs.pinned[rowMenu.id] ? 'Unpin chat' : 'Pin chat', icon: 'bookmark', onPress: () => togglePin(rowMenu.id) },
          { label: prefs.muted[rowMenu.id] ? 'Unmute' : 'Mute', icon: prefs.muted[rowMenu.id] ? 'bell' : 'bell-off', onPress: () => toggleMute(rowMenu.id) },
          { label: prefs.archived[rowMenu.id] ? 'Unarchive' : 'Archive', icon: 'archive', onPress: () => toggleArchive(rowMenu.id) },
          { label: 'View profile', icon: 'user', onPress: () => router.push(`/profile/${rowMenu.id}`) },
          { label: 'Delete chat', icon: 'trash-2', destructive: true, onPress: () => deleteChat(rowMenu.id) },
        ] : []}
      />
      {open && me && <ConversationView partner={open} me={me} prefsApi={prefsApi} onClose={closeChat} onChanged={load} />}
      <NewChat visible={newChat} myId={me?.id} onClose={() => setNewChat(false)} onSelect={(p) => { setNewChat(false); setOpen(p); }} />
      <PrivacySheet visible={privacy} onClose={() => { setPrivacy(false); setStatusKey(k => k + 1); }} />
    </Screen>
  );
}

const st = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  fab: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  iconBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  segment: { flexDirection: 'row', marginHorizontal: 16, borderRadius: 16, padding: 4, marginBottom: 12 },
  segmentBtn: { flex: 1, minHeight: 44, borderRadius: 12, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' },
  segmentCount: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginBottom: 10, borderRadius: 23, borderWidth: 1, paddingHorizontal: 16, minHeight: 46 },
  filters: { gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
  filter: { minHeight: 36, paddingHorizontal: 15, borderRadius: 18, borderWidth: 1, justifyContent: 'center' },
  chatRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 14, minHeight: 76, overflow: 'hidden' },
  rowBody: { flex: 1, gap: 3, alignSelf: 'stretch', justifyContent: 'center', paddingRight: 14, paddingVertical: 12 },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  chatName: { fontSize: 15.5, fontWeight: '700', flexShrink: 1 },
  onlineDot: { position: 'absolute', right: 1, bottom: 1, width: 14, height: 14, borderRadius: 7, backgroundColor: '#25D366', borderWidth: 2 },
  unread: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  unreadText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  addStatus: { position: 'absolute', right: -2, bottom: -2, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  sectionHeader: { fontSize: 12, fontWeight: '700', paddingHorizontal: 18, paddingTop: 14, paddingBottom: 6, textTransform: 'uppercase', letterSpacing: 0.6 },
  cta: { marginTop: 18, minHeight: 48, paddingHorizontal: 26, borderRadius: 24, justifyContent: 'center' },
  convHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingBottom: 10, paddingTop: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  dayWrap: { alignItems: 'center', marginVertical: 10 },
  day: { fontSize: 12, fontWeight: '700', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10, overflow: 'hidden' },
  row: { marginVertical: 2 },
  rowMine: { alignItems: 'flex-end' },
  rowTheirs: { alignItems: 'flex-start' },
  bubble: { borderRadius: 16, paddingHorizontal: 10, paddingTop: 7, paddingBottom: 5 },
  bubbleMine: { borderTopRightRadius: 4 },
  bubbleTheirs: { borderTopLeftRadius: 4 },
  text: { fontSize: 15.5, lineHeight: 21 },
  deleted: { fontSize: 14, fontStyle: 'italic' },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 2 },
  metaText: { fontSize: 11 },
  quote: { borderLeftWidth: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, marginBottom: 5 },
  media: { height: 240, borderRadius: 10, backgroundColor: '#222' },
  videoThumb: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a1a1a' },
  shared: { borderWidth: 1, borderRadius: 12, overflow: 'hidden', minWidth: 220 },
  sharedImg: { width: '100%', height: 150, backgroundColor: '#222' },
  storyReply: { borderLeftWidth: 3, paddingLeft: 8 },
  reactions: { flexDirection: 'row', gap: 4, borderRadius: 12, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2, marginTop: -6 },
  e2e: { flexDirection: 'row', alignItems: 'center', marginTop: 14, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  blockedBar: { padding: 16 },
  replyBar: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 8, marginTop: 6, padding: 10, borderRadius: 12, borderLeftWidth: 4 },
  composerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, paddingHorizontal: 6, paddingTop: 6 },
  composer: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 4, minHeight: 48 },
  input: { flex: 1, fontSize: 16, maxHeight: 130, paddingVertical: Platform.OS === 'ios' ? 13 : 8 },
  sendBtn: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 6, paddingVertical: 6 },
  emojiBtn: { width: '12.5%', alignItems: 'center', paddingVertical: 6 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingTop: 10, paddingHorizontal: 8 },
  sheetTitle: { textAlign: 'center', fontSize: 13, fontWeight: '700', paddingVertical: 8 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 16, minHeight: 52 },
  sheetLabel: { fontSize: 16, fontWeight: '600' },
  reactRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 8, paddingHorizontal: 4 },
  reactBtn: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  viewerClose: { position: 'absolute', top: 50, right: 18, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  privacyCard: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 2 },
  radioRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 11, height: 11, borderRadius: 6 },
});
