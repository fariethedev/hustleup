import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  ImageBackground,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Video, ResizeMode } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { feedApi, API_URL, usersApi, followsApi, listingsApi } from '../../src/api/client';
import { useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { selectIsAuthenticated, selectUser } from '../../src/store/authSlice';
import StoryBar from '../../src/components/stories/StoryBar';

const { width, height } = Dimensions.get('window');
// Card has marginHorizontal: 14 on each side → content width is width - 28
const CARD_WIDTH = width - 28;
// Keep 4:5 aspect ratio for media (same as feedMediaContainer aspectRatio)
const CARD_MEDIA_HEIGHT = Math.round(CARD_WIDTH * (5 / 4));
const LIME = '#CDFF00';
const BG = '#050505';

// Cross-platform shadow helper (shadow* deprecated on web, use boxShadow)
const shadow = (color, ox = 0, oy = 4, opacity = 0.35, radius = 10, elev = 6) =>
  Platform.select({
    web: { boxShadow: `${ox}px ${oy}px ${radius}px ${color}` },
    default: { shadowColor: color, shadowOffset: { width: ox, height: oy }, shadowOpacity: opacity, shadowRadius: radius, elevation: elev },
  });

// ─── Create Post Modal ────────────────────────────────────────────────────────
const CreatePostModal = ({ visible, onClose, onPostSuccess }) => {
  const [caption, setCaption] = useState('');
  const [mediaItems, setMediaItems] = useState([]); // array of { uri, type, filename, mimeType }
  const [posting, setPosting] = useState(false);

  const MAX_MEDIA = 6;

  const pickMedia = async (onlyVideo = false) => {
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
      mediaTypes: onlyVideo
        ? ImagePicker.MediaType.Videos
        : [ImagePicker.MediaType.Images, ImagePicker.MediaType.Videos],
      allowsMultipleSelection: true,
      allowsEditing: false,
      selectionLimit: MAX_MEDIA - mediaItems.length,
      quality: 0.85,
    });
    if (!result.canceled && result.assets?.length) {
      const newItems = result.assets.map(asset => {
        const filename = asset.uri.split('/').pop();
        const ext = filename.split('.').pop().toLowerCase();
        const isVid = asset.type === 'video';
        const mimeType = isVid
          ? (ext === 'mov' ? 'video/quicktime' : `video/${ext}`)
          : `image/${ext || 'jpeg'}`;
        return { uri: asset.uri, type: asset.type, filename, mimeType };
      });
      setMediaItems(prev => [...prev, ...newItems].slice(0, MAX_MEDIA));
    }
  };

  const removeMedia = (idx) => setMediaItems(prev => prev.filter((_, i) => i !== idx));

  const handlePost = async () => {
    if (!caption.trim() && mediaItems.length === 0) {
      Alert.alert('Nothing to post', 'Add a caption or media before posting.');
      return;
    }
    setPosting(true);
    try {
      const formData = new FormData();
      formData.append('content', caption.trim());
      mediaItems.forEach(m => {
        formData.append('media', { uri: m.uri, name: m.filename, type: m.mimeType });
      });
      await feedApi.createPost(formData);
      setCaption('');
      setMediaItems([]);
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
    setCaption('');
    setMediaItems([]);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={handleClose} />
        <View style={styles.createSheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>NEW POST</Text>
            <TouchableOpacity onPress={handleClose}>
              <Feather name="x" size={22} color="#FFF" />
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.captionInput}
            placeholder="What's your hustle today?"
            placeholderTextColor="rgba(255,255,255,0.3)"
            multiline
            maxLength={300}
            value={caption}
            onChangeText={setCaption}
          />
          <Text style={styles.charCount}>{caption.length}/300</Text>

          {/* Media previews */}
          {mediaItems.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mediaPreviewRow}>
              {mediaItems.map((m, idx) => (
                <View key={idx} style={styles.mediaThumbnailBox}>
                  <Image source={{ uri: m.uri }} style={styles.mediaThumbnail} resizeMode="cover" />
                  {m.type === 'video' && (
                    <View style={styles.videoOverlayThumb}>
                      <Feather name="play" size={16} color="#FFF" />
                    </View>
                  )}
                  <TouchableOpacity style={styles.removeThumbnailBtn} onPress={() => removeMedia(idx)}>
                    <Feather name="x" size={12} color="#FFF" />
                  </TouchableOpacity>
                </View>
              ))}
              {mediaItems.length < MAX_MEDIA && (
                <TouchableOpacity style={styles.addMoreBtn} onPress={() => pickMedia(false)}>
                  <Feather name="plus" size={22} color="rgba(255,255,255,0.4)" />
                </TouchableOpacity>
              )}
            </ScrollView>
          )}

          <View style={styles.createActions}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={styles.mediaButton} onPress={() => pickMedia(false)}>
                <Feather name="image" size={20} color={LIME} />
                <Text style={styles.mediaButtonText}>Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.mediaButton} onPress={() => pickMedia(true)}>
                <Feather name="video" size={20} color={LIME} />
                <Text style={styles.mediaButtonText}>Video</Text>
              </TouchableOpacity>
              {mediaItems.length > 0 && (
                <View style={styles.mediaCountChip}>
                  <Text style={styles.mediaCountChipText}>{mediaItems.length}/{MAX_MEDIA}</Text>
                </View>
              )}
            </View>
            <TouchableOpacity
              style={[styles.postButton, posting && styles.postButtonDisabled]}
              onPress={handlePost}
              disabled={posting}
            >
              {posting ? (
                <ActivityIndicator size="small" color={BG} />
              ) : (
                <Text style={styles.postButtonText}>POST</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ─── Comments Sheet ───────────────────────────────────────────────────────────
const CommentsSheet = ({ visible, postId, onClose, onCountChange }) => {
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
              <Feather name="x" size={22} color="#FFF" />
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
                  <Feather name="x" size={14} color={LIME} />
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
                  <Feather name="send" size={18} color={BG} />
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

const FeedItem = ({ item, onCommentPress, isVisible, onListingPress, onAuthorPress }) => {
  const isAuthenticated = useSelector(selectIsAuthenticated);
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
  const firstMedia = allMedia[0];
  const rawMediaUrl = firstMedia ? resolveMediaUrl(firstMedia.url) : null;
  const isVideo = isPost && firstMedia?.type === 'VIDEO';

  // Auto-play only when scrolled into view
  useEffect(() => {
    setVideoPlaying(!!isVisible);
  }, [isVisible]);

  const authorName = isListing ? item.sellerName : item.authorName;
  const authorRole = isListing ? 'SELLER' : (item.authorRole || null);
  const authorVerified = isListing ? item.sellerVerified : item.authorVerified;
  const authorId = isListing ? item.sellerId : item.authorId;
  const authorAvatarUrl = isListing ? item.sellerAvatarUrl : item.authorAvatarUrl;
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

  const handleShare = async () => {
    Alert.alert(
      'Share Post',
      'How would you like to share?',
      [
        { text: 'Share to User', onPress: () => setShowShareModal(true) },
        { text: 'Share External', onPress: async () => {
          try {
            await RNShare.share({
              message: `Check out this hustle on HustleUp: ${isListing ? item.title : item.content}`,
            });
          } catch {}
        }},
        { text: 'Copy Link', onPress: () => Alert.alert('Copied!', 'Link copied to clipboard') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleCommentCountBump = useCallback(() => {
    setCommentsCount((c) => c + 1);
  }, []);

  return (
    <View style={styles.feedCard}>
      {/* ── Card Header ─────────────────────────────────── */}
      <View style={styles.feedCardHeader}>
        <TouchableOpacity onPress={() => onAuthorPress?.(authorId)} activeOpacity={0.75} style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}>
          <View style={styles.feedAvatar}>
            {authorAvatarUrl && !avatarError ? (
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
              <Text style={styles.feedAuthorName}>{authorName || 'Unknown'}</Text>
              {authorVerified && (
                <MaterialCommunityIcons name="check-decagram" size={14} color={LIME} />
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
          <Feather name="bookmark" size={18} color={saved ? LIME : 'rgba(255,255,255,0.25)'} />
        </TouchableOpacity>
      </View>

      {/* ── Text-only post ───────────────────────────────── */}
      {!rawMediaUrl && (isListing ? item.title : item.content) && (
        <View style={styles.feedTextOnly}>
          <Text style={styles.feedTextOnlyContent}>
            {isListing ? item.title : item.content}
          </Text>
          {isListing && item.price != null && (
            <Text style={styles.feedPrice}>£{item.price}{item.negotiable ? ' · negotiable' : ''}</Text>
          )}
        </View>
      )}

      {/* ── Media ────────────────────────────────────────── */}
      {allMedia.length > 0 && (
        <View style={styles.feedMediaContainer}>
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
                    <TouchableOpacity key={idx} style={{ width: CARD_WIDTH, height: CARD_MEDIA_HEIGHT }} onPress={() => setVideoPlaying(p => !p)} activeOpacity={1}>
                      <Video source={{ uri: mUrl }} style={{ width: CARD_WIDTH, height: CARD_MEDIA_HEIGHT }} resizeMode={ResizeMode.COVER} shouldPlay={videoPlaying && activeMediaIdx === idx} isLooping isMuted={isMuted} />
                      {!videoPlaying && (
                        <View style={[StyleSheet.absoluteFillObject, styles.videoPlayOverlay, { pointerEvents: 'none' }]}>
                          <View style={styles.videoPlayCircle}><Feather name="play" size={28} color="#FFF" /></View>
                        </View>
                      )}
                    </TouchableOpacity>
                  ) : (
                    <Image key={idx} source={{ uri: mUrl }} style={{ width: CARD_WIDTH, height: CARD_MEDIA_HEIGHT }} resizeMode="cover" />
                  );
                })}
              </ScrollView>
              <View style={styles.carouselDots}>
                {allMedia.map((_, i) => (
                  <View key={i} style={[styles.carouselDot, i === activeMediaIdx && styles.carouselDotActive]} />
                ))}
              </View>
              <View style={styles.feedMultiMediaBadge}>
                <MaterialCommunityIcons name="layers-outline" size={13} color="#FFF" />
                <Text style={styles.feedMultiMediaText}>{activeMediaIdx + 1}/{allMedia.length}</Text>
              </View>
            </>
          ) : isVideo && Platform.OS !== 'web' ? (
            <TouchableOpacity style={{ flex: 1 }} onPress={() => setVideoPlaying(p => !p)} activeOpacity={1}>
              <Video source={{ uri: rawMediaUrl }} style={styles.feedMedia} resizeMode={ResizeMode.COVER} shouldPlay={videoPlaying} isLooping isMuted={isMuted} />
              {!videoPlaying && (
                <View style={[StyleSheet.absoluteFillObject, styles.videoPlayOverlay, { pointerEvents: 'none' }]}>
                  <View style={styles.videoPlayCircle}><Feather name="play" size={28} color="#FFF" /></View>
                </View>
              )}
            </TouchableOpacity>
          ) : (
            <Image source={{ uri: rawMediaUrl }} style={styles.feedMedia} resizeMode="cover" />
          )}
          {isVideo && (
            <TouchableOpacity style={styles.feedMuteBtn} onPress={() => setIsMuted(p => !p)} activeOpacity={0.8}>
              <MaterialCommunityIcons name={isMuted ? 'volume-off' : 'volume-high'} size={18} color="#FFF" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── Footer ───────────────────────────────────────── */}
      <View style={styles.feedCardFooter}>
        <View style={styles.feedActionsRow}>
          <TouchableOpacity style={styles.feedActionBtn} onPress={handleLike} activeOpacity={0.7}>
            <MaterialCommunityIcons
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
            <MaterialCommunityIcons name="comment-outline" size={26} color="rgba(255,255,255,0.55)" />
            {commentsCount > 0 && <Text style={styles.feedActionCount}>{commentsCount}</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.feedActionBtn} onPress={handleShare}>
            <Feather name="send" size={22} color="rgba(255,255,255,0.55)" />
          </TouchableOpacity>
          {isListing && item.price != null && (
            <TouchableOpacity style={styles.feedBuyBtn} onPress={() => onListingPress?.(item)}>
              <Text style={styles.feedBuyBtnText}>
                £{item.price} · VIEW
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
const MY_SUB_TABS = ['Posts', 'Listings', 'Followers', 'Following', 'Viewers'];

function MyHustleTab({ currentUser, router, onCreatePost }) {
  const [subTab, setSubTab] = useState('Posts');
  const [posts, setPosts] = useState([]);
  const [listings, setListings] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [viewers, setViewers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [feedRes, listRes, followersRes, followingRes, viewersRes] = await Promise.allSettled([
        feedApi.getPosts(),
        listingsApi.browse({}),
        followsApi.getMyFollowers(),
        followsApi.getMyFollowing(),
        usersApi.getMyViewers(),
      ]);
      if (feedRes.status === 'fulfilled') {
        setPosts((feedRes.value.data || []).filter(p => p.authorId === currentUser?.id));
      }
      if (listRes.status === 'fulfilled') {
        setListings((listRes.value.data || []).filter(l => l.sellerId === currentUser?.id));
      }
      if (followersRes.status === 'fulfilled') setFollowers(followersRes.value.data || []);
      if (followingRes.status === 'fulfilled') setFollowing(followingRes.value.data || []);
      if (viewersRes.status === 'fulfilled') setViewers(viewersRes.value.data || []);
    } catch (e) {}
    setLoading(false);
  };

  const handleFollowToggle = async (user) => {
    try {
      if (user.isFollowing) {
        await followsApi.unfollow(user.id);
        setFollowers(prev => prev.map(u => u.id === user.id ? { ...u, isFollowing: false } : u));
        setFollowing(prev => prev.map(u => u.id === user.id ? { ...u, isFollowing: false } : u));
      } else {
        await followsApi.follow(user.id);
        setFollowers(prev => prev.map(u => u.id === user.id ? { ...u, isFollowing: true } : u));
        setFollowing(prev => prev.map(u => u.id === user.id ? { ...u, isFollowing: true } : u));
      }
    } catch (e) {}
  };

  const UserCard = ({ user, showFollowBtn = true, badge }) => (
    <TouchableOpacity
      style={mhStyles.userCard}
      onPress={() => router.push(`/profile/${user.id}`)}
      activeOpacity={0.8}
    >
      <View style={mhStyles.userAvatar}>
        {user.avatarUrl ? (
          <Image
            source={{ uri: resolveMediaUrl(user.avatarUrl) }}
            style={{ width: '100%', height: '100%', borderRadius: 24 }}
          />
        ) : (
          <Text style={mhStyles.userAvatarText}>
            {(user.fullName || user.username || '?')[0].toUpperCase()}
          </Text>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={mhStyles.userName}>{user.fullName || user.username}</Text>
        <Text style={mhStyles.userRole}>{user.role || 'BUYER'}</Text>
        {badge && <Text style={mhStyles.viewBadge}>{badge}</Text>}
      </View>
      {showFollowBtn && (
        <TouchableOpacity
          style={[mhStyles.followBtn, user.isFollowing && mhStyles.followingBtn]}
          onPress={() => handleFollowToggle(user)}
        >
          <Text style={[mhStyles.followBtnText, user.isFollowing && mhStyles.followingBtnText]}>
            {user.isFollowing ? 'Following' : 'Follow'}
          </Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  const PostGrid = () =>
    posts.length === 0 ? (
      <View style={mhStyles.empty}>
        <Feather name="image" size={32} color="rgba(255,255,255,0.1)" />
        <Text style={mhStyles.emptyText}>No posts yet</Text>
        <TouchableOpacity style={mhStyles.emptyBtn} onPress={onCreatePost}>
          <Text style={mhStyles.emptyBtnText}>Create Post</Text>
        </TouchableOpacity>
      </View>
    ) : (
      <View style={mhStyles.grid}>
        {posts.map((p) => {
          const imgUrl = resolveMediaUrl(p.media?.[0]?.url || p.imageUrl);
          return (
            <View key={p.id} style={mhStyles.gridCell}>
              {imgUrl ? (
                <Image source={{ uri: imgUrl }} style={mhStyles.gridImg} resizeMode="cover" />
              ) : (
                <View style={[mhStyles.gridImg, mhStyles.gridNoImg]}>
                  <Feather name="file-text" size={20} color={LIME} />
                </View>
              )}
              <View style={mhStyles.gridOverlay}>
                <Text style={mhStyles.gridCaption} numberOfLines={2}>{p.content}</Text>
                <View style={mhStyles.gridStats}>
                  <Feather name="heart" size={10} color={LIME} />
                  <Text style={mhStyles.gridStat}>{p.likesCount || 0}</Text>
                </View>
              </View>
            </View>
          );
        })}
      </View>
    );

  const ListingGrid = () =>
    listings.length === 0 ? (
      <View style={mhStyles.empty}>
        <Feather name="shopping-bag" size={32} color="rgba(255,255,255,0.1)" />
        <Text style={mhStyles.emptyText}>No listings yet</Text>
        <TouchableOpacity style={mhStyles.emptyBtn} onPress={() => router.push('/(tabs)/explore')}>
          <Text style={mhStyles.emptyBtnText}>Create Listing</Text>
        </TouchableOpacity>
      </View>
    ) : (
      <View style={mhStyles.grid}>
        {listings.map((l) => {
          const imgUrl = resolveMediaUrl(l.mediaUrls?.[0]);
          return (
            <View key={l.id} style={mhStyles.gridCell}>
              {imgUrl ? (
                <Image source={{ uri: imgUrl }} style={mhStyles.gridImg} resizeMode="cover" />
              ) : (
                <View style={[mhStyles.gridImg, mhStyles.gridNoImg]}>
                  <Feather name="package" size={20} color={LIME} />
                </View>
              )}
              <View style={mhStyles.gridOverlay}>
                <Text style={mhStyles.gridCaption} numberOfLines={1}>{l.title}</Text>
                <Text style={mhStyles.gridPrice}>${l.price}</Text>
              </View>
            </View>
          );
        })}
      </View>
    );

  if (loading) {
    return (
      <View style={mhStyles.loadingBox}>
        <ActivityIndicator color={LIME} />
      </View>
    );
  }

  const counts = { Posts: posts.length, Listings: listings.length, Followers: followers.length, Following: following.length, Viewers: viewers.length };

  return (
    <ScrollView style={mhStyles.container} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 4 }}>
      {/* Sub-tab bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={mhStyles.subTabRow}>
        {MY_SUB_TABS.map(t => (
          <TouchableOpacity
            key={t}
            style={[mhStyles.subTab, subTab === t && mhStyles.subTabActive]}
            onPress={() => setSubTab(t)}
            activeOpacity={0.75}
          >
            <Text style={[mhStyles.subTabText, subTab === t && mhStyles.subTabTextActive]}>{t}</Text>
            <View style={[mhStyles.subTabCount, subTab === t && mhStyles.subTabCountActive]}>
              <Text style={[mhStyles.subTabCountText, subTab === t && { color: BG }]}>{counts[t]}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Tab content */}
      {subTab === 'Posts' && <PostGrid />}
      {subTab === 'Listings' && <ListingGrid />}
      {subTab === 'Followers' && (
        <View style={mhStyles.listSection}>
          {followers.length === 0 ? (
            <View style={mhStyles.empty}>
              <Feather name="users" size={32} color="rgba(255,255,255,0.1)" />
              <Text style={mhStyles.emptyText}>No followers yet</Text>
            </View>
          ) : followers.map(u => <UserCard key={u.id} user={u} />)}
        </View>
      )}
      {subTab === 'Following' && (
        <View style={mhStyles.listSection}>
          {following.length === 0 ? (
            <View style={mhStyles.empty}>
              <Feather name="user-plus" size={32} color="rgba(255,255,255,0.1)" />
              <Text style={mhStyles.emptyText}>Not following anyone yet</Text>
            </View>
          ) : following.map(u => <UserCard key={u.id} user={u} />)}
        </View>
      )}
      {subTab === 'Viewers' && (
        <View style={mhStyles.listSection}>
          {viewers.length === 0 ? (
            <View style={mhStyles.empty}>
              <Feather name="eye" size={32} color="rgba(255,255,255,0.1)" />
              <Text style={mhStyles.emptyText}>No profile views yet</Text>
              <Text style={mhStyles.emptySubText}>Share your profile to get discovered</Text>
            </View>
          ) : viewers.map((v, i) => (
            <UserCard
              key={`${v.id}-${i}`}
              user={v}
              showFollowBtn={false}
              badge={v.viewedAt ? `Viewed ${new Date(v.viewedAt).toLocaleDateString()}` : undefined}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const mhStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  subTabRow: { paddingHorizontal: 20, paddingVertical: 16, gap: 8 },
  subTab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  subTabActive: { backgroundColor: LIME, borderColor: LIME },
  subTabText: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '800' },
  subTabTextActive: { color: BG },
  subTabCount: {
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4,
  },
  subTabCountActive: { backgroundColor: 'rgba(5,5,5,0.2)' },
  subTabCountText: { color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '900' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 3, paddingHorizontal: 16 },
  gridCell: {
    width: (width - 38) / 3,
    borderRadius: 10, overflow: 'hidden',
    backgroundColor: '#111',
  },
  gridImg: { width: '100%', aspectRatio: 1 },
  gridNoImg: { aspectRatio: 1, justifyContent: 'center', alignItems: 'center' },
  gridOverlay: {
    paddingHorizontal: 6, paddingVertical: 5,
    backgroundColor: '#111',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  gridCaption: { color: '#FFF', fontSize: 9, fontWeight: '600', lineHeight: 12 },
  gridStats: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  gridStat: { color: LIME, fontSize: 9, fontWeight: '900' },
  gridPrice: { color: LIME, fontSize: 10, fontWeight: '900', marginTop: 2 },
  listSection: { paddingHorizontal: 16, gap: 10 },
  userCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  userAvatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(205,255,0,0.1)',
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  userAvatarText: { color: LIME, fontSize: 16, fontWeight: '900' },
  userName: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  userRole: { color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: '600', marginTop: 2, textTransform: 'uppercase' },
  viewBadge: { color: LIME, fontSize: 10, fontWeight: '700', marginTop: 3 },
  followBtn: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: LIME,
  },
  followingBtn: { backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  followBtnText: { color: BG, fontSize: 11, fontWeight: '900' },
  followingBtnText: { color: 'rgba(255,255,255,0.6)' },
  empty: { paddingVertical: 50, alignItems: 'center', gap: 10 },
  emptyText: { color: 'rgba(255,255,255,0.3)', fontSize: 13, fontWeight: '700' },
  emptySubText: { color: 'rgba(255,255,255,0.2)', fontSize: 11, textAlign: 'center' },
  emptyBtn: { backgroundColor: LIME, paddingHorizontal: 20, paddingVertical: 9, borderRadius: 20, marginTop: 4 },
  emptyBtnText: { color: BG, fontWeight: '900', fontSize: 12 },
});

// ─── Share To User Modal ──────────────────────────────────────────────────────
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
            <Feather name="search" size={16} color="rgba(255,255,255,0.3)" />
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
                    <Feather name="check" size={10} color="#FFF" />
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
                <Feather name="link" size={18} color="#60A5FA" />
              </View>
              <Text style={shareStyles.optionText}>Copy Link</Text>
            </TouchableOpacity>
            <TouchableOpacity style={shareStyles.optionItem} onPress={() => { handleClose(); Alert.alert('Reposted!', 'Post shared to your timeline'); }}>
              <View style={[shareStyles.optionIcon, { backgroundColor: 'rgba(52,199,89,0.12)' }]}>
                <Feather name="repeat" size={18} color="#34C759" />
              </View>
              <Text style={shareStyles.optionText}>Repost</Text>
            </TouchableOpacity>
            <TouchableOpacity style={shareStyles.optionItem} onPress={async () => { handleClose(); try { await RNShare.share({ message: `Check this out on HustleUp: ${postContent}` }); } catch {} }}>
              <View style={[shareStyles.optionIcon, { backgroundColor: 'rgba(167,139,250,0.12)' }]}>
                <Feather name="share" size={18} color="#A78BFA" />
              </View>
              <Text style={shareStyles.optionText}>External</Text>
            </TouchableOpacity>
            <TouchableOpacity style={shareStyles.optionItem} onPress={() => { handleClose(); Alert.alert('Saved!', 'Post saved to your bookmarks'); }}>
              <View style={[shareStyles.optionIcon, { backgroundColor: 'rgba(244,114,182,0.12)' }]}>
                <Feather name="bookmark" size={18} color="#F472B6" />
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
const MOCK_LIVE_STREAMS = [
  { id: 'l1', name: 'Tyler B.', title: 'Cooking masterclass 🍝', viewers: 342, avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200&h=200&fit=crop&crop=face', thumbnail: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=500&fit=crop' },
  { id: 'l2', name: 'Zara T.', title: 'Late night vibes 🎶', viewers: 128, avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&h=200&fit=crop&crop=face', thumbnail: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=500&fit=crop' },
  { id: 'l3', name: 'David O.', title: 'DJ set from Lagos 🎧', viewers: 891, avatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=200&h=200&fit=crop&crop=face', thumbnail: 'https://images.unsplash.com/photo-1571266028243-d220c6e9f6a7?w=400&h=500&fit=crop' },
];

const LiveStreamSection = ({ onGoLive }) => (
  <View style={liveStyles.wrap}>
    <View style={liveStyles.headerRow}>
      <View style={liveStyles.headerLeft}>
        <View style={liveStyles.liveDot} />
        <Text style={liveStyles.headerTitle}>LIVE NOW</Text>
        <View style={liveStyles.countBadge}>
          <Text style={liveStyles.countText}>{MOCK_LIVE_STREAMS.length}</Text>
        </View>
      </View>
      <TouchableOpacity style={liveStyles.goLiveBtn} onPress={onGoLive} activeOpacity={0.8}>
        <Feather name="video" size={14} color="#FFF" />
        <Text style={liveStyles.goLiveText}>Go Live</Text>
      </TouchableOpacity>
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={liveStyles.scrollContent}>
      {MOCK_LIVE_STREAMS.map(stream => (
        <TouchableOpacity key={stream.id} style={liveStyles.card} activeOpacity={0.85}
          onPress={() => Alert.alert('📺 Live Stream', `Joining ${stream.name}'s stream: ${stream.title}`)}
        >
          <ImageBackground source={{ uri: stream.thumbnail }} style={liveStyles.cardBg} imageStyle={liveStyles.cardBgImg}>
            <LinearGradient colors={['transparent', 'rgba(0,0,0,0.85)']} style={liveStyles.cardGrad}>
              <View style={liveStyles.cardLiveBadge}>
                <View style={liveStyles.cardLiveDot} />
                <Text style={liveStyles.cardLiveText}>LIVE</Text>
              </View>
              <View style={liveStyles.cardViewers}>
                <Feather name="eye" size={10} color="#FFF" />
                <Text style={liveStyles.cardViewersText}>{stream.viewers}</Text>
              </View>
              <View style={liveStyles.cardBottom}>
                <Image source={{ uri: stream.avatar }} style={liveStyles.cardAvatar} />
                <View style={{ flex: 1 }}>
                  <Text style={liveStyles.cardName}>{stream.name}</Text>
                  <Text style={liveStyles.cardTitle} numberOfLines={1}>{stream.title}</Text>
                </View>
              </View>
            </LinearGradient>
          </ImageBackground>
        </TouchableOpacity>
      ))}
    </ScrollView>
  </View>
);

const liveStyles = StyleSheet.create({
  wrap: { marginBottom: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 14 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF3B30' },
  headerTitle: { color: '#FFF', fontSize: 13, fontWeight: '900', letterSpacing: 1 },
  countBadge: { backgroundColor: 'rgba(255,59,48,0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  countText: { color: '#FF3B30', fontSize: 10, fontWeight: '900' },
  goLiveBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FF3B30', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  goLiveText: { color: '#FFF', fontSize: 11, fontWeight: '900' },
  scrollContent: { paddingHorizontal: 16, gap: 12 },
  card: { width: 160, height: 220, borderRadius: 20, overflow: 'hidden' },
  cardBg: { width: '100%', height: '100%' },
  cardBgImg: { borderRadius: 20 },
  cardGrad: { flex: 1, padding: 12, justifyContent: 'space-between' },
  cardLiveBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: '#FF3B30', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  cardLiveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#FFF' },
  cardLiveText: { color: '#FFF', fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
  cardViewers: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginTop: 4 },
  cardViewersText: { color: '#FFF', fontSize: 9, fontWeight: '800' },
  cardBottom: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardAvatar: { width: 28, height: 28, borderRadius: 10, borderWidth: 1.5, borderColor: '#FF3B30' },
  cardName: { color: '#FFF', fontSize: 11, fontWeight: '800' },
  cardTitle: { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '600' },
});

// ─── Category Filter ──────────────────────────────────────────────────────────
const CATEGORIES = ['All', 'Trending', 'Jobs', 'Creative', 'Tech', 'Services'];

const CategoryFilter = ({ active, onSelect }) => (
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    contentContainerStyle={styles.categoryRow}
  >
    {CATEGORIES.map((cat) => (
      <TouchableOpacity
        key={cat}
        style={[styles.categoryChip, active === cat && styles.categoryChipActive]}
        onPress={() => onSelect(cat)}
        activeOpacity={0.75}
      >
        <Text style={[styles.categoryChipText, active === cat && styles.categoryChipTextActive]}>
          {cat}
        </Text>
      </TouchableOpacity>
    ))}
  </ScrollView>
);

// ─── Quick Action ─────────────────────────────────────────────────────────────
const QuickAction = ({ icon, label, color, onPress }) => (
  <TouchableOpacity
    style={[styles.quickAction, { borderColor: `${color}20` }]}
    onPress={onPress}
    activeOpacity={0.75}
  >
    <View style={[styles.quickActionIcon, { backgroundColor: `${color}15` }]}>
      <Feather name={icon} size={22} color={color} />
    </View>
    <Text style={[styles.quickActionLabel, { color }]}>{label}</Text>
  </TouchableOpacity>
);

// ─── Empty Feed State ─────────────────────────────────────────────────────────
const EmptyFeed = ({ onCreatePost, router }) => (
  <View style={styles.emptyFeed}>
    <LinearGradient
      colors={['rgba(205,255,0,0.06)', 'transparent']}
      style={styles.emptyGlow}
    />
    <View style={styles.emptyIcon}>
      <MaterialCommunityIcons name="lightning-bolt" size={48} color={LIME} />
    </View>
    <Text style={styles.emptyTitle}>THE FEED IS EMPTY</Text>
    <Text style={styles.emptySubtitle}>
      Be the first to share your hustle.{'\n'}Your story could inspire thousands.
    </Text>
    <TouchableOpacity style={styles.emptyCtaPrimary} onPress={onCreatePost} activeOpacity={0.85}>
      <Feather name="plus" size={16} color={BG} />
      <Text style={styles.emptyCtaPrimaryText}>CREATE FIRST POST</Text>
    </TouchableOpacity>
    <TouchableOpacity
      style={styles.emptyCtaSecondary}
      onPress={() => router.push('/(tabs)/explore')}
      activeOpacity={0.75}
    >
      <Text style={styles.emptyCtaSecondaryText}>Browse the Marketplace</Text>
      <Feather name="arrow-right" size={14} color={LIME} />
    </TouchableOpacity>
  </View>
);

// ─── Home Screen ──────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const router = useRouter();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const currentUser = useSelector(selectUser);
  const insets = useSafeAreaInsets();
  // Fixed top bar height = safe area top + 54px (logo row)
  const TOP_BAR_HEIGHT = insets.top + 54;
  const [mainTab, setMainTab] = useState('fyp'); // 'fyp' | 'hustle'
  const [data, setData] = useState([]);
  const [sort, setSort] = useState('latest');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCategory, setActiveCategory] = useState('All');
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [commentsPostId, setCommentsPostId] = useState(null);
  const [commentsCountBump, setCommentsCountBump] = useState(null);
  const [commentsVisible, setCommentsVisible] = useState(false);
  const [visibleItemId, setVisibleItemId] = useState(null);
  const [selectedListing, setSelectedListing] = useState(null);

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 });
  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setVisibleItemId(viewableItems[0].item.id);
    }
  });

  useEffect(() => {
    fetchFeed();
  }, [sort]);

  const fetchFeed = async () => {
    try {
      setLoading(true);
      const isRec = sort === 'recommended';
      const [postsRes, listingsRes] = await Promise.allSettled([
        feedApi.getPosts(sort),
        isRec ? listingsApi.getRecommended() : listingsApi.forFeed(),
      ]);
      const posts = postsRes.status === 'fulfilled'
        ? (postsRes.value.data || []).map(p => ({ ...p, type: 'POST' }))
        : [];
      const listings = listingsRes.status === 'fulfilled'
        ? (listingsRes.value.data || []).map(l => ({ ...l, id: l.id?.toString(), type: 'LISTING' }))
        : [];
      // Interleave: every 3 posts, insert a listing card
      const mixed = [];
      let li = 0;
      posts.forEach((post, idx) => {
        mixed.push(post);
        if ((idx + 1) % 3 === 0 && li < listings.length) {
          mixed.push(listings[li++]);
        }
      });
      // Append remaining listings at end
      while (li < listings.length) mixed.push(listings[li++]);
      setData(mixed);
    } catch (e) {
      console.error('Feed fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const isRec = sort === 'recommended';
      const [postsRes, listingsRes] = await Promise.allSettled([
        feedApi.getPosts(sort),
        isRec ? listingsApi.getRecommended() : listingsApi.forFeed(),
      ]);
      const posts = postsRes.status === 'fulfilled'
        ? (postsRes.value.data || []).map(p => ({ ...p, type: 'POST' }))
        : [];
      const listings = listingsRes.status === 'fulfilled'
        ? (listingsRes.value.data || []).map(l => ({ ...l, id: l.id?.toString(), type: 'LISTING' }))
        : [];
      const mixed = [];
      let li = 0;
      posts.forEach((post, idx) => {
        mixed.push(post);
        if ((idx + 1) % 3 === 0 && li < listings.length) mixed.push(listings[li++]);
      });
      while (li < listings.length) mixed.push(listings[li++]);
      setData(mixed);
    } catch (e) {}
    setRefreshing(false);
  }, [sort]);

  const handleCommentPress = useCallback((postId, countBumpFn) => {
    setCommentsPostId(postId);
    setCommentsCountBump(() => countBumpFn);
    setCommentsVisible(true);
  }, []);

  const handleCommentCountChange = useCallback(() => {
    commentsCountBump && commentsCountBump();
  }, [commentsCountBump]);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  })();
  const firstName = currentUser?.fullName?.split(' ')[0] || currentUser?.username || 'Hustler';

  const renderHeader = () => (
    <View style={styles.headerSection}>

      {/* ── Stories ── */}
      <View style={styles.storiesBlock}>
        <StoryBar />
      </View>

      {/* ── Live Streams ── */}
      <LiveStreamSection onGoLive={() => Alert.alert('🔴 Go Live', 'Starting your live stream...\n\nThis feature requires camera access and a streaming server.', [{ text: 'Start', onPress: () => router.push('/livestream') }, { text: 'Cancel', style: 'cancel' }])} />

      {/* ── Sort Bar ─────────────────────────────────────── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortBar}>
        {[
          { key: 'recommended', label: '🎯 For You' },
          { key: 'latest',      label: '🕒 Latest' },
          { key: 'trending',    label: '🔥 Trending' },
          { key: 'popular',     label: '💬 Popular' },
        ].map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            style={[styles.sortChip, sort === key && styles.sortChipActive]}
            onPress={() => setSort(key)}
            activeOpacity={0.75}
          >
            <Text style={[styles.sortChipText, sort === key && styles.sortChipTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Quick Actions ─────────────────────────────────── */}
      <View style={styles.quickActionsBlock}>
        <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>
        <View style={styles.quickActionsRow}>
          <QuickAction icon="search"         label="Explore"   color={LIME}      onPress={() => router.navigate('/(tabs)/explore')} />
          <QuickAction icon="message-circle" label="Messages"  color="#60A5FA"   onPress={() => router.navigate('/(tabs)/messages')} />
          <QuickAction icon="edit-3"         label="New Post"  color="#F472B6"   onPress={() => setCreateModalVisible(true)} />
          <QuickAction icon="video"          label="Go Live"   color="#FF3B30"   onPress={() => Alert.alert('🔴 Go Live', 'Starting your live stream...', [{ text: 'Start', onPress: () => router.push('/livestream') }, { text: 'Cancel', style: 'cancel' }])} />
        </View>
      </View>

      {/* ── Feed Header ───────────────────────────────────── */}
      <View style={styles.feedHeader}>
        <Text style={styles.sectionTitle}>YOUR FEED</Text>
        <CategoryFilter active={activeCategory} onSelect={setActiveCategory} />
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={LIME} />
        <Text style={styles.loadingText}>Loading your feed…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Fixed top bar — absolutely positioned, sits above everything */}
      <SafeAreaView edges={['top']} style={[styles.fixedTopBar, { zIndex: 100 }]}>
        <View style={styles.topBarRow}>
          <Text style={styles.topBarLogo}>HUSTLE<Text style={{ color: LIME }}>UP</Text></Text>
          <View style={styles.tabToggles}>
            <TouchableOpacity onPress={() => setMainTab('fyp')}>
              <Text style={mainTab === 'fyp' ? styles.activeTabText : styles.inactiveTabText}>FYP</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setMainTab('hustle')}>
              <Text style={mainTab === 'hustle' ? styles.activeTabText : styles.inactiveTabText}>MY HUSTLE</Text>
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity style={styles.heroIconBtn} onPress={() => router.push('/(tabs)/messages')} activeOpacity={0.8}>
              <Feather name="bell" size={18} color="#FFF" />
              <View style={styles.notifDot} />
            </TouchableOpacity>
            {isAuthenticated && (
              <TouchableOpacity style={styles.topBarPlusBtn} onPress={() => setCreateModalVisible(true)} activeOpacity={0.85}>
                <Feather name="plus" size={20} color={BG} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </SafeAreaView>

      {/* MY HUSTLE tab */}
      {mainTab === 'hustle' && (
        <View style={[styles.tabContent, { paddingTop: TOP_BAR_HEIGHT }]}>
          <View style={styles.hustleTabHeader}>
            <Text style={styles.hustleTabTitle}>MY HUSTLE</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/profile')}>
              <Feather name="settings" size={20} color="rgba(255,255,255,0.4)" />
            </TouchableOpacity>
          </View>
          <MyHustleTab
            currentUser={currentUser}
            router={router}
            onCreatePost={() => setCreateModalVisible(true)}
          />
        </View>
      )}

      {/* FYP tab */}
      {mainTab === 'fyp' && data.length === 0 ? (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={LIME} />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: TOP_BAR_HEIGHT }}
        >
          {renderHeader()}
          <EmptyFeed onCreatePost={() => setCreateModalVisible(true)} router={router} />
        </ScrollView>
      ) : mainTab === 'fyp' ? (
        <FlatList
          data={data}
          renderItem={({ item }) => (
            <FeedItem
              item={item}
              onCommentPress={handleCommentPress}
              isVisible={item.id === visibleItemId}
              onListingPress={(listing) => setSelectedListing(listing)}
              onAuthorPress={(authorId) => authorId && router.push(`/profile/${authorId}`)}
            />
          )}
          keyExtractor={(item) => `${item.type}_${item.id}`}
          showsVerticalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged.current}
          viewabilityConfig={viewabilityConfig.current}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={{ paddingTop: TOP_BAR_HEIGHT, paddingBottom: 4 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={LIME} />}
        />
      ) : null}

      <CreatePostModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onPostSuccess={fetchFeed}
      />

      <CommentsSheet
        visible={commentsVisible}
        postId={commentsPostId}
        onClose={() => { setCommentsVisible(false); setCommentsPostId(null); }}
        onCountChange={handleCommentCountChange}
      />

      {/* Listing Detail Sheet */}
      <Modal
        visible={!!selectedListing}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedListing(null)}
      >
        <View style={styles.listingModalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={() => setSelectedListing(null)} />
          <View style={styles.listingModalSheet}>
            <View style={styles.listingModalHandle} />
            <ScrollView showsVerticalScrollIndicator={false}>
              {selectedListing?.mediaUrls?.[0] && (
                <Image
                  source={{ uri: resolveMediaUrl(selectedListing.mediaUrls[0]) }}
                  style={styles.listingModalImage}
                  resizeMode="cover"
                />
              )}
              <View style={styles.listingModalBody}>
                <View style={styles.listingModalPriceRow}>
                  <Text style={styles.listingModalPrice}>£{selectedListing?.price}</Text>
                  {selectedListing?.negotiable && (
                    <View style={styles.listingModalNegBadge}><Text style={styles.listingModalNegText}>NEGOTIABLE</Text></View>
                  )}
                </View>
                <Text style={styles.listingModalTitle}>{selectedListing?.title}</Text>
                {selectedListing?.description && (
                  <Text style={styles.listingModalDesc}>{selectedListing.description}</Text>
                )}
                {selectedListing?.locationCity && (
                  <View style={styles.listingModalLocRow}>
                    <Feather name="map-pin" size={13} color="rgba(255,255,255,0.4)" />
                    <Text style={styles.listingModalLoc}>{selectedListing.locationCity}</Text>
                  </View>
                )}
                {selectedListing?.sellerName && (
                  <TouchableOpacity
                    style={styles.listingModalSellerRow}
                    onPress={() => { setSelectedListing(null); if (selectedListing.sellerId) router.push(`/profile/${selectedListing.sellerId}`); }}
                  >
                    <View style={styles.listingModalSellerAvatar}>
                      <Text style={styles.listingModalSellerInitial}>{(selectedListing.sellerName || '?')[0].toUpperCase()}</Text>
                    </View>
                    <View>
                      <Text style={styles.listingModalSellerName}>{selectedListing.sellerName}</Text>
                      <Text style={styles.listingModalSellerLabel}>Seller · View profile</Text>
                    </View>
                    <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.3)" style={{ marginLeft: 'auto' }} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.listingModalMsgBtn}
                  onPress={() => { setSelectedListing(null); if (selectedListing?.sellerId) router.push({ pathname: '/(tabs)/messages', params: { partnerId: selectedListing.sellerId } }); }}
                >
                  <Feather name="message-circle" size={18} color={BG} />
                  <Text style={styles.listingModalMsgText}>Message Seller</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
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
  },
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
  },
  greetAvatarText: { color: LIME, fontSize: 18, fontWeight: '900' },

  // Stories block
  storiesBlock: { marginTop: 28, marginBottom: 4 },
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
  feedAuthorName: { color: '#FFF', fontSize: 14, fontWeight: '900', letterSpacing: 0.1 },
  feedTimestamp: { color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: '700', marginTop: 2, letterSpacing: 0.5 },
  feedListingBadge: {
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8,
    backgroundColor: 'rgba(205,255,0,0.1)', borderWidth: 1, borderColor: 'rgba(205,255,0,0.18)',
  },
  feedListingBadgeText: { color: LIME, fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  feedTextOnly: { paddingHorizontal: 16, paddingBottom: 16 },
  feedTextOnlyContent: { color: 'rgba(255,255,255,0.85)', fontSize: 15, lineHeight: 23, fontWeight: '500' },
  feedMediaContainer: { width: '100%', aspectRatio: 4 / 5, backgroundColor: '#0a0a0a', overflow: 'hidden' },
  feedMedia: { width: '100%', height: '100%' },
  feedCardFooter: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14 },
  feedActionsRow: { flexDirection: 'row', alignItems: 'center', gap: 22, marginBottom: 12 },
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
  createActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
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

