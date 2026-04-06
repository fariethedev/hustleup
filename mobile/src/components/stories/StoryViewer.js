import React, { useState, useEffect, useRef } from 'react';
import {
  Alert,
  Modal,
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
  StatusBar,
  Platform,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSelector } from 'react-redux';
import { selectUser } from '../../store/authSlice';
import { storiesApi, API_URL } from '../../api/client';

const { width, height } = Dimensions.get('window');
const LIME = '#CDFF00';
const STORY_DURATION = 5000;
const getServerBase = () =>
  (typeof API_URL !== 'undefined' && API_URL ? API_URL : 'http://localhost:8000/api/v1').replace('/api/v1', '');

export default function StoryViewer({ visible, stories, initialIndex = 0, onClose, onAddStory }) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [viewsCount, setViewsCount] = useState(0);
  const [paused, setPaused] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [showReply, setShowReply] = useState(false);
  const [likeAnimScale] = useState(new Animated.Value(1));

  const progress = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(null);
  const currentUser = useSelector(selectUser);

  const currentStory = stories[currentIndex];
  const isOwner = currentStory?.authorId === currentUser?.id;

  // Resolve relative media URLs (e.g. /uploads/... → full URL)
  const resolveMediaUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http') || url.startsWith('blob:')) return url;
    const base = getServerBase();
    return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  useEffect(() => {
    if (visible && currentStory) {
      setIsLiked(currentStory.likedByCurrentUser || false);
      setLikesCount(currentStory.likesCount || 0);
      setViewsCount(currentStory.viewsCount || 0);
      setShowReply(false);
      setReplyText('');
      recordView();
    }
  }, [visible, currentIndex]);

  useEffect(() => {
    if (!visible || !currentStory) return;
    if (paused) {
      progressAnim.current?.stop();
      return;
    }
    startProgress();
    return () => progressAnim.current?.stop();
  }, [visible, currentIndex, paused]);

  const recordView = async () => {
    if (!currentStory || isOwner) return;
    try { await storiesApi.view(currentStory.id); } catch { /* silent */ }
  };

  const mediaUrl = currentStory
    ? (currentStory.mediaUrl || currentStory.imageUrl || currentStory.videoUrl || null)
    : null;
  const hasMedia = !!(mediaUrl || currentStory?.type === 'IMAGE' || currentStory?.type === 'VIDEO');
  const resolvedMediaUrl = resolveMediaUrl(mediaUrl);

  const startProgress = () => {
    progress.setValue(0);
    progressAnim.current = Animated.timing(progress, {
      toValue: 1,
      duration: STORY_DURATION,
      useNativeDriver: false,
    });
    progressAnim.current.start(({ finished }) => {
      if (finished) nextStory();
    });
  };

  const nextStory = () => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(i => i + 1);
    } else {
      onClose();
    }
  };

  const prevStory = () => {
    if (currentIndex > 0) {
      setCurrentIndex(i => i - 1);
    } else {
      progress.setValue(0);
      startProgress();
    }
  };

  const toggleLike = async () => {
    const next = !isLiked;
    setIsLiked(next);
    setLikesCount(c => next ? c + 1 : Math.max(0, c - 1));

    // Heart bounce animation
    Animated.sequence([
      Animated.spring(likeAnimScale, { toValue: 1.4, useNativeDriver: true, speed: 30 }),
      Animated.spring(likeAnimScale, { toValue: 1, useNativeDriver: true, speed: 20 }),
    ]).start();

    try {
      if (next) await storiesApi.like(currentStory.id);
      else await storiesApi.unlike(currentStory.id);
    } catch {
      setIsLiked(!next);
      setLikesCount(c => next ? Math.max(0, c - 1) : c + 1);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete Story', 'Are you sure you want to delete this story?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await storiesApi.delete(currentStory.id);
            onClose();
          } catch {
            Alert.alert('Error', 'Failed to delete story. Please try again.');
          }
        },
      },
    ]);
  };

  if (!visible || !currentStory) return null;

  const initials = currentStory.authorName?.[0]?.toUpperCase() || '?';
  const avatarUrl = resolveMediaUrl(currentStory.authorAvatarUrl);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <StatusBar hidden />
      <View style={styles.container}>

        {/* Background: image/video or text gradient */}
        {(hasMedia && resolvedMediaUrl) ? (
          <Image
            source={{ uri: resolvedMediaUrl }}
            style={styles.backgroundMedia}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.textStoryBg}>
            <LinearGradient
              colors={['#0D0D0D', '#1A1A1A']}
              style={StyleSheet.absoluteFill}
            />
            <Text style={styles.textStoryContent}>{currentStory.content}</Text>
          </View>
        )}

        {/* Gradient overlays */}
        <LinearGradient
          colors={['rgba(0,0,0,0.7)', 'rgba(0,0,0,0.1)', 'transparent']}
          style={[styles.topGradient, { pointerEvents: 'none' }]}
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.85)']}
          style={[styles.bottomGradient, { pointerEvents: 'none' }]}
        />

        <SafeAreaView style={styles.content} edges={['top', 'bottom']}>
          {/* Progress bars */}
          <View style={styles.progressContainer}>
            {stories.map((item, index) => (
              <View key={item.id || index} style={styles.progressTrack}>
                <Animated.View
                  style={[
                    styles.progressBar,
                    {
                      width: index < currentIndex
                        ? '100%'
                        : index === currentIndex
                        ? progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })
                        : '0%',
                    },
                  ]}
                />
              </View>
            ))}
          </View>

          {/* Header: user info */}
          <View style={styles.userRow}>
            <View style={styles.userInfo}>
              <View style={styles.avatarWrap}>
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarText}>{initials}</Text>
                )}
              </View>
              <View>
                <Text style={styles.username}>{currentStory.authorName}</Text>
                <Text style={styles.timestamp}>
                  {paused ? '⏸ Paused' : 'Tap & hold to pause'}
                </Text>
              </View>
            </View>
            <View style={styles.headerRight}>
              {isOwner && (
                <View style={styles.viewsBadge}>
                  <Feather name="eye" size={13} color={LIME} />
                  <Text style={styles.viewsText}>{viewsCount}</Text>
                </View>
              )}
              {isOwner && onAddStory && (
                <TouchableOpacity onPress={onAddStory} style={styles.addStoryBtn} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                  <Feather name="plus" size={16} color="#050505" />
                </TouchableOpacity>
              )}
              {isOwner && (
                <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                  <Feather name="trash-2" size={18} color="#FF3C50" />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                <Feather name="x" size={22} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Tap zones: prev/next with hold-to-pause */}
          <View style={styles.gestureLayer}>
            <TouchableOpacity
              style={styles.tapLeft}
              onPress={prevStory}
              onLongPress={() => setPaused(true)}
              onPressOut={() => setPaused(false)}
              activeOpacity={1}
              delayLongPress={200}
            />
            <TouchableOpacity
              style={styles.tapRight}
              onPress={nextStory}
              onLongPress={() => setPaused(true)}
              onPressOut={() => setPaused(false)}
              activeOpacity={1}
              delayLongPress={200}
            />
          </View>

          {/* Paused indicator */}
          {paused && (
            <View pointerEvents="none" style={styles.pausedIndicator}>
              <View style={styles.pausedBadge}>
                <Feather name="pause" size={18} color={LIME} />
                <Text style={styles.pausedText}>PAUSED</Text>
              </View>
            </View>
          )}

          {/* Footer */}
          <View style={styles.footer}>
            {showReply ? (
              <View style={styles.replyInputRow}>
                <TextInput
                  style={styles.replyInput}
                  placeholder="Send a reply..."
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  value={replyText}
                  onChangeText={setReplyText}
                  autoFocus
                  onBlur={() => setShowReply(false)}
                />
                <TouchableOpacity
                  style={[styles.replySendBtn, !replyText.trim() && { opacity: 0.4 }]}
                  disabled={!replyText.trim()}
                  onPress={() => { setReplyText(''); setShowReply(false); }}
                >
                  <Feather name="send" size={14} color="#050505" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.replyBox} onPress={() => setShowReply(true)} activeOpacity={0.8}>
                <Feather name="message-circle" size={16} color="rgba(255,255,255,0.5)" />
                <Text style={styles.replyPlaceholder}>Send message...</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.likeBtn}
              onPress={toggleLike}
              activeOpacity={0.8}
            >
              <Animated.View style={{ transform: [{ scale: likeAnimScale }] }}>
                <View style={[styles.likeBtnInner, isLiked && styles.likeBtnActive]}>
                  <Feather name="heart" size={20} color={isLiked ? '#050505' : '#FFF'} />
                </View>
              </Animated.View>
              {likesCount > 0 && (
                <Text style={[styles.likeCount, isLiked && { color: LIME }]}>{likesCount}</Text>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  backgroundMedia: { ...StyleSheet.absoluteFillObject },
  textStoryBg: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textStoryContent: {
    color: '#FFF',
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 38,
    paddingHorizontal: 32,
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 160,
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 200,
  },
  content: { flex: 1 },
  progressContainer: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 14,
    paddingTop: Platform.OS === 'android' ? 36 : 14,
    marginBottom: 14,
  },
  progressTrack: {
    flex: 1,
    height: 2.5,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: LIME,
    borderRadius: 2,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  userInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: LIME,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFF',
  },
  avatarText: { color: '#050505', fontSize: 16, fontWeight: '900' },
  username: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  timestamp: { color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: '600', marginTop: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  viewsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(205,255,0,0.3)',
  },
  viewsText: { color: LIME, fontSize: 12, fontWeight: '900' },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,60,80,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,60,80,0.3)',
  },
  gestureLayer: {
    flex: 1,
    flexDirection: 'row',
  },
  tapLeft: { flex: 1 },
  tapRight: { flex: 2 },
  pausedIndicator: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  pausedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(205,255,0,0.4)',
  },
  pausedText: { color: LIME, fontSize: 12, fontWeight: '900', letterSpacing: 2 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingBottom: Platform.OS === 'android' ? 20 : 12,
    gap: 10,
  },
  replyBox: {
    flex: 1,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 18,
  },
  replyPlaceholder: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 14,
    fontWeight: '500',
  },
  replyInputRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  replyInput: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 18,
    color: '#FFF',
    fontSize: 14,
  },
  replySendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: LIME,
    alignItems: 'center',
    justifyContent: 'center',
  },
  likeBtn: {
    alignItems: 'center',
    gap: 4,
  },
  likeBtnInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  likeBtnActive: {
    backgroundColor: LIME,
    borderColor: LIME,
    boxShadow: `0 0 12px 4px ${LIME}`,
    elevation: 6,
  },
  likeCount: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 11,
    fontWeight: '900',
  },
});
