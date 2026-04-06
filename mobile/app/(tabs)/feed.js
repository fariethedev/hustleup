import React, { useState, useEffect, useCallback } from 'react';
import {
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { feedApi } from '../../src/api/client';

const LIME = '#CDFF00';
const BG = '#050505';
const CARD = 'rgba(255,255,255,0.04)';

function PostCard({ post, onLike }) {
  const [liked, setLiked] = useState(post.likedByCurrentUser || false);
  const [likeCount, setLikeCount] = useState(post.likesCount || 0);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsCount, setCommentsCount] = useState(post.commentsCount || 0);
  const [comment, setComment] = useState('');
  const [replyTo, setReplyTo] = useState(null); // { id, authorName }

  const initials = post.authorName?.[0]?.toUpperCase() || '?';

  const handleLike = async () => {
    const next = !liked;
    setLiked(next);
    setLikeCount(c => next ? c + 1 : Math.max(0, c - 1));
    try {
      if (next) await feedApi.likePost(post.id);
      else await feedApi.unlikePost(post.id);
    } catch {
      setLiked(!next);
      setLikeCount(c => next ? Math.max(0, c - 1) : c + 1);
    }
  };

  const loadComments = async () => {
    setCommentsLoading(true);
    try {
      const res = await feedApi.getComments(post.id);
      setComments(Array.isArray(res.data) ? res.data : []);
    } catch {
      setComments([]);
    } finally {
      setCommentsLoading(false);
    }
  };

  const toggleComments = () => {
    const next = !showComments;
    setShowComments(next);
    if (next && comments.length === 0) loadComments();
  };

  const handleSubmitComment = async () => {
    if (!comment.trim()) return;
    const text = comment.trim();
    const parentId = replyTo?.id || null;
    setComment('');
    setReplyTo(null);
    try {
      const res = await feedApi.addComment(post.id, text, parentId);
      setComments(prev => [...prev, res.data]);
      setCommentsCount(c => c + 1);
    } catch { /* silent */ }
  };

  // Group comments: top-level first, then replies nested under parent
  const topLevel = comments.filter(c => !c.parentId);
  const getReplies = (id) => comments.filter(c => c.parentId === id);

  return (
    <View style={styles.postCard}>
      {/* Glass border highlight */}
      <LinearGradient
        colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFillObject, { pointerEvents: 'none' }]}
      />

      {/* Author row */}
      <View style={styles.postAuthorRow}>
        <View style={styles.postAvatar}>
          <Text style={styles.postAvatarText}>{initials}</Text>
        </View>
        <View style={styles.postAuthorInfo}>
          <Text style={styles.postAuthorName}>{post.authorName || 'Unknown'}</Text>
          <Text style={styles.postTimestamp}>
            {post.createdAt ? new Date(post.createdAt).toLocaleDateString() : 'Recently'}
          </Text>
        </View>
        <TouchableOpacity style={styles.postMoreBtn}>
          <Feather name="more-horizontal" size={18} color="#555" />
        </TouchableOpacity>
      </View>

      {/* Media */}
      {post.mediaUrl && (
        <View style={styles.postMediaWrap}>
          <Image source={{ uri: post.mediaUrl }} style={styles.postMedia} resizeMode="cover" />
          {post.mediaType === 'VIDEO' && (
            <View style={styles.videoPlayOverlay}>
              <View style={styles.videoPlayBtn}>
                <Feather name="play" size={28} color={BG} />
              </View>
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.6)']}
                style={[StyleSheet.absoluteFillObject, { pointerEvents: 'none' }]}
              />
            </View>
          )}
        </View>
      )}

      {/* Caption */}
      {post.content && (
        <Text style={styles.postCaption} numberOfLines={3}>
          {post.content}
        </Text>
      )}

      {/* Actions */}
      <View style={styles.postActions}>
        <TouchableOpacity style={styles.postAction} onPress={handleLike} activeOpacity={0.7}>
          <View style={[styles.actionIconWrap, liked && styles.actionIconWrapLiked]}>
            <Feather name="heart" size={16} color={liked ? BG : '#AAA'} />
          </View>
          <Text style={[styles.actionCount, liked && { color: LIME }]}>{likeCount}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.postAction} onPress={toggleComments} activeOpacity={0.7}>
          <View style={styles.actionIconWrap}>
            <Feather name="message-circle" size={16} color={showComments ? LIME : '#AAA'} />
          </View>
          <Text style={[styles.actionCount, showComments && { color: LIME }]}>{commentsCount}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.postAction} activeOpacity={0.7}>
          <View style={styles.actionIconWrap}>
            <Feather name="share-2" size={16} color="#AAA" />
          </View>
        </TouchableOpacity>

        <View style={{ flex: 1 }} />

        <TouchableOpacity style={styles.postAction} activeOpacity={0.7}>
          <View style={styles.actionIconWrap}>
            <Feather name="bookmark" size={16} color="#AAA" />
          </View>
        </TouchableOpacity>
      </View>

      {/* Comments section */}
      {showComments && (
        <View style={styles.commentsSection}>
          {commentsLoading ? (
            <ActivityIndicator color={LIME} size="small" style={{ marginVertical: 12 }} />
          ) : (
            <>
              {topLevel.length === 0 && (
                <Text style={styles.noCommentsText}>No comments yet. Be first!</Text>
              )}
              {topLevel.map(c => (
                <View key={c.id}>
                  <View style={styles.commentRow}>
                    <View style={styles.commentAvatar}>
                      <Text style={styles.commentAvatarText}>{c.authorName?.[0]?.toUpperCase() || '?'}</Text>
                    </View>
                    <View style={styles.commentBody}>
                      <Text style={styles.commentAuthor}>{c.authorName}</Text>
                      <Text style={styles.commentText}>{c.content}</Text>
                    </View>
                    <TouchableOpacity onPress={() => setReplyTo({ id: c.id, authorName: c.authorName })} style={styles.replyBtn}>
                      <Feather name="corner-down-right" size={13} color="#555" />
                    </TouchableOpacity>
                  </View>
                  {getReplies(c.id).map(r => (
                    <View key={r.id} style={[styles.commentRow, styles.replyRow]}>
                      <View style={[styles.commentAvatar, styles.replyAvatar]}>
                        <Text style={styles.commentAvatarText}>{r.authorName?.[0]?.toUpperCase() || '?'}</Text>
                      </View>
                      <View style={styles.commentBody}>
                        <Text style={styles.commentAuthor}>{r.authorName}</Text>
                        <Text style={styles.commentText}>{r.content}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              ))}
            </>
          )}

          {replyTo && (
            <View style={styles.replyingToRow}>
              <Feather name="corner-down-right" size={12} color={LIME} />
              <Text style={styles.replyingToText}>Replying to {replyTo.authorName}</Text>
              <TouchableOpacity onPress={() => setReplyTo(null)}>
                <Feather name="x" size={14} color="#888" />
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.commentInputRow}>
            <TextInput
              style={styles.commentInput}
              placeholder={replyTo ? `Reply to ${replyTo.authorName}...` : 'Add a comment...'}
              placeholderTextColor="#444"
              value={comment}
              onChangeText={setComment}
            />
            <TouchableOpacity
              style={[styles.commentSendBtn, !comment.trim() && { opacity: 0.3 }]}
              disabled={!comment.trim()}
              onPress={handleSubmitComment}
            >
              <Feather name="send" size={14} color={BG} />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

function SkeletonPost() {
  return (
    <View style={[styles.postCard, { gap: 12 }]}>
      <View style={styles.postAuthorRow}>
        <View style={[styles.postAvatar, styles.skeleton]} />
        <View style={{ flex: 1, gap: 6 }}>
          <View style={[styles.skeleton, { height: 12, width: '50%', borderRadius: 6 }]} />
          <View style={[styles.skeleton, { height: 10, width: '30%', borderRadius: 6 }]} />
        </View>
      </View>
      <View style={[styles.skeleton, { height: 220, borderRadius: 20 }]} />
      <View style={[styles.skeleton, { height: 12, width: '80%', borderRadius: 6 }]} />
    </View>
  );
}

export default function FeedScreen() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadPosts = useCallback(async () => {
    try {
      const res = await feedApi.getPosts();
      setPosts(Array.isArray(res.data) ? res.data : []);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  const onRefresh = () => { setRefreshing(true); loadPosts(); };

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.topBar}>
          <View style={styles.topBarLeft}>
            <View style={styles.logoBadge}>
              <Text style={styles.logoText}>H</Text>
            </View>
            <View>
              <Text style={styles.screenTitle}>Feed</Text>
              <Text style={styles.screenSub}>Community stories</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.iconBtn}>
            <Feather name="bell" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {loading ? (
        <FlatList
          data={[1, 2, 3]}
          renderItem={() => <SkeletonPost />}
          keyExtractor={i => String(i)}
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <FlatList
          data={posts}
          renderItem={({ item }) => <PostCard post={item} />}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={LIME} />}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <Feather name="image" size={32} color={LIME} />
              </View>
              <Text style={styles.emptyTitle}>No posts yet</Text>
              <Text style={styles.emptySub}>Follow creators to see their posts here</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  safe: { backgroundColor: BG },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  topBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: LIME,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { color: BG, fontWeight: '900', fontSize: 18 },
  screenTitle: { color: '#FFF', fontSize: 20, fontWeight: '900' },
  screenSub: { color: '#555', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  listContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32, gap: 16 },
  postCard: {
    backgroundColor: CARD,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    padding: 16,
    gap: 14,
  },
  postAuthorRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  postAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(205,255,0,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(205,255,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  postAvatarText: { color: LIME, fontSize: 18, fontWeight: '900' },
  postAuthorInfo: { flex: 1 },
  postAuthorName: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  postTimestamp: { color: '#555', fontSize: 11, fontWeight: '600', marginTop: 2 },
  postMoreBtn: { padding: 4 },
  postMediaWrap: { borderRadius: 18, overflow: 'hidden', aspectRatio: 1.2 },
  postMedia: { width: '100%', height: '100%' },
  videoPlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPlayBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: LIME,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: `0 0 20px 0 ${LIME}80`,
    elevation: 8,
  },
  postCaption: { color: 'rgba(255,255,255,0.85)', fontSize: 14, lineHeight: 22 },
  postActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  postAction: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingHorizontal: 4 },
  actionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconWrapLiked: { backgroundColor: LIME },
  actionCount: { color: '#888', fontSize: 12, fontWeight: '800' },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  commentInput: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14,
    color: '#FFF',
    fontSize: 13,
  },
  commentSendBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: LIME,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: { paddingTop: 80, alignItems: 'center', gap: 14 },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: 'rgba(205,255,0,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(205,255,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { color: '#FFF', fontSize: 18, fontWeight: '900' },
  emptySub: { color: '#555', fontSize: 13, fontWeight: '600', textAlign: 'center', paddingHorizontal: 40 },
  skeleton: { backgroundColor: 'rgba(255,255,255,0.06)' },
  commentsSection: { gap: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  noCommentsText: { color: '#444', fontSize: 12, textAlign: 'center', paddingVertical: 8 },
  commentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  replyRow: { marginLeft: 32, marginTop: 4 },
  commentAvatar: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: 'rgba(205,255,0,0.12)',
    borderWidth: 1, borderColor: 'rgba(205,255,0,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  replyAvatar: { width: 22, height: 22, borderRadius: 6 },
  commentAvatarText: { color: LIME, fontSize: 11, fontWeight: '900' },
  commentBody: { flex: 1 },
  commentAuthor: { color: '#FFF', fontSize: 12, fontWeight: '800', marginBottom: 2 },
  commentText: { color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 18 },
  replyBtn: { paddingHorizontal: 6, paddingVertical: 4 },
  replyingToRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(205,255,0,0.06)',
    borderWidth: 1, borderColor: 'rgba(205,255,0,0.12)',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
  },
  replyingToText: { flex: 1, color: LIME, fontSize: 12, fontWeight: '700' },
});
