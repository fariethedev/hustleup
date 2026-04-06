import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ImageBackground,
  Dimensions,
  Modal,
  FlatList,
  Alert,
  Share,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { logoutUser, selectUser, setUser } from '../../src/store/authSlice';
import { authApi, listingsApi, feedApi, usersApi, followsApi, API_URL } from '../../src/api/client';

const resolveMediaUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http') || url.startsWith('blob:') || url.startsWith('data:')) return url;
  const apiUrl = typeof API_URL !== 'undefined' && API_URL ? API_URL : 'http://localhost:8000/api/v1';
  const base = apiUrl.replace('/api/v1', '');
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
};

const { width, height } = Dimensions.get('window');
const LIME = '#CDFF00';
const BG = '#050505';

export default function ProfileScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const storeUser = useSelector(selectUser);
  const [user, setUserState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('posts');
  const [listings, setListings] = useState([]);
  const [posts, setPosts] = useState([]);
  const [followCounts, setFollowCounts] = useState({ followers: 0, following: 0 });
  const [followModal, setFollowModal] = useState(null);
  const [followList, setFollowList] = useState([]);
  const [followListLoading, setFollowListLoading] = useState(false);
  const [uploading, setUploading] = useState(null);

  useEffect(() => { loadProfileData(); }, []);

  const loadProfileData = async () => {
    setLoading(true);
    try {
      const meRes = await authApi.me();
      const userData = meRes.data;
      setUserState(userData);
      const [listRes, feedRes, countsRes] = await Promise.all([
        listingsApi.getMyListings().catch(() => ({ data: [] })),
        feedApi.getPosts().catch(() => ({ data: [] })),
        userData.id ? followsApi.getCounts(userData.id).catch(() => ({ data: { followers: 0, following: 0 } })) : Promise.resolve({ data: { followers: 0, following: 0 } }),
      ]);
      setListings(listRes.data || []);
      const allPosts = feedRes.data || [];
      setPosts(allPosts.filter(p => p.authorId === userData.id?.toString() || p.authorId === userData.id));
      setFollowCounts(countsRes.data || { followers: 0, following: 0 });
    } catch (e) {
      if (storeUser) setUserState(storeUser);
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async (type) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted' && status !== 'limited') {
      Alert.alert('Permission needed', 'Allow photo library access to change your photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      aspect: type === 'avatar' ? [1, 1] : [16, 9],
      quality: 0.85,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setUploading(type);
    try {
      const filename = asset.uri.split('/').pop();
      const ext = filename.split('.').pop().toLowerCase();
      const formData = new FormData();
      formData.append('file', { uri: asset.uri, name: filename, type: `image/${ext}` });
      const res = type === 'avatar'
        ? await usersApi.uploadAvatar(formData)
        : await usersApi.uploadBanner(formData);
      const updated = res.data;
      setUserState(prev => ({ ...prev, ...updated }));
      dispatch(setUser({ ...storeUser, ...updated }));
    } catch (e) {
      Alert.alert('Upload failed', 'Could not update photo. Try again.');
    } finally {
      setUploading(null);
    }
  };

  const openFollowModal = async (type) => {
    setFollowModal(type);
    setFollowListLoading(true);
    try {
      const res = type === 'followers'
        ? await followsApi.getFollowers()
        : await followsApi.getFollowing();
      setFollowList(res.data || []);
    } catch (e) {
      setFollowList([]);
    } finally {
      setFollowListLoading(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: async () => {
        await dispatch(logoutUser());
        router.replace('/login');
      }},
    ]);
  };

  const getUserHandle = () => {
    if (user?.username) return `@${user.username}`;
    return `@${user?.email?.split('@')[0] || 'user'}`;
  };

  const toggleLike = (postId) => {
    setPosts(prev => prev.map(p => {
      if (p.id === postId) {
        const isLiked = !p.isLiked;
        return { ...p, isLiked, likesCount: (p.likesCount || 0) + (isLiked ? 1 : -1) };
      }
      return p;
    }));
  };

  const handleShare = async (title, message) => {
    try {
      await Share.share({ title, message, url: 'https://hustleup.app/profile/' + user?.id });
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color={LIME} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />

      {/* Floating Header Actions */}
      <View style={styles.stickyHeader}>
        <TouchableOpacity style={styles.headerActionBtn} onPress={() => router.push('/profile/settings')}>
          <Feather name="settings" size={20} color="#FFF" />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.headerActionBtn, styles.logoutBtn]} onPress={handleLogout}>
          <Feather name="log-out" size={20} color="#FF4B4B" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Hero / Banner */}
        <View style={styles.heroContainer}>
          <TouchableOpacity activeOpacity={0.85} onPress={() => pickImage('banner')} style={styles.heroBannerTouch}>
            <ImageBackground
              source={{ uri: resolveMediaUrl(user?.shopBannerUrl) || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=80' }}
              style={styles.heroBanner}
            >
              <LinearGradient colors={['rgba(5,5,5,0.1)', BG]} style={StyleSheet.absoluteFillObject} />
              <View style={styles.bannerEditBadge}>
                {uploading === 'banner'
                  ? <ActivityIndicator size="small" color="#FFF" />
                  : <Feather name="camera" size={14} color="#FFF" />}
              </View>
            </ImageBackground>
          </TouchableOpacity>

          <View style={styles.profileMeta}>
            <TouchableOpacity onPress={() => pickImage('avatar')} activeOpacity={0.85} style={styles.avatarWrapper}>
              <View style={styles.avatarBorder}>
                <Image
                  source={{ uri: resolveMediaUrl(user?.avatarUrl) || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.fullName || 'U')}&background=CDFF00&color=050505&size=200` }}
                  style={styles.avatarImage}
                />
                {uploading === 'avatar' && (
                  <View style={styles.avatarUploadOverlay}>
                    <ActivityIndicator size="small" color={LIME} />
                  </View>
                )}
              </View>
              <View style={styles.avatarCamBadge}>
                <Feather name="camera" size={11} color="#FFF" />
              </View>
              {user?.idVerified && (
                <View style={styles.verifiedBadge}>
                  <MaterialCommunityIcons name="check-decagram" size={20} color={LIME} />
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.identity}>
              <View style={styles.roleTag}>
                <Text style={styles.roleTagText}>{user?.role || 'Hustler'}</Text>
              </View>
              <Text style={styles.fullName}>{user?.fullName || 'Anonymous User'}</Text>
              <Text style={styles.username}>{getUserHandle()}</Text>
              {(user?.city || user?.country) && (
                <View style={styles.locationRow}>
                  <Feather name="map-pin" size={12} color="rgba(255,255,255,0.4)" />
                  <Text style={styles.locationText}>
                    {[user.city, user.country].filter(Boolean).join(', ')}
                  </Text>
                </View>
              )}
              {user?.website && (
                <View style={styles.locationRow}>
                  <Feather name="link" size={12} color="rgba(255,255,255,0.4)" />
                  <Text style={styles.locationText} numberOfLines={1}>{user.website}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Bio + Actions */}
        <View style={styles.bioSection}>
          <Text style={styles.bioText}>{user?.bio || 'No bio yet. Start your hustle story.'}</Text>
          <View style={styles.editRow}>
            <TouchableOpacity style={styles.primaryEditBtn} onPress={() => router.push('/profile/edit')}>
              <Feather name="edit-3" size={14} color="#050505" />
              <Text style={styles.primaryEditBtnText}>Edit Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => handleShare('HustleUp Profile', `Check out ${user?.fullName || 'this user'}'s profile on HustleUp!`)}>
              <Feather name="share-2" size={16} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.push('/profile/settings')}>
              <Feather name="more-horizontal" size={16} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Followers / Following counts */}
        <View style={styles.followRow}>
          <TouchableOpacity style={styles.followPill} onPress={() => openFollowModal('followers')}>
            <Text style={styles.followCount}>{followCounts.followers}</Text>
            <Text style={styles.followLabel}>Followers</Text>
          </TouchableOpacity>
          <View style={styles.followDivider} />
          <TouchableOpacity style={styles.followPill} onPress={() => openFollowModal('following')}>
            <Text style={styles.followCount}>{followCounts.following}</Text>
            <Text style={styles.followLabel}>Following</Text>
          </TouchableOpacity>
          <View style={styles.followDivider} />
          <TouchableOpacity style={styles.followPill} onPress={() => setActiveTab('inventory')}>
            <Text style={styles.followCount}>{listings.length}</Text>
            <Text style={styles.followLabel}>Listings</Text>
          </TouchableOpacity>
          <View style={styles.followDivider} />
          <TouchableOpacity style={styles.followPill} onPress={() => router.push('/profile/placeholder?title=Vouches&icon=shield')}>
            <Text style={styles.followCount}>{user?.vouchCount || 0}</Text>
            <Text style={styles.followLabel}>Vouches</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          {[
            { icon: 'shopping-bag', label: 'My Shop', onPress: () => user?.id && router.push(`/shop/${user.id}`) },
            { icon: 'package', label: 'Orders', onPress: () => router.push('/profile/orders') },
            { icon: 'credit-card', label: 'Wallet', onPress: () => router.push('/profile/wallet') },
            { icon: 'bar-chart-2', label: 'Insights', onPress: () => router.push('/profile/insights') },
          ].map((action, i) => (
            <TouchableOpacity key={i} style={styles.quickActionItem} onPress={action.onPress} activeOpacity={0.7}>
              <View style={styles.quickActionIcon}>
                <Feather name={action.icon} size={18} color={LIME} />
              </View>
              <Text style={styles.quickActionLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Content Tabs */}
        <View style={styles.contentTabs}>
          {['posts', 'inventory', 'reviews'].map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.tabBtn, activeTab === tab && styles.activeTabBtn]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabBtnText, activeTab === tab && styles.activeTabBtnText]}>
                {tab === 'posts' ? 'Posts' : tab === 'inventory' ? 'My Hustle' : 'Reviews'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab Content */}
        <View style={styles.tabContentArea}>

          {/* ── Posts ── */}
          {activeTab === 'posts' && (
            <View style={styles.listContainer}>
              {posts.length > 0 ? posts.map(item => (
                <View key={item.id} style={styles.postCard}>
                  {item.media?.length > 0 && (
                    <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={styles.postMediaScroll}>
                      {item.media.map((m, idx) => (
                        <Image key={idx} source={{ uri: resolveMediaUrl(m.url) }} style={styles.postMediaImage} resizeMode="cover" />
                      ))}
                    </ScrollView>
                  )}
                  {item.media?.length > 1 && (
                    <View style={styles.mediaDotRow}>
                      {item.media.map((_, i) => <View key={i} style={styles.mediaDot} />)}
                    </View>
                  )}
                  <Text style={styles.postContent}>{item.content}</Text>
                  <View style={styles.postFooter}>
                    <Text style={styles.postDate}>{new Date(item.createdAt).toDateString()}</Text>
                    <View style={{ flexDirection: 'row', gap: 16 }}>
                      <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }} onPress={() => toggleLike(item.id)}>
                        <Feather name="heart" size={15} color={item.isLiked ? '#FF4B4B' : "rgba(255,255,255,0.4)"} />
                        <Text style={[styles.postStat, item.isLiked && { color: '#FF4B4B' }]}>{item.likesCount || 0}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }} onPress={() => router.push({ pathname: '/(tabs)/messages', params: { partnerId: item.authorId || item.userId } })}>
                        <Feather name="message-circle" size={15} color="rgba(255,255,255,0.4)" />
                        <Text style={styles.postStat}>{item.commentsCount || 0}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleShare('Check this out', item.content)}>
                        <Feather name="share-2" size={15} color="rgba(255,255,255,0.4)" />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => Alert.alert('Post Options', 'Manage this post', [
                        { text: 'Delete', style: 'destructive', onPress: () => setPosts(prev => prev.filter(p => p.id !== item.id)) },
                        { text: 'Cancel', style: 'cancel' },
                      ])}>
                        <Feather name="more-horizontal" size={15} color="rgba(255,255,255,0.4)" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )) : (
                <View style={styles.emptyState}>
                  <Feather name="message-square" size={40} color="rgba(255,255,255,0.05)" />
                  <Text style={styles.emptyStateText}>NO POSTS YET</Text>
                  <Text style={styles.emptyStateHint}>Share your first hustle on the home feed</Text>
                </View>
              )}
            </View>
          )}

          {/* ── My Hustle (Inventory) ── */}
          {activeTab === 'inventory' && (
            <View>
              {/* Add Listing button */}
              <TouchableOpacity
                style={styles.addListingBtn}
                onPress={() => router.push('/profile/listings')}
              >
                <Feather name="plus" size={18} color={BG} />
                <Text style={styles.addListingBtnText}>New Listing</Text>
              </TouchableOpacity>

              {listings.length > 0 ? (
                <View style={styles.listingCards}>
                  {listings.map(item => {
                    const imgUrl = resolveMediaUrl(
                      Array.isArray(item.mediaUrls) ? item.mediaUrls[0]
                      : typeof item.mediaUrls === 'string' ? item.mediaUrls.split(',')[0]
                      : null
                    );
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={styles.listingCard}
                        onPress={() => router.push(`/profile/listings?id=${item.id}`)}
                        activeOpacity={0.8}
                      >
                        <Image
                          source={{ uri: imgUrl || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400' }}
                          style={styles.listingCardImage}
                        />
                        <LinearGradient
                          colors={['transparent', 'rgba(5,5,5,0.92)']}
                          style={styles.listingCardGradient}
                        />
                        <View style={styles.listingCardInfo}>
                          <Text style={styles.listingCardTitle} numberOfLines={2}>{item.title}</Text>
                          <Text style={styles.listingCardPrice}>PLN {item.price}</Text>
                        </View>
                        <View style={[styles.listingStatusBadge,
                          item.status === 'ACTIVE' ? styles.statusActive : styles.statusInactive]}>
                          <Text style={styles.listingStatusText}>
                            {item.status || 'ACTIVE'}
                          </Text>
                        </View>
                        {Array.isArray(item.mediaUrls) && item.mediaUrls.length > 1 && (
                          <View style={styles.mediaCountBadge}>
                            <MaterialCommunityIcons name="layers-outline" size={11} color="#FFF" />
                            <Text style={styles.mediaCountText}>{item.mediaUrls.length}</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <Feather name="shopping-bag" size={40} color="rgba(255,255,255,0.05)" />
                  <Text style={styles.emptyStateText}>NO LISTINGS YET</Text>
                  <Text style={styles.emptyStateHint}>Create your first listing to start selling</Text>
                </View>
              )}
            </View>
          )}

          {/* ── Reviews ── */}
          {activeTab === 'reviews' && (
            <View style={styles.emptyState}>
              <Feather name="star" size={40} color="rgba(255,255,255,0.05)" />
              <Text style={styles.emptyStateText}>NO REVIEWS YET</Text>
              <Text style={styles.emptyStateHint}>Reviews from buyers will appear here</Text>
            </View>
          )}

        </View>
      </ScrollView>

      {/* Followers / Following Modal */}
      <Modal visible={followModal !== null} transparent animationType="slide" onRequestClose={() => setFollowModal(null)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalDismiss} onPress={() => setFollowModal(null)} />
          <View style={styles.followModalSheet}>
            <View style={styles.followModalHandle} />
            <View style={styles.followModalHeader}>
              <Text style={styles.followModalTitle}>
                {followModal === 'followers' ? 'Followers' : 'Following'}
              </Text>
              <TouchableOpacity onPress={() => setFollowModal(null)}>
                <Feather name="x" size={20} color="rgba(255,255,255,0.5)" />
              </TouchableOpacity>
            </View>
            {followListLoading ? (
              <ActivityIndicator color={LIME} style={{ marginTop: 40 }} />
            ) : followList.length === 0 ? (
              <View style={styles.emptyState}>
                <Feather name="users" size={36} color="rgba(255,255,255,0.06)" />
                <Text style={styles.emptyStateText}>
                  {followModal === 'followers' ? 'NO FOLLOWERS YET' : 'NOT FOLLOWING ANYONE'}
                </Text>
              </View>
            ) : (
              <FlatList
                data={followList}
                keyExtractor={(it) => it.id?.toString()}
                contentContainerStyle={{ paddingBottom: 40 }}
                renderItem={({ item: fu }) => (
                  <TouchableOpacity
                    style={styles.followUserRow}
                    onPress={() => { setFollowModal(null); router.push(`/profile/${fu.id}`); }}
                  >
                    <View style={styles.followUserAvatar}>
                      {fu.avatarUrl
                        ? <Image source={{ uri: resolveMediaUrl(fu.avatarUrl) }} style={{ width: '100%', height: '100%' }} />
                        : <Text style={styles.followUserAvatarText}>{(fu.fullName || '?')[0].toUpperCase()}</Text>}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.followUserName}>{fu.fullName}</Text>
                      <Text style={styles.followUserHandle}>@{fu.username || fu.email?.split('@')[0]}</Text>
                    </View>
                    <View style={[styles.followRoleBadge, fu.role === 'SELLER' && styles.followRoleBadgeSeller]}>
                      <Text style={[styles.followRoleBadgeText, fu.role === 'SELLER' && { color: '#60A5FA' }]}>
                        {fu.role || 'BUYER'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  loadingScreen: { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingBottom: 120 },

  stickyHeader: {
    position: 'absolute', top: 60, right: 20, zIndex: 100,
    flexDirection: 'row', gap: 12,
  },
  headerActionBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  logoutBtn: { borderColor: 'rgba(255,75,75,0.2)', backgroundColor: 'rgba(255,75,75,0.05)' },

  heroContainer: { height: 360, width: '100%', position: 'relative' },
  heroBannerTouch: { height: 240, width: '100%' },
  heroBanner: { height: 240, width: '100%', justifyContent: 'flex-end', alignItems: 'flex-end' },
  bannerEditBadge: {
    margin: 12, width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center', alignItems: 'center',
  },
  profileMeta: {
    position: 'absolute', bottom: 0, left: 24, right: 24,
    flexDirection: 'row', alignItems: 'flex-end', gap: 18,
  },
  avatarWrapper: { position: 'relative' },
  avatarBorder: {
    width: 110, height: 110, borderRadius: 55,
    borderWidth: 4, borderColor: BG,
    backgroundColor: '#111', overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarUploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarCamBadge: {
    position: 'absolute', bottom: 4, right: 4,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: LIME,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: BG,
  },
  verifiedBadge: {
    position: 'absolute', top: 0, right: 4,
    backgroundColor: BG, borderRadius: 12, padding: 2,
  },
  identity: { paddingBottom: 8, flex: 1 },
  roleTag: {
    backgroundColor: LIME, paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 4, alignSelf: 'flex-start', marginBottom: 5,
  },
  roleTagText: { color: '#050505', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  fullName: { color: '#FFF', fontSize: 22, fontWeight: '900', letterSpacing: -0.3 },
  username: { color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: '700', marginTop: 2 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  locationText: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '600', flex: 1 },

  bioSection: { paddingHorizontal: 24, marginTop: 14 },
  bioText: { color: 'rgba(255,255,255,0.7)', fontSize: 14, lineHeight: 21, fontWeight: '500' },
  editRow: { flexDirection: 'row', marginTop: 16, gap: 12 },
  primaryEditBtn: {
    flex: 1, backgroundColor: LIME,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 13, borderRadius: 14, gap: 8,
  },
  primaryEditBtnText: { color: '#050505', fontWeight: '900', fontSize: 13 },
  secondaryBtn: {
    width: 46, height: 46, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },

  followRow: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 24, marginTop: 24,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 18, paddingVertical: 18,
  },
  followPill: { flex: 1, alignItems: 'center' },
  followCount: { color: '#FFF', fontSize: 20, fontWeight: '900' },
  followLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', marginTop: 2, letterSpacing: 0.5 },
  followDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.07)' },

  contentTabs: { flexDirection: 'row', marginTop: 24, paddingHorizontal: 24, gap: 8 },

  quickActions: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginHorizontal: 24, marginTop: 24,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 18, paddingVertical: 16, paddingHorizontal: 12,
  },
  quickActionItem: { alignItems: 'center', flex: 1, gap: 8 },
  quickActionIcon: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: 'rgba(205,255,0,0.08)',
    borderWidth: 1, borderColor: 'rgba(205,255,0,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  quickActionLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '700' },
  tabBtn: { paddingHorizontal: 20, paddingVertical: 9, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.03)' },
  activeTabBtn: { backgroundColor: LIME },
  tabBtnText: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  activeTabBtnText: { color: '#050505' },

  tabContentArea: { marginTop: 22, paddingHorizontal: 24 },

  // Posts
  listContainer: { gap: 14 },
  postCard: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  postMediaScroll: { height: 200 },
  postMediaImage: { width: width - 48, height: 200 },
  mediaDotRow: { flexDirection: 'row', justifyContent: 'center', gap: 5, paddingVertical: 8 },
  mediaDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)' },
  postContent: { color: '#EEE', fontSize: 14, lineHeight: 20, padding: 16, paddingTop: 12 },
  postFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 14,
  },
  postDate: { color: 'rgba(255,255,255,0.25)', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  postStat: { color: 'rgba(255,255,255,0.35)', fontSize: 12, fontWeight: '700' },

  // My Hustle
  addListingBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: LIME, borderRadius: 14,
    paddingVertical: 13, gap: 8, marginBottom: 18,
  },
  addListingBtnText: { color: BG, fontWeight: '900', fontSize: 13 },
  listingCards: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  listingCard: {
    width: (width - 60) / 2,
    height: 200, borderRadius: 16,
    overflow: 'hidden', backgroundColor: '#111',
    position: 'relative',
  },
  listingCardImage: { width: '100%', height: '100%' },
  listingCardGradient: { ...StyleSheet.absoluteFillObject },
  listingCardInfo: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 12,
  },
  listingCardTitle: { color: '#FFF', fontSize: 13, fontWeight: '800', lineHeight: 17, marginBottom: 4 },
  listingCardPrice: { color: LIME, fontSize: 16, fontWeight: '900' },
  listingStatusBadge: {
    position: 'absolute', top: 10, right: 10,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  statusActive: { backgroundColor: 'rgba(205,255,0,0.2)', borderWidth: 1, borderColor: 'rgba(205,255,0,0.4)' },
  statusInactive: { backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  listingStatusText: { color: '#FFF', fontSize: 8, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  mediaCountBadge: {
    position: 'absolute', top: 10, left: 10,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6,
  },
  mediaCountText: { color: '#FFF', fontSize: 10, fontWeight: '800' },

  emptyState: { paddingVertical: 60, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyStateText: { color: 'rgba(255,255,255,0.15)', fontSize: 11, fontWeight: '900', letterSpacing: 2 },
  emptyStateHint: { color: 'rgba(255,255,255,0.2)', fontSize: 12, textAlign: 'center' },

  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalDismiss: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  followModalSheet: {
    backgroundColor: '#0F0F0F',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    maxHeight: height * 0.72,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    borderBottomWidth: 0,
  },
  followModalHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center', marginTop: 14,
  },
  followModalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24, paddingVertical: 18,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  followModalTitle: { color: '#FFF', fontSize: 17, fontWeight: '900' },
  followUserRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 24, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  followUserAvatar: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: 'rgba(205,255,0,0.1)',
    borderWidth: 1, borderColor: 'rgba(205,255,0,0.2)',
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  followUserAvatarText: { color: LIME, fontSize: 18, fontWeight: '900' },
  followUserName: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  followUserHandle: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 1 },
  followRoleBadge: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 10, backgroundColor: 'rgba(205,255,0,0.1)',
    borderWidth: 1, borderColor: 'rgba(205,255,0,0.2)',
  },
  followRoleBadgeSeller: {
    backgroundColor: 'rgba(96,165,250,0.1)',
    borderColor: 'rgba(96,165,250,0.2)',
  },
  followRoleBadgeText: { color: LIME, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
});

