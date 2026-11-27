import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Share as RNShare,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import SocialIcon from '../components/native/SocialIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Image as CachedImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { feedApi, API_URL, usersApi, followsApi, listingsApi, communitiesApi } from '../../src/api/client';
import CommunitiesSheet from '../components/communities/CommunitiesSheet';
import { pickCroppedPhoto, uploadAsset } from '../../src/utils/media';
import { useRouter, useFocusEffect } from 'expo-router';
import { Screen, Button, Copy, Panel, Notice, usePalette } from '../components/native/Kit';
import { useSelector } from 'react-redux';
import { selectIsAuthenticated, selectUser } from '../../src/store/authSlice';
import { useSocialStyles } from '../components/native/socialStyles';
import { money } from '../utils/marketplace';
import StoryBar from '../../src/components/stories/StoryBar';

const { width, height } = Dimensions.get('window');
// Card has marginHorizontal: 14 on each side → content width is width - 28
const CARD_WIDTH = width - 28;
// Keep 4:5 aspect ratio for media (same as feedMediaContainer aspectRatio)
const CARD_MEDIA_HEIGHT = Math.min(CARD_WIDTH, 420);
const LIME = '#CDFF00';
const BG = '#050505';
const shadow = (color, ox = 0, oy = 4, opacity = 0.35, radius = 10, elev = 6) =>
  Platform.select({
    web: { boxShadow: `${ox}px ${oy}px ${radius}px ${color}` },
    default: { shadowColor: color, shadowOffset: { width: ox, height: oy }, shadowOpacity: opacity, shadowRadius: radius, elevation: elev },
  });

// ─── Create Post Modal ────────────────────────────────────────────────────────
const CreatePostModal = ({ visible, onClose, onPostSuccess, initialCommunityId = null }) => {
  const styles = useSocialStyles(baseStyles);
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const [caption, setCaption] = useState('');
  const [mediaItems, setMediaItems] = useState([]); // array of { uri, type, filename, mimeType }
  const [posting, setPosting] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  // Where the post goes: null = the open feed, otherwise a community the author has joined.
  const [communityId, setCommunityId] = useState(initialCommunityId);
  const [myCommunities, setMyCommunities] = useState([]);
  useEffect(() => {
    if (!visible) return;
    setCommunityId(initialCommunityId);
    communitiesApi.mine().then(r => setMyCommunities(Array.isArray(r.data) ? r.data : [])).catch(() => setMyCommunities([]));
  }, [visible, initialCommunityId]);
  const [picking, setPicking] = useState(false);

  const MAX_MEDIA = 6;

  const pickMedia = async (onlyVideo = false) => {
    if (picking || posting) return;
    if (mediaItems.length >= MAX_MEDIA) {
      Alert.alert('Max media reached', `You can attach up to ${MAX_MEDIA} files per post.`);
      return;
    }
    setPicking(true);
    try {
    if (!onlyVideo) {
      const asset = await pickCroppedPhoto();
      if (asset) {
        const file = uploadAsset(asset);
        setMediaItems(prev => [...prev, { uri: file.uri, type: 'image', filename: file.name, mimeType: file.type }].slice(0, MAX_MEDIA));
      }
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted' && status !== 'limited') {
      Alert.alert('Permission needed', 'We need photo library access to attach media.');
      return;
    }
    if (mediaItems.length >= MAX_MEDIA) {
      Alert.alert('Max media reached', `You can attach up to ${MAX_MEDIA} files per post.`);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_MEDIA - mediaItems.length,
      allowsEditing: false,
      quality: 0.85,
    });
    if (!result.canceled && result.assets?.length) {
      const remaining = MAX_MEDIA - mediaItems.length;
      const newItems = result.assets.slice(0, remaining).map(asset => {
        const { name: filename, type: mimeType } = uploadAsset(asset);
        return { uri: asset.uri, type: asset.type, filename, mimeType };
      });
      setMediaItems(prev => [...prev, ...newItems].slice(0, MAX_MEDIA));
    }
    } catch (error) { Alert.alert('Could not add media', error.message); }
    finally { setPicking(false); }
  };

  const removeMedia = (idx) => setMediaItems(prev => prev.filter((_, i) => i !== idx));

  const handlePost = async () => {
    if (posting || picking) return;
    if (!caption.trim() && mediaItems.length === 0) {
      Alert.alert('Nothing to post', 'Add a caption or media before posting.');
      return;
    }
    setPosting(true);
    try {
      const formData = new FormData();
      formData.append('content', caption.trim());
      formData.append('anonymous', String(isAnonymous));
      if (communityId) formData.append('communityId', communityId);
      mediaItems.forEach(m => {
        formData.append('media', { uri: m.uri, name: m.filename, type: m.mimeType });
      });
      await feedApi.createPost(formData);
      setCaption('');
      setMediaItems([]);
      setIsAnonymous(false);
      onPostSuccess();
      onClose();
    } catch (e) {
      const msg = e.response?.data?.error || e.response?.data?.message || e.message || 'Please try again.';
      Alert.alert('Post failed', msg);
    } finally {
      setPosting(false);
    }
  };

  const handleClose = () => {
    if (posting || picking) return;
    setCaption('');
    setMediaItems([]);
    setIsAnonymous(false);
    onClose();
  };

  const me = useSelector(selectUser);
  const [audienceOpen, setAudienceOpen] = useState(false);
  const audience = myCommunities.find(c => c.id === communityId);
  const canPost = !posting && !picking && (caption.trim() || mediaItems.length > 0);
  const tileSize = Math.floor((width - 32 - 16) / 3);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose} statusBarTranslucent>
      {/* Explicit insets: SafeAreaView reports 0 inside an Android modal, which pushed the header under the status bar. */}
      <View style={{ flex: 1, backgroundColor: palette.bg, paddingTop: insets.top }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={[cs.header, { borderBottomColor: palette.line }]}>
            <TouchableOpacity accessibilityRole="button" onPress={handleClose} disabled={posting || picking} hitSlop={10}>
              <Text style={{ color: palette.text, fontSize: 15 }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={{ color: palette.text, fontSize: 16, fontWeight: '800' }}>New post</Text>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Share post" onPress={handlePost} disabled={!canPost}
              style={[cs.postBtn, { backgroundColor: canPost ? palette.accent : palette.soft }]}>
              {posting ? <ActivityIndicator size="small" color="#111" /> : <Text style={{ color: canPost ? (palette.light ? '#FFF' : '#111') : palette.muted, fontWeight: '900', fontSize: 14 }}>Post</Text>}
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 14 }} showsVerticalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              {isAnonymous
                ? <View style={[cs.avatar, { backgroundColor: palette.purpleSoft }]}><SocialIcon name="eye-off" size={20} color={palette.purple} /></View>
                : me?.avatarUrl
                  ? <Image source={{ uri: resolveMediaUrl(me.avatarUrl) }} style={cs.avatar} />
                  : <View style={[cs.avatar, { backgroundColor: palette.purpleSoft }]}><Text style={{ color: palette.purple, fontWeight: '900', fontSize: 18 }}>{(me?.fullName || '?')[0]}</Text></View>}
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ color: palette.text, fontWeight: '800', fontSize: 15 }}>{isAnonymous ? 'Anonymous' : (me?.fullName || 'You')}</Text>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Posting to ${audience?.name || 'Everyone'}. Change`} onPress={() => setAudienceOpen(true)}
                  style={[cs.audience, { borderColor: palette.purple, backgroundColor: palette.purpleSoft }]}>
                  <SocialIcon name={audience ? 'users' : 'globe'} size={13} color={palette.purple} />
                  <Text style={{ color: palette.purple, fontSize: 12, fontWeight: '800' }} numberOfLines={1}>{audience?.name || 'Everyone'}</Text>
                  <SocialIcon name="chevron-down" size={14} color={palette.purple} />
                </TouchableOpacity>
              </View>
            </View>

            <TextInput
              accessibilityLabel="Post text"
              style={{ color: palette.text, fontSize: 18, lineHeight: 26, minHeight: 140, textAlignVertical: 'top', paddingVertical: 4 }}
              placeholder={isAnonymous ? 'Share something anonymously…' : 'What’s happening?'}
              placeholderTextColor={palette.muted}
              multiline
              autoFocus
              maxLength={300}
              value={caption}
              onChangeText={setCaption}
            />

            {mediaItems.length > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {mediaItems.map((m, idx) => (
                  <View key={m.uri + idx} style={{ width: tileSize, height: tileSize, borderRadius: 14, overflow: 'hidden', backgroundColor: palette.soft }}>
                    <Image source={{ uri: m.uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    {m.type === 'video' && <View style={cs.videoBadge}><SocialIcon name="play" size={12} color="#FFF" /></View>}
                    <TouchableOpacity accessibilityLabel={`Remove item ${idx + 1}`} onPress={() => removeMedia(idx)} style={cs.remove}><SocialIcon name="x" size={14} color="#FFF" /></TouchableOpacity>
                  </View>
                ))}
                {mediaItems.length < MAX_MEDIA && (
                  <TouchableOpacity accessibilityLabel="Add another photo" onPress={() => pickMedia(false)} style={{ width: tileSize, height: tileSize, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: palette.purple, alignItems: 'center', justifyContent: 'center' }}>
                    <SocialIcon name="plus" size={24} color={palette.purple} />
                  </TouchableOpacity>
                )}
              </View>
            )}
          </ScrollView>

          {/* Toolbar stays above the keyboard */}
          <View style={[cs.toolbar, { borderTopColor: palette.line, backgroundColor: palette.bg, paddingBottom: Math.max(insets.bottom, 10) }]}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Add photo" onPress={() => pickMedia(false)} disabled={picking || posting} style={[cs.tool, { backgroundColor: palette.card, borderColor: palette.line }]}>
              {picking ? <ActivityIndicator size="small" color={palette.purple} /> : <SocialIcon name="image" size={20} color={palette.purple} />}
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Add video" onPress={() => pickMedia(true)} disabled={picking || posting} style={[cs.tool, { backgroundColor: palette.card, borderColor: palette.line }]}>
              <SocialIcon name="video" size={20} color={palette.purple} />
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="switch" accessibilityLabel="Post anonymously" accessibilityState={{ checked: isAnonymous }} onPress={() => setIsAnonymous(v => !v)} disabled={posting}
              style={[cs.anon, { borderColor: isAnonymous ? palette.purple : palette.line, backgroundColor: isAnonymous ? palette.purpleSoft : palette.card }]}>
              <SocialIcon name={isAnonymous ? 'eye-off' : 'eye'} size={17} color={isAnonymous ? palette.purple : palette.muted} />
              <Text style={{ color: isAnonymous ? palette.purple : palette.text, fontSize: 12, fontWeight: '700' }}>{isAnonymous ? 'Anonymous' : 'Show my name'}</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            <Text style={{ color: caption.length > 270 ? '#F87171' : palette.muted, fontSize: 12, fontWeight: '700' }}>{300 - caption.length}</Text>
            {mediaItems.length > 0 && <Text style={{ color: palette.muted, fontSize: 12 }}>· {mediaItems.length}/{MAX_MEDIA}</Text>}
          </View>
        </KeyboardAvoidingView>

        {/* Audience picker */}
        <Modal visible={audienceOpen} transparent animationType="fade" onRequestClose={() => setAudienceOpen(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => setAudienceOpen(false)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
            <View style={{ backgroundColor: palette.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, paddingBottom: Math.max(insets.bottom, 16), gap: 4 }}>
              <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: palette.line, marginBottom: 10 }} />
              <Text style={{ color: palette.text, fontSize: 17, fontWeight: '800', marginBottom: 6 }}>Who can see this?</Text>
              {[{ id: null, name: 'Everyone', hint: 'Anyone on HustleSpace' }, ...myCommunities.map(c => ({ ...c, hint: 'Members of this community' }))].map(c => {
                const on = (communityId || null) === (c.id || null);
                return (
                  <TouchableOpacity key={c.id || 'feed'} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => { setCommunityId(c.id || null); setAudienceOpen(false); }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 10, borderRadius: 14, backgroundColor: on ? palette.purpleSoft : 'transparent' }}>
                    <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: on ? palette.purple : palette.soft, alignItems: 'center', justifyContent: 'center' }}>
                      <SocialIcon name={c.id ? 'users' : 'globe'} size={17} color={on ? '#FFF' : palette.muted} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: palette.text, fontWeight: '800' }}>{c.name}</Text>
                      <Text style={{ color: palette.muted, fontSize: 12 }}>{c.hint}</Text>
                    </View>
                    {on && <SocialIcon name="check" size={18} color={palette.purple} />}
                  </TouchableOpacity>
                );
              })}
              {!myCommunities.length && <Text style={{ color: palette.muted, fontSize: 12, padding: 10 }}>Join a community from Feed ▾ Communities to post there.</Text>}
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
    </Modal>
  );
};

const cs = StyleSheet.create({
  header: { minHeight: 54, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  postBtn: { minWidth: 72, minHeight: 36, paddingHorizontal: 18, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  audience: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingHorizontal: 10, minHeight: 26, borderRadius: 13, borderWidth: 1, maxWidth: 220 },
  videoBadge: { position: 'absolute', left: 6, bottom: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  remove: { position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center' },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  tool: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  anon: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 42, paddingHorizontal: 12, borderRadius: 21, borderWidth: 1 },
});

// ─── Comments Sheet ───────────────────────────────────────────────────────────
const CommentsSheet = ({ visible, postId, onClose, onCountChange }) => {
  const styles = useSocialStyles(baseStyles);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [replyTo, setReplyTo] = useState(null); // { id, authorName }
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible && postId) {
      loadComments();
    } else {
      setComments([]);
      setCommentText('');
      setReplyTo(null);
    }
  }, [visible, postId]);

  const loadComments = async () => {
    setLoading(true);
    try {
      const res = await feedApi.getComments(postId);
      setComments(res.data || []);
    } catch (e) {
      console.error('Comments fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!commentText.trim()) return;
    setSubmitting(true);
    try {
      await feedApi.addComment(postId, commentText.trim(), replyTo?.id || null);
      setCommentText('');
      setReplyTo(null);
      await loadComments();
      onCountChange && onCountChange(postId);
    } catch (e) {
      Alert.alert('Error', 'Could not post comment.');
    } finally {
      setSubmitting(false);
    }
  };

  // Build flat list: top-level comments followed immediately by their indented replies
  const topLevel = comments.filter((c) => !c.parentId);
  const repliesMap = {};
  comments.forEach((c) => {
    if (c.parentId) {
      if (!repliesMap[c.parentId]) repliesMap[c.parentId] = [];
      repliesMap[c.parentId].push(c);
    }
  });
  const listData = [];
  topLevel.forEach((c) => {
    listData.push({ ...c, _indent: false });
    (repliesMap[c.id] || []).forEach((r) => listData.push({ ...r, _indent: true }));
  });

  const renderComment = ({ item }) => (
    <View style={[styles.commentItem, item._indent && styles.commentIndented]}>
      <View style={styles.commentAvatar}>
        <Text style={styles.commentAvatarText}>{item.authorName?.[0] || '?'}</Text>
      </View>
      <View style={styles.commentBody}>
        <Text style={styles.commentAuthor}>{item.authorName || 'Unknown'}</Text>
        <Text style={styles.commentText}>{item.content}</Text>
        <TouchableOpacity onPress={() => setReplyTo({ id: item.id, authorName: item.authorName })}>
          <Text style={styles.replyBtn}>Reply</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.commentsOverlay}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.commentsSheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>COMMENTS</Text>
            <TouchableOpacity onPress={onClose}>
              <SocialIcon name="x" size={22} color="#FFF" />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.commentsLoader}>
              <ActivityIndicator size="large" color={LIME} />
            </View>
          ) : (
            <FlatList
              data={listData}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderComment}
              contentContainerStyle={styles.commentsList}
              ListEmptyComponent={
                <Text style={styles.noComments}>No comments yet. Be the first!</Text>
              }
            />
          )}

          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            {replyTo && (
              <View style={styles.replyChip}>
                <Text style={styles.replyChipText}>Replying to {replyTo.authorName}</Text>
                <TouchableOpacity onPress={() => setReplyTo(null)}>
                  <SocialIcon name="x" size={14} color={LIME} />
                </TouchableOpacity>
              </View>
            )}
            <View style={styles.commentInputRow}>
              <TextInput
                style={styles.commentInput}
                placeholder="Add a comment..."
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={commentText}
                onChangeText={setCommentText}
                returnKeyType="send"
                onSubmitEditing={handleSubmit}
              />
              <TouchableOpacity
                style={styles.sendButton}
                onPress={handleSubmit}
                disabled={submitting || !commentText.trim()}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={BG} />
                ) : (
                  <SocialIcon name="send" size={18} color={BG} />
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </View>
    </Modal>
  );
};

// Resolve relative media URLs (e.g. /uploads/... → full URL)
const resolveMediaUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http') || url.startsWith('blob:') || url.startsWith('data:')) return url;
  const apiUrl = typeof API_URL !== 'undefined' && API_URL ? API_URL : 'http://localhost:8000/api/v1';
  const base = apiUrl.replace('/api/v1', '');
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
};

// ─── Feed Item ────────────────────────────────────────────────────────────────
const timeAgo = (ts) => {
  if (!ts) return 'Just now';
  const diff = (Date.now() - new Date(ts)) / 1000;
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
};

const FeedVideo = ({ uri, style, shouldPlay, isLooping = true, isMuted = false }) => {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = isLooping;
    instance.muted = isMuted;
    if (shouldPlay) instance.play();
  });

  useEffect(() => {
    player.loop = isLooping;
    player.muted = isMuted;
    if (shouldPlay) player.play();
    else player.pause();
  }, [player, shouldPlay, isLooping, isMuted]);

  return <VideoView player={player} style={style} contentFit="cover" nativeControls={false} />;
};

const FeedItem = ({ item, onCommentPress, isVisible, onListingPress, onAuthorPress }) => {
  const styles = useSocialStyles(baseStyles);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const currentUser = useSelector(selectUser);
  const palette = usePalette();
  const { height: viewportHeight } = useWindowDimensions();
  const [reposted, setReposted] = useState(!!item.repostedByCurrentUser);
  const [repostCount, setRepostCount] = useState(item.repostCount || 0);
  const [repostBusy, setRepostBusy] = useState(false);
  const repostLock = useRef(false);
  const toggleRepost = async () => {
    if (!isAuthenticated) { Alert.alert('Sign in required', 'Log in to repost.'); return; }
    if (repostLock.current) return;
    repostLock.current = true; setRepostBusy(true);
    try {
      if (reposted) await feedApi.undoRepost(item.id);
      else await feedApi.repost(item.id);
      setReposted(!reposted); setRepostCount(n => Math.max(0, n + (reposted ? -1 : 1)));
    } catch (e) { Alert.alert('Could not repost', e.response?.data?.error || 'Please try again.'); }
    finally { repostLock.current = false; setRepostBusy(false); }
  };
  const isPost = item.type === 'POST' || !item.type;
  const isListing = item.type === 'LISTING';
  const [isLiked, setIsLiked] = useState(item.likedByCurrentUser);
  const [likesCount, setLikesCount] = useState(item.likesCount || 0);
  const [commentsCount, setCommentsCount] = useState(item.commentsCount || 0);
  const [saved, setSaved] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [activeMediaIdx, setActiveMediaIdx] = useState(0);
  const [avatarError, setAvatarError] = useState(false);

  // Build media list — check length since [] is truthy
  const allMedia = isPost
    ? (item.media?.length > 0 ? item.media : (item.imageUrl ? [{ url: item.imageUrl, type: 'IMAGE' }] : []))
    : (item.mediaUrls || []).map(u => ({ url: u, type: 'IMAGE' }));

  const hasMultiMedia = allMedia.length > 1;
  const [mediaRatios, setMediaRatios] = useState({});
  const ratioFor = media => mediaRatios[media?.url] || 1;
  const activeMedia = allMedia[Math.min(activeMediaIdx, Math.max(0, allMedia.length - 1))];
  const mediaHeight = Math.min(CARD_WIDTH / ratioFor(activeMedia), Math.min(viewportHeight * 0.78, 640));
  const recordMediaSize = (media, event) => {
    const source = event?.nativeEvent?.source || event?.nativeEvent || event?.source;
    const imageWidth = Number(source?.width);
    const imageHeight = Number(source?.height);
    if (imageWidth > 0 && imageHeight > 0) {
      const ratio = imageWidth / imageHeight;
      setMediaRatios(current => current[media.url] === ratio ? current : { ...current, [media.url]: ratio });
    }
  };
  const firstMedia = allMedia[0];
  const rawMediaUrl = firstMedia ? resolveMediaUrl(firstMedia.url) : null;
  const isVideo = isPost && firstMedia?.type === 'VIDEO';

  // Auto-play only when scrolled into view
  useEffect(() => {
    setVideoPlaying(!!isVisible);
  }, [isVisible]);

  const isAnon = !isListing && item.anonymous;
  const authorName = isListing ? item.sellerName : (isAnon ? 'Anonymous' : item.authorName);
  const authorRole = isListing ? 'SELLER' : (item.authorRole || null);
  const authorVerified = isListing ? item.sellerVerified : (isAnon ? false : item.authorVerified);
  const authorId = isListing ? item.sellerId : (isAnon ? null : item.authorId);
  const authorAvatarUrl = isListing ? item.sellerAvatarUrl : (isAnon ? null : item.authorAvatarUrl);
  const initial = (authorName || '?')[0].toUpperCase();

  const handleLike = async () => {
    if (!isAuthenticated) {
      Alert.alert('Sign in required', 'Log in to like posts.');
      return;
    }
    const wasLiked = isLiked;
    const prevCount = likesCount;
    setIsLiked(!wasLiked);
    setLikesCount(wasLiked ? prevCount - 1 : prevCount + 1);
    try {
      if (wasLiked) {
        await feedApi.unlikePost(item.id);
      } else {
        await feedApi.likePost(item.id);
      }
    } catch (e) {
      setIsLiked(wasLiked);
      setLikesCount(prevCount);
      if (e.response?.status === 401 || e.response?.status === 403) {
        Alert.alert('Session expired', 'Please log in again.');
      }
    }
  };

  const [showShareModal, setShowShareModal] = useState(false);

  const handleShare = () => {
    setShowShareModal(true);
  };

  const handleCommentCountBump = useCallback(() => {
    setCommentsCount((c) => c + 1);
  }, []);

  return (
    <View style={styles.feedCard}>
      {/* ── Card Header ─────────────────────────────────── */}
      <View style={styles.feedCardHeader}>
        <TouchableOpacity
          onPress={() => !isAnon && onAuthorPress?.(authorId, item.type, item.sellerId)}
          activeOpacity={isAnon ? 1 : 0.75}
          style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}
        >
          <View style={[styles.feedAvatar, isAnon && styles.feedAvatarAnon]}>
            {isAnon ? (
              <SocialIcon name="user-x" size={18} color="rgba(255,255,255,0.35)" />
            ) : authorAvatarUrl && !avatarError ? (
              <Image
                source={{ uri: resolveMediaUrl(authorAvatarUrl) }}
                style={styles.feedAvatarImage}
                onError={() => setAvatarError(true)}
              />
            ) : (
              <Text style={styles.feedAvatarText}>{initial}</Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
              <Text style={[styles.feedAuthorName, isAnon && styles.feedAuthorNameAnon]}>{authorName || 'Unknown'}</Text>
              {isAnon && (
                <View style={styles.anonBadge}>
                  <Text style={styles.anonBadgeText}>ANON</Text>
                </View>
              )}
              {authorVerified && (
                <SocialIcon name="check-decagram" size={14} color={LIME} />
              )}
              {isListing && (
                <View style={styles.feedListingBadge}>
                  <Text style={styles.feedListingBadgeText}>LISTING</Text>
                </View>
              )}
              {authorRole && authorRole !== 'SELLER' && (
                <View style={[styles.feedListingBadge, { backgroundColor: 'rgba(205,255,0,0.1)', borderColor: 'rgba(205,255,0,0.2)' }]}>
                  <Text style={[styles.feedListingBadgeText, { color: LIME }]}>{authorRole}</Text>
                </View>
              )}
            </View>
            <Text style={styles.feedTimestamp}>{timeAgo(item.createdAt)}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setSaved(!saved)} style={{ padding: 6 }}>
          <SocialIcon name="bookmark" size={18} color={saved ? LIME : 'rgba(255,255,255,0.25)'} />
        </TouchableOpacity>
      </View>

      {!!item.repostOf && <View style={{ margin: 14, padding: 12, borderWidth: 1, borderColor: palette.line, borderRadius: 16, gap: 10 }}>
        <Copy muted>Reposted</Copy>
        <TouchableOpacity accessibilityRole="button" onPress={() => onAuthorPress?.(item.repostOf.authorId)}><Copy heading>{item.repostOf.authorName || 'User'}</Copy></TouchableOpacity>
        {!!item.repostOf.content && <Copy>{item.repostOf.content}</Copy>}
        {item.repostOf.media?.[0]?.type === 'IMAGE' && <CachedImage source={{ uri: resolveMediaUrl(item.repostOf.media[0].url) }} onLoad={event => recordMediaSize(item.repostOf.media[0], event)} contentFit="cover" cachePolicy="memory-disk" transition={150} style={{ width: '100%', aspectRatio: ratioFor(item.repostOf.media[0]) }} />}
        {item.repostOf.media?.[0]?.type === 'VIDEO' && <FeedVideo uri={resolveMediaUrl(item.repostOf.media[0].url)} style={{ width: '100%', height: CARD_MEDIA_HEIGHT }} shouldPlay={!!isVisible} isMuted />}
      </View>}
      {/* ── Text-only post ───────────────────────────────── */}
      {!rawMediaUrl && (isListing ? item.title : item.content) && (
        <View style={styles.feedTextOnly}>
          <Text style={styles.feedTextOnlyContent}>
            {isListing ? item.title : item.content}
          </Text>
          {isListing && item.price != null && (
            <Text style={styles.feedPrice}>{money(item.price, item.currency || 'PLN')}{item.negotiable ? ' · negotiable' : ''}</Text>
          )}
        </View>
      )}

      {/* ── Media ────────────────────────────────────────── */}
      {allMedia.length > 0 && (
        <View style={[styles.feedMediaContainer, { height: mediaHeight }]}>
          {hasMultiMedia ? (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                snapToInterval={CARD_WIDTH}
                snapToAlignment="start"
                decelerationRate="fast"
                disableIntervalMomentum
                onMomentumScrollEnd={(e) => {
                  const idx = Math.round(e.nativeEvent.contentOffset.x / CARD_WIDTH);
                  setActiveMediaIdx(idx);
                }}
              >
                {allMedia.map((m, idx) => {
                  const mUrl = resolveMediaUrl(m.url);
                  const mIsVideo = m.type === 'VIDEO';
                  return mIsVideo && Platform.OS !== 'web' ? (
                    <TouchableOpacity key={idx} style={{ width: CARD_WIDTH, height: mediaHeight }} onPress={() => setVideoPlaying(p => !p)} activeOpacity={1}>
                      <FeedVideo uri={mUrl} style={{ width: CARD_WIDTH, height: mediaHeight }} shouldPlay={videoPlaying && activeMediaIdx === idx} isLooping isMuted={isMuted} />
                      {!videoPlaying && (
                        <View style={[StyleSheet.absoluteFillObject, styles.videoPlayOverlay, { pointerEvents: 'none' }]}>
                          <View style={styles.videoPlayCircle}><SocialIcon name="play" size={28} color="#FFF" /></View>
                        </View>
                      )}
                    </TouchableOpacity>
                  ) : (
                    <CachedImage key={idx} source={{ uri: mUrl }} onLoad={event => recordMediaSize(m, event)} style={{ width: CARD_WIDTH, height: mediaHeight }} contentFit="cover" cachePolicy="memory-disk" transition={150} recyclingKey={mUrl} />
                  );
                })}
              </ScrollView>
              <View style={styles.carouselDots}>
                {allMedia.map((_, i) => (
                  <View key={i} style={[styles.carouselDot, i === activeMediaIdx && styles.carouselDotActive]} />
                ))}
              </View>
              <View style={styles.feedMultiMediaBadge}>
                <SocialIcon name="layers-outline" size={13} color="#FFF" />
                <Text style={styles.feedMultiMediaText}>{activeMediaIdx + 1}/{allMedia.length}</Text>
              </View>
            </>
          ) : isVideo && Platform.OS !== 'web' ? (
            <TouchableOpacity style={{ flex: 1 }} onPress={() => setVideoPlaying(p => !p)} activeOpacity={1}>
              <FeedVideo uri={rawMediaUrl} style={[styles.feedMedia, { height: mediaHeight }]} shouldPlay={videoPlaying} isLooping isMuted={isMuted} />
              {!videoPlaying && (
                <View style={[StyleSheet.absoluteFillObject, styles.videoPlayOverlay, { pointerEvents: 'none' }]}>
                  <View style={styles.videoPlayCircle}><SocialIcon name="play" size={28} color="#FFF" /></View>
                </View>
              )}
            </TouchableOpacity>
          ) : (
            <CachedImage source={{ uri: rawMediaUrl }} onLoad={event => recordMediaSize(firstMedia, event)} style={[styles.feedMedia, { height: mediaHeight }]} contentFit="cover" cachePolicy="memory-disk" transition={150} recyclingKey={rawMediaUrl} />
          )}
          {isVideo && (
            <TouchableOpacity style={styles.feedMuteBtn} onPress={() => setIsMuted(p => !p)} activeOpacity={0.8}>
              <SocialIcon name={isMuted ? 'volume-off' : 'volume-high'} size={18} color="#FFF" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── Footer ───────────────────────────────────────── */}
      <View style={styles.feedCardFooter}>
        <View style={styles.feedActionsRow}>
          <TouchableOpacity style={styles.feedActionBtn} onPress={handleLike} activeOpacity={0.7}>
            <SocialIcon
              name={isLiked ? 'heart' : 'heart-outline'}
              size={26}
              color={isLiked ? '#FF4D6D' : 'rgba(255,255,255,0.55)'}
            />
            {likesCount > 0 && (
              <Text style={[styles.feedActionCount, isLiked && { color: '#FF4D6D' }]}>{likesCount}</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.feedActionBtn}
            onPress={() => onCommentPress?.(item.id, handleCommentCountBump)}
          >
            <SocialIcon name="comment-outline" size={26} color="rgba(255,255,255,0.55)" />
            {commentsCount > 0 && <Text style={styles.feedActionCount}>{commentsCount}</Text>}
          </TouchableOpacity>
          {isPost && !isAnon && item.authorId !== currentUser?.id && <TouchableOpacity accessibilityRole="button" accessibilityLabel={reposted ? 'Undo repost' : 'Repost'} accessibilityState={{ selected: reposted, disabled: repostBusy }} disabled={repostBusy} style={styles.feedActionBtn} onPress={toggleRepost}>
            <SocialIcon name="repeat" size={24} color={reposted ? palette.accent : palette.muted} />
            {repostCount > 0 && <Text style={[styles.feedActionCount, { color: palette.muted }]}>{repostCount}</Text>}
          </TouchableOpacity>}
          <TouchableOpacity style={styles.feedActionBtn} onPress={handleShare}>
            <SocialIcon name="send" size={22} color="rgba(255,255,255,0.55)" />
          </TouchableOpacity>
          {isListing && item.price != null && (
            <TouchableOpacity style={styles.feedBuyBtn} onPress={() => onListingPress?.(item)}>
              <Text style={styles.feedBuyBtnText}>
                {money(item.price, item.currency || 'PLN')} · VIEW
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {rawMediaUrl && (
          <Text style={styles.feedCaption} numberOfLines={3}>
            <Text style={styles.feedCaptionAuthor}>{authorName} </Text>
            {isListing ? item.title : item.content}
          </Text>
        )}

        <TouchableOpacity
          style={styles.feedCommentsLink}
          onPress={() => onCommentPress?.(item.id, handleCommentCountBump)}
        >
          <Text style={styles.feedCommentsLinkText}>
            {commentsCount > 0 ? `View all ${commentsCount} comments` : 'Be the first to comment'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Share to User Modal */}
      <ShareToUserModal
        visible={showShareModal}
        onClose={() => setShowShareModal(false)}
        postContent={isListing ? item.title : item.content}
        postId={item.id}
      />
    </View>
  );
};

// ─── My Hustle Tab ────────────────────────────────────────────────────────────
const MOCK_SHARE_USERS = [
  { id: 's1', name: 'Maya J.', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face' },
  { id: 's2', name: 'Jamal C.', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face' },
  { id: 's3', name: 'Sofia M.', avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=100&h=100&fit=crop&crop=face' },
  { id: 's4', name: 'Andre W.', avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&h=100&fit=crop&crop=face' },
  { id: 's5', name: 'Aisha P.', avatar: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=100&h=100&fit=crop&crop=face' },
  { id: 's6', name: 'Marcus C.', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face' },
];

const ShareToUserModal = ({ visible, onClose, postContent, postId }) => {
  const [search, setSearch] = useState('');
  const [sent, setSent] = useState({});
  const filtered = MOCK_SHARE_USERS.filter(u => u.name.toLowerCase().includes(search.toLowerCase()));

  const handleSend = (user) => {
    setSent(prev => ({ ...prev, [user.id]: true }));
    // In production: directMessagesApi.send(user.id, { type: 'shared_post', postId, message: postContent })
  };

  const handleClose = () => { setSent({}); setSearch(''); onClose(); };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={shareStyles.overlay}>
        <TouchableOpacity style={shareStyles.backdrop} activeOpacity={1} onPress={handleClose} />
        <View style={shareStyles.sheet}>
          <View style={shareStyles.handle} />
          <Text style={shareStyles.title}>Share to</Text>

          <View style={shareStyles.searchWrap}>
            <SocialIcon name="search" size={16} color="rgba(255,255,255,0.3)" />
            <TextInput
              style={shareStyles.searchInput}
              placeholder="Search users..."
              placeholderTextColor="rgba(255,255,255,0.25)"
              value={search}
              onChangeText={setSearch}
            />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={shareStyles.userRow}>
            {filtered.map(user => (
              <TouchableOpacity key={user.id} style={shareStyles.userItem} onPress={() => handleSend(user)} activeOpacity={0.75}>
                <Image source={{ uri: user.avatar }} style={shareStyles.userAvatar} />
                {sent[user.id] && (
                  <View style={shareStyles.sentBadge}>
                    <SocialIcon name="check" size={10} color="#FFF" />
                  </View>
                )}
                <Text style={shareStyles.userName} numberOfLines={1}>{user.name}</Text>
                <View style={[shareStyles.sendBtn, sent[user.id] && shareStyles.sentBtn]}>
                  <Text style={[shareStyles.sendBtnText, sent[user.id] && { color: 'rgba(255,255,255,0.5)' }]}>
                    {sent[user.id] ? 'Sent' : 'Send'}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={shareStyles.divider} />
          <Text style={shareStyles.sectionLabel}>MORE OPTIONS</Text>
          <View style={shareStyles.optionsRow}>
            <TouchableOpacity style={shareStyles.optionItem} onPress={() => { handleClose(); Alert.alert('Copied!', 'Link copied to clipboard'); }}>
              <View style={[shareStyles.optionIcon, { backgroundColor: 'rgba(96,165,250,0.12)' }]}>
                <SocialIcon name="link" size={18} color="#60A5FA" />
              </View>
              <Text style={shareStyles.optionText}>Copy Link</Text>
            </TouchableOpacity>
            <TouchableOpacity style={shareStyles.optionItem} onPress={() => { handleClose(); Alert.alert('Reposted!', 'Post shared to your timeline'); }}>
              <View style={[shareStyles.optionIcon, { backgroundColor: 'rgba(52,199,89,0.12)' }]}>
                <SocialIcon name="repeat" size={18} color="#34C759" />
              </View>
              <Text style={shareStyles.optionText}>Repost</Text>
            </TouchableOpacity>
            <TouchableOpacity style={shareStyles.optionItem} onPress={async () => { handleClose(); try { await RNShare.share({ message: `Check this out on HustleUp: ${postContent}` }); } catch {} }}>
              <View style={[shareStyles.optionIcon, { backgroundColor: 'rgba(167,139,250,0.12)' }]}>
                <SocialIcon name="share" size={18} color="#A78BFA" />
              </View>
              <Text style={shareStyles.optionText}>External</Text>
            </TouchableOpacity>
            <TouchableOpacity style={shareStyles.optionItem} onPress={() => { handleClose(); Alert.alert('Saved!', 'Post saved to your bookmarks'); }}>
              <View style={[shareStyles.optionIcon, { backgroundColor: 'rgba(244,114,182,0.12)' }]}>
                <SocialIcon name="bookmark" size={18} color="#F472B6" />
              </View>
              <Text style={shareStyles.optionText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const shareStyles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { backgroundColor: '#111', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingBottom: 40, paddingTop: 12, maxHeight: '60%' },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.12)', alignSelf: 'center', marginBottom: 16 },
  title: { color: '#FFF', fontSize: 18, fontWeight: '900', marginBottom: 16 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  searchInput: { flex: 1, color: '#FFF', fontSize: 14 },
  userRow: { gap: 16, paddingBottom: 6 },
  userItem: { alignItems: 'center', width: 72 },
  userAvatar: { width: 56, height: 56, borderRadius: 20, backgroundColor: '#222' },
  sentBadge: { position: 'absolute', top: 0, right: 6, width: 18, height: 18, borderRadius: 9, backgroundColor: '#34C759', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#111' },
  userName: { color: '#FFF', fontSize: 10, fontWeight: '700', marginTop: 6 },
  sendBtn: { marginTop: 6, backgroundColor: LIME, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4 },
  sentBtn: { backgroundColor: 'rgba(255,255,255,0.08)' },
  sendBtnText: { color: BG, fontSize: 10, fontWeight: '900' },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 20 },
  sectionLabel: { color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 14 },
  optionsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  optionItem: { alignItems: 'center', gap: 8 },
  optionIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  optionText: { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '700' },
});

// ─── Live Stream Section ──────────────────────────────────────────────────────
// ─── Category Filter ──────────────────────────────────────────────────────────
// Memoised so a scroll (which changes which post is "visible" and autoplays) re-renders only
// the two posts whose visibility flipped, not every post in the feed.
const MemoFeedItem = React.memo(FeedItem);
const PAGE_SIZE = 8;
const FEED_VIEWS = [
  ['fyp', 'For you', 'Popular posts across HustleSpace'],
  ['following', 'Following', 'People you follow'],
  ['communities', 'Communities', 'Groups you’ve joined'],
  ['saved', 'Saved', 'Posts you bookmarked'],
];

export default function CommunityFeed() {
  const router = useRouter();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const colors = usePalette();
  const [feedError, setFeedError] = useState('');
  const feedRequest = useRef(0);
  const [mainTab, setMainTab] = useState('fyp'); // 'fyp' | 'hustle'
  const [data, setData] = useState([]);
  const sort = 'latest';
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [communitiesOpen, setCommunitiesOpen] = useState(false);
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [storyTrigger, setStoryTrigger] = useState(false);
  const [commentsPostId, setCommentsPostId] = useState(null);
  const [commentsCountBump, setCommentsCountBump] = useState(null);
  const [commentsVisible, setCommentsVisible] = useState(false);
  const [visibleItemId, setVisibleItemId] = useState(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const [viewabilityConfig] = useState(() => ({ itemVisiblePercentThreshold: 60 }));
  // FlatList forbids changing this callback after mount (it throws on Fast Refresh too), so
  // hold one function for the component's lifetime.
  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setVisibleItemId(viewableItems[0].item.id);
    }
  }).current;

  const fetchFeed = useCallback(async () => {
    const request = ++feedRequest.current;
    setLoading(true); setFeedError('');
    try {
      const apiCall = mainTab === 'following' ? feedApi.following : mainTab === 'saved' ? feedApi.mySaved : mainTab === 'communities' ? feedApi.communities : () => feedApi.getPosts(sort);
      const response = await apiCall();
      if (request !== feedRequest.current) return;
      if (!Array.isArray(response.data)) throw new Error('Invalid feed response');
      setData(response.data.map(post => ({ ...post, type: 'POST' })));
      setVisibleCount(PAGE_SIZE);
    } catch (error) {
      if (request === feedRequest.current) { setData([]); setFeedError(error.response?.data?.error || 'Could not load this feed. Please try again.'); }
    } finally { if (request === feedRequest.current) { setLoading(false); setRefreshing(false); } }
  }, [mainTab, sort]);
  useFocusEffect(useCallback(() => { fetchFeed(); return () => { feedRequest.current++; }; }, [fetchFeed]));
  const onRefresh = () => { setRefreshing(true); fetchFeed(); };

  const handleCommentPress = useCallback((postId, countBumpFn) => {
    setCommentsPostId(postId);
    setCommentsCountBump(() => countBumpFn);
    setCommentsVisible(true);
  }, []);

  const handleCommentCountChange = useCallback(() => {
    commentsCountBump && commentsCountBump();
  }, [commentsCountBump]);

  const openListing = useCallback(item => router.push({ pathname: '/listing/[id]', params: { id: item.id } }), [router]);
  const openAuthor = useCallback(authorId => { if (authorId) router.push('/profile/' + authorId); }, [router]);
  const renderItem = useCallback(({ item }) => (
    <MemoFeedItem item={item} onCommentPress={handleCommentPress} isVisible={item.id === visibleItemId}
      onListingPress={openListing} onAuthorPress={openAuthor} />
  ), [handleCommentPress, visibleItemId, openListing, openAuthor]);
  // The API returns the whole feed; render it a page at a time so the first paint is fast.
  const pagedData = useMemo(() => data.slice(0, visibleCount), [data, visibleCount]);
  const loadMore = useCallback(() => setVisibleCount(n => (n < data.length ? n + PAGE_SIZE : n)), [data.length]);

  const renderHeader = () => (
    <View style={{ gap: 16, paddingHorizontal: 16, paddingBottom: 20 }}>
      {/* "Feed ▾" — one title that switches between views, instead of a row of big buttons */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Feed: ${FEED_VIEWS.find(v => v[0] === mainTab)?.[1]}. Change view`} accessibilityState={{ expanded: viewMenuOpen }}
          onPress={() => setViewMenuOpen(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 }}>
          <Copy heading style={{ fontSize: 26, lineHeight: 32 }}>Feed</Copy>
          <SocialIcon name="chevron-down" size={22} color={colors.purple} />
        </TouchableOpacity>
        <Text style={{ marginLeft: 10, color: colors.purple, fontSize: 13, fontWeight: '700' }}>{FEED_VIEWS.find(v => v[0] === mainTab)?.[1]}</Text>
      </View>
      <StoryBar triggerCreate={storyTrigger} onTriggerHandled={() => setStoryTrigger(false)} />
      {mainTab === 'communities' && <Panel style={{ gap: 10, borderRadius: 20 }}>
        <Copy heading style={{ fontSize: 17 }}>Your communities</Copy>
        <Copy muted>Join groups around what you do, then post to them directly.</Copy>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button secondary icon={<SocialIcon name="search" size={16} color={colors.text} />} style={{ flex: 1 }} onPress={() => isAuthenticated ? setCommunitiesOpen(true) : router.push('/login')}>Discover</Button>
          <Button icon={<SocialIcon name="plus" size={16} color="#050505" />} style={{ flex: 1 }} onPress={() => isAuthenticated ? setCommunitiesOpen(true) : router.push('/login')}>Create</Button>
        </View>
      </Panel>}
      {mainTab !== 'saved' && <Panel style={{ gap: 14, borderRadius: 20 }}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Write a post" onPress={() => isAuthenticated ? setCreateModalVisible(true) : router.push('/login')} style={{ minHeight: 52, justifyContent: 'center' }}><Copy muted>{mainTab === 'communities' ? 'Post to one of your communities…' : 'What’s on your mind?'}</Copy></TouchableOpacity>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button secondary icon={<SocialIcon name="image" size={18} color={colors.text} />} onPress={() => isAuthenticated ? setCreateModalVisible(true) : router.push('/login')}>Photo / video</Button>
          <Button icon={<SocialIcon name="edit-3" size={18} color="#050505" />} style={{ flex: 1 }} onPress={() => isAuthenticated ? setCreateModalVisible(true) : router.push('/login')}>Post</Button>
        </View>
      </Panel>}
      {mainTab === 'communities' && <Copy muted>Posts from the communities you’ve joined.</Copy>}
      {!!feedError && <Notice message={feedError} onRetry={fetchFeed} />}
    </View>
  );

  return (
    <Screen scroll={false}>
      <FlatList
        data={pagedData}
        renderItem={renderItem}
        keyExtractor={item => String(item.id)}
        initialNumToRender={3}
        maxToRenderPerBatch={4}
        updateCellsBatchingPeriod={60}
        windowSize={7}
        removeClippedSubviews={Platform.OS === 'android'}
        onEndReached={loadMore}
        onEndReachedThreshold={0.6}
        ListFooterComponent={visibleCount < data.length ? <ActivityIndicator color={colors.accent} style={{ marginVertical: 20 }} /> : null}
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={<View style={{ padding: 16 }}>{loading ? <ActivityIndicator color={colors.accent} /> : !feedError && <Notice message={mainTab === 'saved' ? 'Posts you save on HustleSpace appear here.' : mainTab === 'following' ? 'Posts from people you follow will appear here.' : mainTab === 'communities' ? 'No community posts yet.' : 'No posts yet. Start a conversation.'} />}</View>}
        contentContainerStyle={{ paddingBottom: 110 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      />

      <CreatePostModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onPostSuccess={fetchFeed}
      />
      <Modal visible={viewMenuOpen} transparent animationType="fade" onRequestClose={() => setViewMenuOpen(false)}>
        <TouchableOpacity activeOpacity={1} onPress={() => setViewMenuOpen(false)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }}>
          <View style={{ position: 'absolute', top: 110, left: 16, width: 230, borderRadius: 18, padding: 6, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 18, elevation: 12 }}>
            {FEED_VIEWS.map(([value, label, hint]) => {
              const on = mainTab === value;
              return (
                <TouchableOpacity key={value} accessibilityRole="menuitem" accessibilityState={{ selected: on }} onPress={() => {
                  setViewMenuOpen(false);
                  if (!isAuthenticated && value !== 'fyp') { router.push('/login'); return; }
                  if (value !== mainTab) { setData([]); setMainTab(value); }
                }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 50, paddingHorizontal: 12, borderRadius: 12, backgroundColor: on ? colors.purpleSoft : 'transparent' }}>
                  <SocialIcon name={value} size={18} color={on ? colors.purple : colors.muted} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: on ? colors.purple : colors.text, fontWeight: '800', fontSize: 14 }}>{label}</Text>
                    <Text style={{ color: colors.muted, fontSize: 11 }}>{hint}</Text>
                  </View>
                  {on && <SocialIcon name="check" size={16} color={colors.purple} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>
      <CommunitiesSheet
        visible={communitiesOpen}
        onClose={() => setCommunitiesOpen(false)}
        onChanged={() => { if (mainTab === 'communities') fetchFeed(); }}
      />

      <CommentsSheet
        visible={commentsVisible}
        postId={commentsPostId}
        onClose={() => { setCommentsVisible(false); setCommentsPostId(null); }}
        onCountChange={handleCommentCountChange}
      />

      {/* ══ Listing Detail Sheet ══════════════════════════════════════════ */}

    </Screen>
  );
}

const baseStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  loadingContainer: { flex: 1, backgroundColor: BG, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: '600' },

  // Fixed top bar — absolute overlay so scroll content flows underneath it
  fixedTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: BG,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  topBarRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12,
  },
  topBarLogo: { color: '#FFF', fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },
  tabToggles: { flexDirection: 'row', gap: 4, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 20, padding: 3 },
  activeTabText: { color: BG, fontSize: 12, fontWeight: '900', letterSpacing: 0.8, paddingHorizontal: 14, paddingVertical: 6, backgroundColor: LIME, borderRadius: 18 },
  inactiveTabText: { color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: '700', letterSpacing: 0.8, paddingHorizontal: 14, paddingVertical: 6 },
  topBarPlusBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: LIME,
    justifyContent: 'center', alignItems: 'center',
    ...shadow(LIME, 0, 2, 0.3, 6, 4),
  },
  heroIconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center', alignItems: 'center',
  },
  notifDot: {
    position: 'absolute', top: 7, right: 7,
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: LIME, borderWidth: 1.5, borderColor: BG,
  },

  // MY HUSTLE tab wrapper (accounts for the fixed top bar)
  tabContent: { flex: 1, backgroundColor: BG },

  // MY HUSTLE header
  hustleTabHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 22, paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  hustleTabTitle: { color: '#FFF', fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },

  // Header Section
  headerSection: {
    width,
    backgroundColor: BG,
    paddingBottom: 4,
  },

  // Greeting Banner (replaces heroTop + ad banner)
  greetBanner: {
    paddingHorizontal: 22, paddingTop: 20, paddingBottom: 28,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    position: 'relative', overflow: 'hidden',
  },
  greetGlow: { position: 'absolute', top: -60, left: -40, right: -40, height: 200 },
  greetBannerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  greetBannerSub: { color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: '600', marginBottom: 5, letterSpacing: 0.2 },
  greetBannerName: { color: '#FFF', fontSize: 30, fontWeight: '900', letterSpacing: -1 },
  greetPostBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: LIME, paddingHorizontal: 16, paddingVertical: 11,
    borderRadius: 22,
    ...shadow(LIME, 0, 3, 0.3, 10, 6),
  },
  greetPostBtnText: { color: BG, fontWeight: '900', fontSize: 12, letterSpacing: 0.8 },
  sortBar: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  sortChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  sortChipActive: { backgroundColor: LIME, borderColor: LIME },
  sortChipText: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '700' },
  sortChipTextActive: { color: BG, fontWeight: '900' },
  greetAvatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(205,255,0,0.1)',
    borderWidth: 1.5, borderColor: 'rgba(205,255,0,0.25)',
    justifyContent: 'center', alignItems: 'center',
    overflow: 'hidden',
  },
  greetAvatarText: { color: LIME, fontSize: 18, fontWeight: '900' },
  greetAvatarImg: { width: '100%', height: '100%', borderRadius: 24 },

  // Stories block
  storiesBlock: { marginTop: 16, marginBottom: 4 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 22, marginBottom: 12,
  },
  sectionTitle: { color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '900', letterSpacing: 2.5 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,50,50,0.12)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,50,50,0.2)' },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#FF4444' },
  liveText: { color: '#FF4444', fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },

  // Quick Actions
  quickActionsBlock: { paddingHorizontal: 22, marginTop: 28, marginBottom: 4 },
  quickActionsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, gap: 10 },
  quickAction: {
    alignItems: 'center', gap: 8, flex: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 20, paddingVertical: 16,
    borderWidth: 1,
  },
  quickActionIcon: {
    width: 50, height: 50, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
  },
  quickActionLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, textAlign: 'center' },

  // Feed header
  feedHeader: {
    paddingHorizontal: 22,
    marginTop: 24,
    marginBottom: 8,
    gap: 12,
  },

  // Category filter
  categoryRow: { paddingRight: 22, gap: 8 },
  categoryChip: {
    paddingHorizontal: 16, paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  categoryChipActive: { backgroundColor: LIME, borderColor: LIME },
  categoryChipText: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '700' },
  categoryChipTextActive: { color: BG },

  // Divider
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginHorizontal: 22,
    marginBottom: 4,
  },

  // Empty Feed
  emptyFeed: {
    minHeight: height * 0.55,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
    paddingVertical: 40,
  },
  emptyGlow: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 200,
    borderRadius: 100,
  },
  emptyIcon: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: 'rgba(205,255,0,0.08)',
    borderWidth: 1, borderColor: 'rgba(205,255,0,0.15)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: { color: '#FFF', fontSize: 22, fontWeight: '900', letterSpacing: -0.5, marginBottom: 12, textAlign: 'center' },
  emptySubtitle: { color: 'rgba(255,255,255,0.4)', fontSize: 14, lineHeight: 22, textAlign: 'center', marginBottom: 32 },
  emptyCtaPrimary: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: LIME,
    paddingHorizontal: 30, paddingVertical: 15,
    borderRadius: 30, marginBottom: 16,
    ...shadow(LIME, 0, 4, 0.35, 16, 10),
  },
  emptyCtaPrimaryText: { color: BG, fontWeight: '900', fontSize: 13, letterSpacing: 1 },
  emptyCtaSecondary: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  emptyCtaSecondaryText: { color: LIME, fontSize: 13, fontWeight: '700' },

  // Feed cards
  feedCard: {
    marginHorizontal: 14, marginBottom: 16,
    borderRadius: 24,
    backgroundColor: '#0d0d0d',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
    ...shadow('#000', 0, 6, 0.25, 16, 5),
  },
  feedCardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  feedAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(205,255,0,0.1)',
    borderWidth: 1.5, borderColor: 'rgba(205,255,0,0.25)',
    justifyContent: 'center', alignItems: 'center',
    overflow: 'hidden',
  },
  feedAvatarImage: { width: '100%', height: '100%', borderRadius: 22 },
  feedAvatarText: { color: LIME, fontSize: 17, fontWeight: '900' },
  feedAvatarAnon: { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' },
  feedAuthorName: { color: '#FFF', fontSize: 14, fontWeight: '900', letterSpacing: 0.1 },
  feedAuthorNameAnon: { color: 'rgba(255,255,255,0.45)', fontStyle: 'italic' },
  anonBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  anonBadgeText: { color: 'rgba(255,255,255,0.35)', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  feedTimestamp: { color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: '700', marginTop: 2, letterSpacing: 0.5 },
  feedListingBadge: {
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8,
    backgroundColor: 'rgba(205,255,0,0.1)', borderWidth: 1, borderColor: 'rgba(205,255,0,0.18)',
  },
  feedListingBadgeText: { color: LIME, fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  feedTextOnly: { paddingHorizontal: 16, paddingBottom: 16 },
  feedTextOnlyContent: { color: 'rgba(255,255,255,0.85)', fontSize: 15, lineHeight: 23, fontWeight: '500' },
  feedMediaContainer: { width: '100%', height: CARD_MEDIA_HEIGHT, backgroundColor: '#0a0a0a', overflow: 'hidden' },
  feedMedia: { width: '100%', height: '100%' },
  feedCardFooter: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14 },
  feedActionsRow: { flexDirection: 'row', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 12 },
  feedActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  feedActionCount: { color: 'rgba(255,255,255,0.65)', fontSize: 13, fontWeight: '800' },
  feedBuyBtn: {
    marginLeft: 'auto', backgroundColor: LIME,
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 14,
  },
  feedBuyBtnText: { color: BG, fontSize: 11, fontWeight: '900', letterSpacing: 0.3 },
  feedCaption: { color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 20 },
  feedCaptionAuthor: { color: '#FFF', fontWeight: '900' },
  feedPrice: { color: LIME, fontSize: 18, fontWeight: '900', marginTop: 10 },
  feedCommentsLink: {
    marginTop: 10, paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.05)',
  },
  feedCommentsLinkText: { color: 'rgba(255,255,255,0.25)', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5 },
  feedMultiMediaBadge: {
    position: 'absolute', top: 10, right: 10,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  feedMultiMediaText: { color: '#FFF', fontSize: 11, fontWeight: '800' },
  carouselDots: {
    position: 'absolute', bottom: 10, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', gap: 5,
  },
  carouselDot: {
    width: 5, height: 5, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  carouselDotActive: {
    backgroundColor: '#FFF', width: 14,
  },
  feedVideoBadge: {
    position: 'absolute', bottom: 10, left: 10,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  feedVideoBadgeText: { color: '#FFF', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  feedMuteBtn: {
    position: 'absolute', bottom: 10, right: 10,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 20,
    padding: 7,
  },
  videoPlayOverlay: {
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  videoPlayCircle: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)',
    paddingLeft: 4,
  },
  feedTagChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  feedTagChipText: { color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '700' },

  // Shared Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.65)' },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center', marginBottom: 16 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingHorizontal: 4 },
  sheetTitle: { color: '#FFF', fontSize: 14, fontWeight: '900', letterSpacing: 2 },

  // Create Post
  createSheet: { backgroundColor: '#111', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  postModal: { flex: 1 },
  postModalHeader: { minHeight: 58, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  postModalClose: { width: 42, height: 42, alignItems: 'flex-start', justifyContent: 'center' },
  postModalTitle: { fontSize: 16, fontWeight: '800' },
  postModalSubmit: { minWidth: 70, minHeight: 36, paddingHorizontal: 16, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  postModalContent: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 24, gap: 10 },
  postAudienceRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  postComposerAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  postCaptionInput: { minHeight: 180, fontSize: 19, lineHeight: 27, paddingVertical: 12 },
  postMediaActions: { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: 10 },
  postMediaButton: { minHeight: 44, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  captionInput: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 16,
    color: '#FFF', fontSize: 15, minHeight: 100, textAlignVertical: 'top',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  charCount: { color: 'rgba(255,255,255,0.3)', fontSize: 11, textAlign: 'right', marginTop: 6, marginBottom: 12 },
  // Multi-media thumbnail strip
  mediaPreviewRow: { flexDirection: 'row', marginBottom: 14, paddingLeft: 2 },
  mediaThumbnailBox: {
    width: 80, height: 80, borderRadius: 12, marginRight: 8,
    overflow: 'hidden', backgroundColor: '#111', position: 'relative',
  },
  mediaThumbnail: { width: '100%', height: '100%' },
  videoOverlayThumb: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center', alignItems: 'center',
  },
  removeThumbnailBtn: {
    position: 'absolute', top: 4, right: 4,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center', alignItems: 'center',
  },
  addMoreBtn: {
    width: 80, height: 80, borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderStyle: 'dashed',
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  mediaCountChip: {
    paddingHorizontal: 10, paddingVertical: 9,
    borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
  },
  mediaCountChipText: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '700' },
  // Legacy (kept for safety)
  imagePreviewContainer: { position: 'relative', marginBottom: 16 },
  imagePreview: { width: '100%', height: 180, borderRadius: 12 },
  removeImage: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, padding: 2 },
  createActions: { marginTop: 12, gap: 10 },
  createActionsTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  anonBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    marginBottom: 4,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  anonBannerText: { color: 'rgba(255,255,255,0.45)', fontSize: 12, flex: 1 },
  mediaButton: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(205,255,0,0.08)',
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(205,255,0,0.15)',
  },
  mediaButtonText: { color: LIME, fontWeight: '700', fontSize: 13 },
  postButton: { backgroundColor: LIME, paddingHorizontal: 32, paddingVertical: 12, borderRadius: 20, minWidth: 90, alignItems: 'center' },
  postButtonDisabled: { opacity: 0.6 },
  postButtonText: { color: BG, fontWeight: '900', fontSize: 13, letterSpacing: 1 },
  anonToggle: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, borderWidth: 1.5, borderColor: '#555', backgroundColor: '#181818' },
  anonToggleActive: { backgroundColor: '#222B10', borderColor: LIME },
  anonToggleText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  anonToggleTextActive: { color: '#FFF' },

  // Comments Sheet
  commentsOverlay: { flex: 1, justifyContent: 'flex-end' },
  commentsSheet: { backgroundColor: '#111', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 0, maxHeight: height * 0.75 },
  commentsLoader: { height: 200, justifyContent: 'center', alignItems: 'center' },
  commentsList: { paddingBottom: 16 },
  noComments: { color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: 40, fontSize: 14 },
  commentItem: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.06)' },
  commentIndented: { paddingLeft: 44, borderBottomColor: 'rgba(255,255,255,0.03)' },
  commentAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(205,255,0,0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 10, flexShrink: 0 },
  commentAvatarText: { color: LIME, fontSize: 11, fontWeight: '900' },
  commentBody: { flex: 1 },
  commentAuthor: { color: '#FFF', fontWeight: '700', fontSize: 12, marginBottom: 3 },
  commentText: { color: 'rgba(255,255,255,0.8)', fontSize: 13, lineHeight: 18 },
  replyBtn: { color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: '700', marginTop: 6 },
  replyChip: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(205,255,0,0.08)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(205,255,0,0.15)' },
  replyChipText: { color: LIME, fontSize: 12, fontWeight: '600', flex: 1 },
  commentInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingBottom: 28, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.08)' },
  commentInput: { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, color: '#FFF', fontSize: 14 },
  sendButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: LIME, justifyContent: 'center', alignItems: 'center' },

  // Listing Detail Modal
  listingModalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' },
  listingModalSheet: { backgroundColor: '#111', borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: height * 0.85, overflow: 'hidden' },
  listingModalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center', marginVertical: 12 },
  listingModalImage: { width: '100%', height: 280 },
  listingModalBody: { padding: 24, paddingBottom: 48 },
  listingModalPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  listingModalPrice: { color: LIME, fontSize: 28, fontWeight: '900' },
  listingModalNegBadge: { backgroundColor: 'rgba(205,255,0,0.1)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(205,255,0,0.2)' },
  listingModalNegText: { color: LIME, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  listingModalTitle: { color: '#FFF', fontSize: 20, fontWeight: '900', marginBottom: 10 },
  listingModalDesc: { color: 'rgba(255,255,255,0.6)', fontSize: 14, lineHeight: 22, marginBottom: 16 },
  listingModalLocRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20 },
  listingModalLoc: { color: 'rgba(255,255,255,0.4)', fontSize: 13 },
  listingModalSellerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  listingModalSellerAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(205,255,0,0.12)', justifyContent: 'center', alignItems: 'center' },
  listingModalSellerInitial: { color: LIME, fontSize: 18, fontWeight: '900' },
  listingModalSellerName: { color: '#FFF', fontWeight: '800', fontSize: 14 },
  listingModalSellerLabel: { color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 2 },
  listingModalMsgBtn: { backgroundColor: LIME, borderRadius: 18, height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  listingModalMsgText: { color: BG, fontWeight: '900', fontSize: 15 },
});
const styles = baseStyles;
