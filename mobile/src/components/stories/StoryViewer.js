import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, AppState, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useSelector } from 'react-redux';
import { Flame, SendHorizontal, MessageCircleMore, Eye, X, Trash2, Plus, Volume2, VolumeX } from 'lucide-react-native';
import { selectUser } from '../../store/authSlice';
import { storiesApi, directMessagesApi } from '../../api/client';
import { mediaUrl } from '../../utils/media';

const LIME = '#CDFF00';
function StoryAction({ Icon, label, onPress, color = '#FFF' }) {
 return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon size={22} color={color} /></Pressable>;
}
function VideoStory({ uri, paused, muted, onEnd, onProgress }) {
  const player = useVideoPlayer(uri);
  // Expo's native player exposes mutable properties; this is not React state.
  // eslint-disable-next-line react-hooks/immutability
  useEffect(() => { player.muted = muted; if (paused) player.pause(); else player.play(); }, [player, paused, muted]);
  useEffect(() => { const listener = player.addListener('playToEnd', onEnd); return () => listener.remove(); }, [player, onEnd]);
  useEffect(() => {
    const timer = setInterval(() => { if (player.duration > 0) onProgress(Math.min(1, player.currentTime / player.duration)); }, 200);
    return () => clearInterval(timer);
  }, [player, onProgress]);
  return <VideoView player={player} style={{ width: '100%', height: '100%' }} contentFit="contain" nativeControls={false} />;
}
function FloatingComment({ comment }) {
  const [opacity] = useState(() => new Animated.Value(0));
  const [y] = useState(() => new Animated.Value(16));
  useEffect(() => {
    const animation = Animated.parallel([Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }), Animated.timing(y, { toValue: 0, duration: 350, useNativeDriver: true })]);
    animation.start(); return () => animation.stop();
  }, [opacity, y]);
  return <Animated.View style={{ opacity, transform: [{ translateY: y }], backgroundColor: '#000A', padding: 9, borderRadius: 16, alignSelf: 'flex-start', maxWidth: '90%' }}><Text numberOfLines={2} style={{ color: '#FFF', fontSize: 12 }}><Text style={{ fontWeight: '700' }}>{comment.authorName}: </Text>{comment.content}</Text></Animated.View>;
}
export default function StoryViewer(props) {
  return props.visible ? <StorySession key={props.stories?.[0]?.id || 'stories'} {...props} /> : null;
}
function StorySession({ stories = [], initialIndex = 0, onClose, onAddStory }) {
  const [index, setIndex] = useState(Math.min(initialIndex, Math.max(0, stories.length - 1)));
  const next = () => index < stories.length - 1 ? setIndex(i => i + 1) : onClose();
  if (!stories[index]) return null;
  return <Modal visible animationType="fade" onRequestClose={onClose}><StoryFrame key={stories[index].id} story={stories[index]} index={index} count={stories.length} onNext={next} onPrevious={() => setIndex(i => Math.max(0, i - 1))} onClose={onClose} onAddStory={onAddStory} /></Modal>;
}
function StoryFrame({ story, index, count, onNext, onPrevious, onClose, onAddStory }) {
  const user = useSelector(selectUser), owner = user?.id === story.authorId;
  const [held, setHeld] = useState(false), [background, setBackground] = useState(false);
  const [mode, setMode] = useState(null), [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [comments, setComments] = useState([]), [viewers, setViewers] = useState([]);
  const [commentsError, setCommentsError] = useState('');
  const [viewersLoading, setViewersLoading] = useState(false), [viewersError, setViewersError] = useState('');
  const [liked, setLiked] = useState(!!story.likedByCurrentUser), [likes, setLikes] = useState(story.likesCount || 0);
  const [muted, setMuted] = useState(true), [progress, setProgress] = useState(0);
  const [floatIndex, setFloatIndex] = useState(0), [showFloats, setShowFloats] = useState(true);
  const alive = useRef(true), actionLock = useRef(false), elapsed = useRef(0), longPress = useRef(false);
  const paused = held || background || !!mode || busy;
  const video = story.type === 'VIDEO';
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => setBackground(state !== 'active'));
    if (user && !owner) storiesApi.view(story.id).catch(() => {});
    return () => listener.remove();
  }, [story.id, user, owner]);
  useEffect(() => {
    if (!user) return;
    let active = true;
    const load = async () => {
      try { const { data } = await storiesApi.comments(story.id); if (active) { setComments(Array.isArray(data) ? data : []); setCommentsError(''); } }
      catch { if (active) setCommentsError('Comments could not load. Retrying shortly.'); }
    };
    load(); const timer = setInterval(load, 12000);
    return () => { active = false; clearInterval(timer); };
  }, [story.id, user]);
  useEffect(() => {
    if (paused || video) return;
    const timer = setInterval(() => {
      elapsed.current += 100;
      setProgress(Math.min(1, elapsed.current / 7000));
      if (elapsed.current >= 7000) { clearInterval(timer); onNext(); }
    }, 100);
    return () => clearInterval(timer);
  }, [paused, video, onNext]);
  useEffect(() => {
    if (paused || !showFloats) return;
    const timer = setInterval(() => setFloatIndex(n => n + 1), 3500);
    return () => clearInterval(timer);
  }, [paused, showFloats]);
  const send = async () => {
    if (actionLock.current || !draft.trim()) return;
    actionLock.current = true; setBusy(true); setError('');
    try {
      if (mode === 'comment') {
        const { data } = await storiesApi.addComment(story.id, draft.trim());
        if (alive.current) { setComments(rows => [data, ...rows].slice(0, 50)); setFloatIndex(0); }
      } else await directMessagesApi.sendMessage(story.authorId, 'Reply to your story: ' + draft.trim());
      if (alive.current) { setDraft(''); setMode(null); }
    } catch (e) { if (alive.current) setError(e.response?.data?.error || 'Could not send. Your text is still here.'); }
    finally { actionLock.current = false; if (alive.current) setBusy(false); }
  };
  const like = async () => {
    if (!user || actionLock.current) return;
    actionLock.current = true;
    try {
      const { data } = await (liked ? storiesApi.unlike(story.id) : storiesApi.like(story.id));
      if (alive.current) { setLiked(!liked); setLikes(data.likesCount ?? Math.max(0, likes + (liked ? -1 : 1))); }
    } catch { if (alive.current) setError('Could not update reaction. Please retry.'); }
    finally { actionLock.current = false; }
  };
  const audience = async () => {
    setMode('viewers'); setViewersLoading(true); setViewersError('');
    try { const { data } = await storiesApi.viewers(story.id); if (alive.current) setViewers(data || []); }
    catch { if (alive.current) setViewersError('Could not load viewers. Try again.'); }
    finally { if (alive.current) setViewersLoading(false); }
  };
  const removeComment = comment => Alert.alert('Delete comment?', 'This removes the comment for everyone.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => {
    try { await storiesApi.deleteComment(story.id, comment.id); if (alive.current) setComments(rows => rows.filter(row => row.id !== comment.id)); }
    catch { if (alive.current) setError('Could not delete comment.'); }
  } }]);
  const removeStory = () => {
    setHeld(true);
    Alert.alert('Delete story?', 'This cannot be undone.', [{ text: 'Cancel', style: 'cancel', onPress: () => setHeld(false) }, { text: 'Delete', style: 'destructive', onPress: async () => {
      try { await storiesApi.delete(story.id); onClose(); } catch { setError('Could not delete story.'); setHeld(false); }
    } }], { cancelable: false });
  };
  const open = value => { setError(''); setMode(value); setDraft(''); };

  const bubbles = comments.length ? [comments[floatIndex % comments.length], ...(comments.length > 1 ? [comments[(floatIndex + 1) % comments.length]] : [])] : [];
  return <SafeAreaView style={{ flex: 1, backgroundColor: '#050505' }}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
    <View style={{ flexDirection: 'row', gap: 3, padding: 10 }}>{Array.from({ length: count }, (_, n) => <View key={n} style={{ flex: 1, height: 3, backgroundColor: '#555', borderRadius: 3, overflow: 'hidden' }}><View style={{ height: 3, width: (n < index ? 100 : n === index ? progress * 100 : 0) + '%', backgroundColor: LIME }} /></View>)}</View>
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 }}>
      {story.authorAvatarUrl && <Image source={{ uri: mediaUrl(story.authorAvatarUrl) }} style={{ width: 32, height: 32, borderRadius: 16, marginRight: 8 }} />}
      <Text numberOfLines={1} style={{ color: '#FFF', fontWeight: '700', flex: 1 }}>{story.authorName || 'User'}</Text>
      {video && <StoryAction Icon={muted ? VolumeX : Volume2} label={muted ? 'Unmute story' : 'Mute story'} onPress={() => setMuted(v => !v)} />}
      {owner && onAddStory && <StoryAction Icon={Plus} label="Add story" onPress={onAddStory} />}
      {owner && <StoryAction Icon={Trash2} label="Delete story" onPress={removeStory} />}
      {<StoryAction Icon={X} label="Close story" onPress={onClose} />}
    </View>
    <View style={{ flex: 1, minHeight: 80, position: 'relative' }}>
      {video && story.mediaUrl ? <VideoStory uri={mediaUrl(story.mediaUrl)} paused={paused} muted={muted} onEnd={onNext} onProgress={setProgress} /> : story.mediaUrl ? <Image source={{ uri: mediaUrl(story.mediaUrl) }} style={{ width: '100%', height: '100%' }} resizeMode="contain" /> : <View style={{ flex: 1, justifyContent: 'center', padding: 28 }}><Text style={{ color: '#FFF', fontSize: 28, textAlign: 'center' }}>{story.content}</Text></View>}
      <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, flexDirection: 'row' }}>{[onPrevious, onNext].map((action, n) => <Pressable key={n} accessibilityLabel={n ? 'Next story' : 'Previous story'} style={{ flex: n ? 2 : 1 }} onPressIn={() => { longPress.current = false; setHeld(true); }} onLongPress={() => { longPress.current = true; }} onPressOut={() => setHeld(false)} onPress={() => { if (!longPress.current) action(); }} />)}</View>
      {showFloats && !mode && <View pointerEvents="none" style={{ position: 'absolute', left: 12, right: 12, bottom: 16, gap: 6 }}>{bubbles.map(comment => <FloatingComment key={comment.id} comment={comment} />)}</View>}
    </View>
    {!!(error || (mode === 'comments' && commentsError)) && <Text accessibilityRole="alert" style={{ color: '#FF8A8A', padding: 10 }}>{error || commentsError}</Text>}
    {mode === 'viewers' || mode === 'comments' ? <View style={{ maxHeight: '40%', padding: 14, backgroundColor: '#181818', borderRadius: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}><Text style={{ color: '#FFF', flex: 1 }}>{mode === 'viewers' ? 'Seen by' : 'Comments visible to story viewers'}</Text>{<StoryAction Icon={X} label="Close panel" onPress={() => setMode(null)} />}</View>
      <ScrollView>{mode === 'viewers' ? viewersLoading ? <ActivityIndicator color={LIME} /> : viewersError ? <Pressable onPress={audience}><Text style={{ color: '#FF8A8A' }}>{viewersError}</Text></Pressable> : viewers.length ? viewers.map(person => <Text key={person.id} style={{ color: '#FFF', padding: 12 }}>{person.name}</Text>) : <Text style={{ color: '#AAA' }}>No viewers yet.</Text> : comments.length ? comments.map(comment => <View key={comment.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}><Text style={{ flex: 1, color: '#FFF' }}>{comment.authorName}: {comment.content}</Text>{(owner || comment.authorId === user?.id) && <StoryAction Icon={Trash2} label="Delete comment" onPress={() => removeComment(comment)} />}</View>) : <Text style={{ color: '#AAA' }}>No comments yet.</Text>}</ScrollView>
    </View> : mode ? <View style={{ padding: 12, gap: 8 }}>
      <Text style={{ color: '#AAA', fontSize: 12 }}>{mode === 'comment' ? 'Public comment · visible to people who can view this story' : 'Private reply · sent only to the author in Messages'}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}><TextInput accessibilityLabel={mode === 'comment' ? 'Public story comment' : 'Private story reply'} value={draft} onChangeText={setDraft} maxLength={mode === 'comment' ? 300 : 1000} placeholder="Write here…" placeholderTextColor="#888" style={{ flex: 1, minHeight: 44, color: '#FFF', backgroundColor: '#222', borderRadius: 22, paddingHorizontal: 14 }} />{busy ? <ActivityIndicator color={LIME} /> : <StoryAction Icon={SendHorizontal} label="Send" onPress={send} color={LIME} />}{<StoryAction Icon={X} label="Cancel writing" onPress={() => setMode(null)} />}</View>
    </View> : <View style={{ padding: 10, gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {owner ? <StoryAction Icon={Eye} label="View audience" onPress={audience} /> : user && <Pressable onPress={() => open('reply')} style={{ flex: 1, padding: 12, backgroundColor: '#222', borderRadius: 24 }}><Text style={{ color: '#CCC' }}>Send private reply…</Text></Pressable>}
        {user && <StoryAction Icon={MessageCircleMore} label="Write public comment" onPress={() => open('comment')} />}
        {user && <StoryAction Icon={Flame} label={liked ? 'Unlike story' : 'Like story'} onPress={like} color={liked ? LIME : '#FFF'} />}
        <Text style={{ color: '#AAA' }}>{likes || ''}</Text>
      </View>
      {user && <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Pressable onPress={() => open('comments')}><Text style={{ color: '#AAA', padding: 8 }}>View comments</Text></Pressable><Pressable onPress={() => setShowFloats(v => !v)}><Text style={{ color: '#AAA', padding: 8 }}>{showFloats ? 'Hide' : 'Show'} floating comments</Text></Pressable></View>}
    </View>}
  </KeyboardAvoidingView></SafeAreaView>;
}
