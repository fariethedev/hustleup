import React, { useState, useEffect } from 'react';
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
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSelector } from 'react-redux';
import { LinearGradient } from 'expo-linear-gradient';
import { usersApi, listingsApi, feedApi, directMessagesApi, followsApi } from '../../src/api/client';
import { selectUser } from '../../src/store/authSlice';

const { width } = Dimensions.get('window');
const LIME = '#CDFF00';
const BG = '#050505';

const TYPE_META = {
  PRODUCT: { label: 'Product',  color: '#60A5FA' },
  SERVICE: { label: 'Service',  color: '#A78BFA' },
  JOB:     { label: 'Job',      color: '#FB923C' },
};

const GlassStat = ({ label, value, icon, color = LIME }) => (
  <View style={styles.glassStatCard}>
    <View style={[styles.statIconContainer, { backgroundColor: color + '15' }]}>
      <Feather name={icon} size={18} color={color} />
    </View>
    <View>
      <Text style={styles.statValueText}>{value}</Text>
      <Text style={styles.statLabelText}>{label}</Text>
    </View>
  </View>
);

// ─── Inventory Card — Grid ────────────────────────────────────────────────────
function GridCard({ item, onPress }) {
  const meta = TYPE_META[item.listingType] || TYPE_META.PRODUCT;
  const thumb = item.mediaUrls?.[0];
  return (
    <TouchableOpacity style={styles.invGridCard} onPress={() => onPress(item)} activeOpacity={0.88}>
      <View style={styles.invGridImgWrap}>
        {thumb ? (
          <Image source={{ uri: thumb }} style={styles.invGridImg} resizeMode="cover" />
        ) : (
          <View style={styles.invGridNoImg}>
            <Feather name="package" size={28} color="rgba(255,255,255,0.12)" />
          </View>
        )}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.75)']}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        {/* Type badge */}
        <View style={[styles.invTypeBadge, { backgroundColor: meta.color + '22', borderColor: meta.color + '55' }]}>
          <Text style={[styles.invTypeBadgeText, { color: meta.color }]}>{meta.label.toUpperCase()}</Text>
        </View>
        {/* Price */}
        <View style={styles.invGridPrice}>
          <Text style={styles.invGridPriceText}>
            {item.currency || '£'}{Number(item.price).toLocaleString()}
          </Text>
          {item.negotiable && <Text style={styles.invNegotiable}>OBO</Text>}
        </View>
      </View>
      <View style={styles.invGridBody}>
        <Text style={styles.invGridTitle} numberOfLines={1}>{item.title}</Text>
        {item.locationCity ? (
          <View style={styles.invGridMeta}>
            <Feather name="map-pin" size={9} color="rgba(255,255,255,0.3)" />
            <Text style={styles.invGridMetaText}>{item.locationCity}</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

// ─── Inventory Card — List ────────────────────────────────────────────────────
function ListCard({ item, onPress }) {
  const meta = TYPE_META[item.listingType] || TYPE_META.PRODUCT;
  const thumb = item.mediaUrls?.[0];
  return (
    <TouchableOpacity style={styles.invListCard} onPress={() => onPress(item)} activeOpacity={0.85}>
      <View style={styles.invListThumbWrap}>
        {thumb ? (
          <Image source={{ uri: thumb }} style={styles.invListThumb} resizeMode="cover" />
        ) : (
          <View style={styles.invListNoThumb}>
            <Feather name="package" size={22} color="rgba(255,255,255,0.15)" />
          </View>
        )}
      </View>
      <View style={styles.invListBody}>
        <View style={styles.invListTop}>
          <View style={[styles.invTypeBadge, { backgroundColor: meta.color + '22', borderColor: meta.color + '55' }]}>
            <Text style={[styles.invTypeBadgeText, { color: meta.color }]}>{meta.label.toUpperCase()}</Text>
          </View>
          <View style={styles.invActiveDot} />
        </View>
        <Text style={styles.invListTitle} numberOfLines={2}>{item.title}</Text>
        <View style={styles.invListPriceRow}>
          <Text style={styles.invListPrice}>
            {item.currency || '£'}{Number(item.price).toLocaleString()}
          </Text>
          {item.negotiable && <Text style={styles.invNegotiable}>OBO</Text>}
        </View>
        {item.locationCity ? (
          <View style={styles.invGridMeta}>
            <Feather name="map-pin" size={9} color="rgba(255,255,255,0.3)" />
            <Text style={styles.invGridMetaText}>{item.locationCity}</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

export default function UserProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const currentUser = useSelector(selectUser);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('inventory');
  const [invView, setInvView] = useState('grid');
  const [listings, setListings] = useState([]);
  const [posts, setPosts] = useState([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  const isOwnProfile = currentUser?.id === id;

  useEffect(() => {
    if (id) loadProfileData();
  }, [id]);

  const loadProfileData = async () => {
    setLoading(true);
    try {
      const profRes = await usersApi.getProfile(id);
      const userData = profRes.data;
      setUser(userData);
      
      const [listRes, feedRes, followRes] = await Promise.allSettled([
        listingsApi.getByUser(userData.id),
        feedApi.getPosts(),
        followsApi.isFollowing(id),
      ]);
      
      setListings(listRes.status === 'fulfilled' ? (listRes.value.data || []) : []);
      setPosts(feedRes.status === 'fulfilled' ? (feedRes.value.data || []).filter(p => p.authorId === userData.id) : []);
      if (followRes.status === 'fulfilled') {
        setIsFollowing(followRes.value.data?.isFollowing ?? false);
      }
    } catch (e) {
      console.error('Profile fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleFollowToggle = async () => {
    if (isOwnProfile || followLoading) return;
    setFollowLoading(true);
    try {
      if (isFollowing) {
        await followsApi.unfollow(id);
        setIsFollowing(false);
      } else {
        await followsApi.follow(id);
        setIsFollowing(true);
      }
    } catch (e) {
      Alert.alert('Error', 'Could not update follow status');
    } finally {
      setFollowLoading(false);
    }
  };

  const handleMessage = () => {
    router.push({
      pathname: '/(tabs)/messages',
      params: {
        partnerId:     user.id,
        partnerName:   user.fullName || user.username || 'User',
        partnerAvatar: user.avatarUrl || '',
      },
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color={LIME} size="large" />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.loadingScreen}>
        <Feather name="user-x" size={40} color="rgba(255,255,255,0.15)" />
        <Text style={{ color: 'rgba(255,255,255,0.3)', marginTop: 14, fontSize: 14, fontWeight: '700' }}>
          Profile not found
        </Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20 }}>
          <Text style={{ color: LIME, fontWeight: '800' }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      
      <View style={styles.stickyHeader}>
        <TouchableOpacity style={styles.headerActionBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color="#FFF" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.heroContainer}>
          <ImageBackground
            source={{ uri: user?.shopBannerUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=80' }}
            style={styles.heroBanner}
          >
            <LinearGradient colors={['rgba(5,5,5,0.2)', BG]} style={StyleSheet.absoluteFillObject} />
          </ImageBackground>

          <View style={styles.profileMeta}>
             <View style={styles.avatarWrapper}>
                <View style={styles.avatarBorder}>
                   <Image 
                     source={{ uri: user?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80' }} 
                     style={styles.avatarImage} 
                   />
                </View>
             </View>
             
             <View style={styles.identity}>
                <View style={styles.roleTag}>
                   <Text style={styles.roleTagText}>{user?.role || 'Hustler'}</Text>
                </View>
                <Text style={styles.fullName}>{user?.fullName || user?.username}</Text>
                <Text style={styles.username}>@{user?.username}</Text>
             </View>
          </View>
        </View>

        <View style={styles.bioSection}>
           <Text style={styles.bioText}>{user?.bio || "No narrative established yet."}</Text>
           
           <View style={styles.actionRow}>
              {!isOwnProfile && (
                <TouchableOpacity 
                  style={[styles.followBtn, isFollowing && styles.followBtnActive]} 
                  onPress={handleFollowToggle}
                  disabled={followLoading}
                >
                  {followLoading ? (
                    <ActivityIndicator color={isFollowing ? '#050505' : '#FFF'} size="small" />
                  ) : (
                    <Text style={[styles.followBtnText, isFollowing && styles.followBtnTextActive]}>
                      {isFollowing ? '✓ Following' : 'Follow'}
                    </Text>
                  )}
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.messageBtn} onPress={handleMessage}>
                 <Feather name="message-circle" size={18} color="#050505" />
                 <Text style={styles.messageBtnText}>Message</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.shopBtn} onPress={() => router.push(`/shop/${id}`)}>
                 <Feather name="shopping-bag" size={16} color={LIME} />
                 <Text style={styles.shopBtnText}>Shop</Text>
              </TouchableOpacity>
           </View>
        </View>

        <View style={styles.statsSection}>
           <View style={styles.statsGrid}>
              <GlassStat label="Drops" value={listings.length} icon="package" />
              <GlassStat label="Rating" value={user?.avgRating?.toFixed(1) || '—'} icon="star" color="#FFD700" />
           </View>
        </View>

        <View style={styles.contentTabs}>
           {['inventory', 'updates', 'reviews'].map(t => (
             <TouchableOpacity 
               key={t} 
               style={[styles.tabBtn, activeTab === t && styles.activeTabBtn]} 
               onPress={() => setActiveTab(t)}
             >
                <Text style={[styles.tabBtnText, activeTab === t && styles.activeTabBtnText]}>{t}</Text>
             </TouchableOpacity>
           ))}
        </View>

        <View style={styles.tabContentArea}>
           {activeTab === 'inventory' && (
             <View>
               {/* Inventory header: count + view toggle */}
               <View style={styles.invHeader}>
                 <Text style={styles.invCount}>
                   {listings.length} {listings.length === 1 ? 'DROP' : 'DROPS'}
                 </Text>
                 <View style={styles.invToggle}>
                   <TouchableOpacity
                     style={[styles.invToggleBtn, invView === 'grid' && styles.invToggleBtnActive]}
                     onPress={() => setInvView('grid')}
                   >
                     <Feather name="grid" size={14} color={invView === 'grid' ? '#050505' : 'rgba(255,255,255,0.4)'} />
                   </TouchableOpacity>
                   <TouchableOpacity
                     style={[styles.invToggleBtn, invView === 'list' && styles.invToggleBtnActive]}
                     onPress={() => setInvView('list')}
                   >
                     <Feather name="list" size={14} color={invView === 'list' ? '#050505' : 'rgba(255,255,255,0.4)'} />
                   </TouchableOpacity>
                 </View>
               </View>

               {listings.length === 0 ? (
                 <View style={styles.invEmpty}>
                   <View style={styles.invEmptyIcon}>
                     <Feather name="package" size={32} color="rgba(255,255,255,0.1)" />
                   </View>
                   <Text style={styles.invEmptyTitle}>No drops yet</Text>
                   <Text style={styles.invEmptyText}>This seller hasn't listed anything</Text>
                 </View>
               ) : invView === 'grid' ? (
                 <View style={styles.invGrid}>
                   {listings.map(item => (
                     <GridCard key={item.id} item={item} onPress={() => {}} />
                   ))}
                 </View>
               ) : (
                 <View style={styles.invList}>
                   {listings.map(item => (
                     <ListCard key={item.id} item={item} onPress={() => {}} />
                   ))}
                 </View>
               )}
             </View>
           )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  loadingScreen: { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingBottom: 120 },
  stickyHeader: { position: 'absolute', top: 60, left: 20, zIndex: 100 },
  headerActionBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  heroContainer: { height: 380, width: '100%', position: 'relative' },
  heroBanner: { height: 260, width: '100%' },
  profileMeta: { position: 'absolute', bottom: 20, left: 24, right: 24, flexDirection: 'row', alignItems: 'flex-end', gap: 18 },
  avatarWrapper: { position: 'relative' },
  avatarBorder: { width: 120, height: 120, borderRadius: 60, borderWidth: 4, borderColor: BG, backgroundColor: '#111', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  identity: { paddingBottom: 10 },
  roleTag: { backgroundColor: LIME, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start', marginBottom: 6 },
  roleTagText: { color: '#050505', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  fullName: { color: '#FFF', fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  username: { color: 'rgba(255,255,255,0.4)', fontSize: 14, fontWeight: '700', marginTop: 2 },
  bioSection: { paddingHorizontal: 24, marginTop: 10 },
  bioText: { color: 'rgba(255,255,255,0.7)', fontSize: 15, lineHeight: 22 },
  actionRow: { flexDirection: 'row', marginTop: 24, gap: 12 },
  followBtn: { flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', paddingVertical: 14, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  followBtnActive: { backgroundColor: LIME, borderColor: LIME },
  followBtnText: { color: '#FFF', fontWeight: '900', fontSize: 13 },
  followBtnTextActive: { color: '#050505' },
  messageBtn: { flex: 1, backgroundColor: LIME, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 14, gap: 8 },
  messageBtnText: { color: '#050505', fontWeight: '900', fontSize: 13 },
  shopBtn: { paddingHorizontal: 18, backgroundColor: 'rgba(205,255,0,0.1)', borderWidth: 1, borderColor: LIME, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 14, gap: 6 },
  shopBtnText: { color: LIME, fontWeight: '900', fontSize: 13 },
  statsSection: { marginTop: 40, paddingHorizontal: 24 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  glassStatCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', padding: 16, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  statIconContainer: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  statValueText: { color: '#FFF', fontSize: 18, fontWeight: '900' },
  statLabelText: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  contentTabs: { flexDirection: 'row', marginTop: 40, paddingHorizontal: 24, gap: 10 },
  tabBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.03)' },
  activeTabBtn: { backgroundColor: LIME },
  tabBtnText: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  activeTabBtnText: { color: '#050505' },
  tabContentArea: { marginTop: 20, paddingHorizontal: 16, paddingBottom: 40 },

  // ── Inventory ──────────────────────────────────────────────────────────────
  invHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 8, marginBottom: 16,
  },
  invCount: { color: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  invToggle: {
    flexDirection: 'row', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10, padding: 3,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  invToggleBtn: {
    width: 30, height: 30, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  invToggleBtnActive: { backgroundColor: LIME },

  // Grid layout
  invGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  invGridCard: {
    width: (width - 52) / 2,
    borderRadius: 18, overflow: 'hidden',
    backgroundColor: '#0F0F0F',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  invGridImgWrap: { width: '100%', aspectRatio: 3 / 4, position: 'relative' },
  invGridImg: { width: '100%', height: '100%' },
  invGridNoImg: {
    width: '100%', height: '100%',
    backgroundColor: '#141414',
    alignItems: 'center', justifyContent: 'center',
  },
  invGridBody: { padding: 12 },
  invGridTitle: { color: '#FFF', fontSize: 13, fontWeight: '800', marginBottom: 5 },
  invGridMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  invGridMetaText: { color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: '600' },
  invGridPrice: {
    position: 'absolute', bottom: 10, left: 10, right: 10,
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  invGridPriceText: { color: '#FFF', fontSize: 15, fontWeight: '900' },

  // List layout
  invList: { gap: 10 },
  invListCard: {
    flexDirection: 'row', gap: 14,
    backgroundColor: '#0F0F0F',
    borderRadius: 18, padding: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  invListThumbWrap: {
    width: 90, height: 90, borderRadius: 14, overflow: 'hidden',
    backgroundColor: '#141414', flexShrink: 0,
  },
  invListThumb: { width: '100%', height: '100%' },
  invListNoThumb: {
    width: '100%', height: '100%',
    alignItems: 'center', justifyContent: 'center',
  },
  invListBody: { flex: 1, justifyContent: 'space-between' },
  invListTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  invListTitle: { color: '#FFF', fontSize: 14, fontWeight: '800', lineHeight: 19, marginBottom: 6 },
  invListPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 },
  invListPrice: { color: LIME, fontSize: 16, fontWeight: '900' },

  // Shared
  invTypeBadge: {
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6,
    borderWidth: 1, alignSelf: 'flex-start',
  },
  invTypeBadgeText: { fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  invActiveDot: {
    width: 7, height: 7, borderRadius: 4, backgroundColor: '#22C55E',
  },
  invNegotiable: {
    color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '700',
    backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 6,
    paddingVertical: 2, borderRadius: 5,
  },
  invEmpty: { paddingVertical: 60, alignItems: 'center', gap: 12 },
  invEmptyIcon: {
    width: 72, height: 72, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
  },
  invEmptyTitle: { color: 'rgba(255,255,255,0.3)', fontSize: 15, fontWeight: '800' },
  invEmptyText: { color: 'rgba(255,255,255,0.15)', fontSize: 12, fontWeight: '600' },
});
