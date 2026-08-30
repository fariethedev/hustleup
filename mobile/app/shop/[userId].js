import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image,
  ActivityIndicator, RefreshControl, TextInput, ScrollView, Dimensions,
  ImageBackground, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSelector, useDispatch } from 'react-redux';
import * as ImagePicker from 'expo-image-picker';
import { listingsApi, usersApi, followsApi, directMessagesApi, API_URL } from '../../src/api/client';
import { selectUser, selectIsAuthenticated, setUser as setReduxUser } from '../../src/store/authSlice';
import ListingDetailSheet from '../../src/components/listings/ListingDetailSheet';

const resolveMediaUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http') || url.startsWith('blob:') || url.startsWith('data:')) return url;
  const apiUrl = typeof API_URL !== 'undefined' && API_URL ? API_URL : 'http://localhost:8000/api/v1';
  const base = apiUrl.replace('/api/v1', '');
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
};

const { width } = Dimensions.get('window');
const BG   = '#050505';
const LIME = '#CDFF00';
const CARD_GAP  = 10;
const CARD_COLS = 2;
const CARD_W    = (width - 16 * 2 - CARD_GAP) / CARD_COLS;

const TYPE_COLORS = {
  PRODUCT: '#60A5FA', SERVICE: '#A78BFA', JOB: '#FB923C',
  SKILL: '#34D399',   RENTAL: '#F472B6', EVENT: '#FBBF24',
};

const CATEGORIES = ['All', 'PRODUCT', 'SERVICE', 'JOB', 'SKILL', 'RENTAL', 'EVENT'];

// ─── Product Card ─────────────────────────────────────────────────────────────
function ProductCard({ item, onPress }) {
  const typeColor = TYPE_COLORS[item.listingType] || '#888';
  const thumb = item.mediaUrls?.[0];
  const currency = item.currency || 'PLN '

  return (
    <TouchableOpacity style={[pc.card, { width: CARD_W }]} onPress={() => onPress(item)} activeOpacity={0.88}>
      <View style={[pc.thumb, { height: CARD_W * 1.1 }]}>
        {thumb ? (
          <Image source={{ uri: thumb }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <View style={pc.noThumb}>
            <Feather name="package" size={32} color="rgba(255,255,255,0.1)" />
          </View>
        )}
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.7)']} style={StyleSheet.absoluteFill} pointerEvents="none" />
        <View style={[pc.typeBadge, { backgroundColor: typeColor + '22', borderColor: typeColor + '55' }]}>
          <Text style={[pc.typeText, { color: typeColor }]}>{item.listingType || 'PRODUCT'}</Text>
        </View>
        <View style={pc.pricePill}>
          <Text style={pc.priceText}>{currency}{Number(item.price).toLocaleString()}</Text>
          {item.negotiable ? <Text style={pc.oboText}>OBO</Text> : null}
        </View>
      </View>
      <View style={pc.meta}>
        <Text style={pc.title} numberOfLines={2}>{item.title}</Text>
        {item.locationCity ? (
          <View style={pc.locRow}>
            <Feather name="map-pin" size={9} color="rgba(255,255,255,0.3)" />
            <Text style={pc.locText} numberOfLines={1}>{item.locationCity}</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const pc = StyleSheet.create({
  card: { backgroundColor: '#111', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  thumb: { width: '100%', backgroundColor: '#1A1A1A', overflow: 'hidden', position: 'relative' },
  noThumb: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  typeBadge: { position: 'absolute', top: 8, left: 8, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  typeText: { fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
  pricePill: { position: 'absolute', bottom: 8, left: 8, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.75)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  priceText: { color: LIME, fontSize: 12, fontWeight: '900' },
  oboText: { color: 'rgba(255,255,255,0.45)', fontSize: 9, fontWeight: '700' },
  meta: { padding: 10, gap: 5 },
  title: { color: '#FFF', fontSize: 12, fontWeight: '700', lineHeight: 16 },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locText: { color: 'rgba(255,255,255,0.3)', fontSize: 10 },
});

// ─── Shop Page ────────────────────────────────────────────────────────────────
export default function ShopPage() {
  const { userId } = useLocalSearchParams();
  const router = useRouter();
  const dispatch = useDispatch();
  const currentUser = useSelector(selectUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);

  const [user, setUser]             = useState(null);
  const [listings, setListings]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch]         = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedItem, setSelectedItem]     = useState(null);
  const [isFollowing, setIsFollowing]       = useState(false);
  const [followLoading, setFollowLoading]   = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  const isOwnShop = currentUser?.id === userId;

  const loadData = useCallback(async () => {
    if (!userId) return;
    try {
      const [profRes, listRes, followRes] = await Promise.allSettled([
        usersApi.getProfile(userId),
        listingsApi.getByUser(userId),
        isAuthenticated && !isOwnShop ? followsApi.isFollowing(userId) : Promise.resolve(null),
      ]);
      if (profRes.status === 'fulfilled') setUser(profRes.value.data);
      if (listRes.status === 'fulfilled') setListings(listRes.value.data || []);
      if (followRes.status === 'fulfilled' && followRes.value?.data) {
        setIsFollowing(followRes.value.data.isFollowing ?? false);
      }
    } catch (e) {
      console.error('Shop load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId, isAuthenticated, isOwnShop]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const handleFollow = async () => {
    if (followLoading) return;
    setFollowLoading(true);
    try {
      if (isFollowing) { await followsApi.unfollow(userId); setIsFollowing(false); }
      else             { await followsApi.follow(userId);   setIsFollowing(true); }
    } catch (e) {}
    finally { setFollowLoading(false); }
  };

  const handleMessage = async () => {
    try {
      await directMessagesApi.getOrCreateConversation(userId);
      router.push({
        pathname: '/(tabs)/messages',
        params: { partnerId: userId, partnerName: user?.fullName || user?.username || 'Seller' },
      });
    } catch {
      router.push({ pathname: '/(tabs)/messages', params: { partnerId: userId } });
    }
  };

  const handleBannerUpload = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted' && status !== 'limited') {
      Alert.alert('Permission needed', 'Allow photo library access to change your banner.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      aspect: [16, 9],
      quality: 0.85,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setUploadingBanner(true);
    try {
      const filename = asset.uri.split('/').pop();
      const ext = filename.split('.').pop().toLowerCase();
      const formData = new FormData();
      formData.append('file', { uri: asset.uri, name: filename, type: `image/${ext}` });
      const res = await usersApi.uploadBanner(formData);
      const updated = res.data;
      setUser(prev => ({ ...prev, ...updated }));
      dispatch(setReduxUser({ ...currentUser, ...updated }));
    } catch {
      Alert.alert('Upload failed', 'Could not update banner. Try again.');
    } finally {
      setUploadingBanner(false);
    }
  };

  const filteredListings = listings.filter(item => {
    const matchCat = activeCategory === 'All' || item.listingType === activeCategory;
    const matchSearch = !search || item.title?.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const sellerName = user?.fullName || user?.username || 'Seller';
  const sellerInitial = sellerName[0]?.toUpperCase() || '?';
  const bannerUrl = resolveMediaUrl(user?.shopBannerUrl);
  const avatarUrl = resolveMediaUrl(user?.avatarUrl);

  const ListHeader = () => (
    <View>
      {/* ── Banner ── */}
      <TouchableOpacity
        activeOpacity={isOwnShop ? 0.85 : 1}
        onPress={isOwnShop ? handleBannerUpload : undefined}
        style={sh.bannerTouch}
      >
        <ImageBackground
          source={bannerUrl ? { uri: bannerUrl } : null}
          style={[sh.banner, !bannerUrl && sh.bannerPlaceholder]}
        >
          <LinearGradient
            colors={['rgba(5,5,5,0.1)', 'rgba(5,5,5,0.75)']}
            style={StyleSheet.absoluteFillObject}
          />
          {isOwnShop && (
            <View style={sh.bannerEditBadge}>
              {uploadingBanner
                ? <ActivityIndicator size="small" color="#FFF" />
                : <Feather name="camera" size={14} color="#FFF" />}
              {!uploadingBanner && <Text style={sh.bannerEditText}>Edit Banner</Text>}
            </View>
          )}
        </ImageBackground>
      </TouchableOpacity>

      {/* ── Hero ── */}
      <View style={sh.hero}>
        <View style={sh.heroContent}>
          <View style={sh.avatarWrap}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={sh.avatarImg} />
            ) : (
              <Text style={sh.avatarText}>{sellerInitial}</Text>
            )}
            {user?.verified ? (
              <View style={sh.verifiedBadge}>
                <MaterialCommunityIcons name="check-decagram" size={16} color={LIME} />
              </View>
            ) : null}
          </View>

          <View style={sh.heroInfo}>
            <Text style={sh.shopName}>{sellerName}</Text>
            {user?.bio ? <Text style={sh.bio} numberOfLines={2}>{user.bio}</Text> : null}
            <View style={sh.statsRow}>
              <Text style={sh.stat}><Text style={sh.statNum}>{listings.length}</Text> listings</Text>
              <Text style={sh.statSep}>·</Text>
              <Text style={sh.stat}><Text style={sh.statNum}>{user?.followersCount || 0}</Text> followers</Text>
            </View>
          </View>
        </View>

        {/* Action buttons */}
        {!isOwnShop && (
          <View style={sh.actionRow}>
            <TouchableOpacity
              style={[sh.followBtn, isFollowing && sh.followBtnActive]}
              onPress={handleFollow}
              disabled={followLoading}
              activeOpacity={0.85}
            >
              {followLoading
                ? <ActivityIndicator size="small" color={isFollowing ? BG : '#FFF'} />
                : <Text style={[sh.followBtnText, isFollowing && sh.followBtnTextActive]}>
                    {isFollowing ? '✓ Following' : 'Follow'}
                  </Text>}
            </TouchableOpacity>
            <TouchableOpacity style={sh.msgBtn} onPress={handleMessage} activeOpacity={0.85}>
              <Feather name="message-circle" size={16} color={LIME} />
              <Text style={sh.msgBtnText}>Message</Text>
            </TouchableOpacity>
          </View>
        )}
        {isOwnShop && (
          <TouchableOpacity style={sh.editShopBtn} onPress={() => router.push('/profile/edit')} activeOpacity={0.85}>
            <Feather name="edit-2" size={14} color={LIME} />
            <Text style={sh.editShopText}>Edit Shop</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Search ── */}
      <View style={sh.searchWrap}>
        <Feather name="search" size={16} color="rgba(255,255,255,0.3)" />
        <TextInput
          style={sh.searchInput}
          placeholder="Search listings..."
          placeholderTextColor="rgba(255,255,255,0.2)"
          value={search}
          onChangeText={setSearch}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Feather name="x" size={14} color="rgba(255,255,255,0.3)" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* ── Category tabs ── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={sh.catRow}>
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat}
            style={[sh.catChip, activeCategory === cat && sh.catChipActive]}
            onPress={() => setActiveCategory(cat)}
            activeOpacity={0.75}
          >
            <Text style={[sh.catText, activeCategory === cat && sh.catTextActive]}>{cat}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {filteredListings.length === 0 && !loading ? (
        <View style={sh.emptyBox}>
          <Feather name="shopping-bag" size={40} color="rgba(255,255,255,0.06)" />
          <Text style={sh.emptyTitle}>{search ? 'No results found' : 'No listings yet'}</Text>
          <Text style={sh.emptySub}>{search ? 'Try a different search' : isOwnShop ? 'Post your first listing!' : 'Check back later'}</Text>
        </View>
      ) : null}
    </View>
  );

  if (loading) {
    return (
      <View style={sh.loadingBox}>
        <ActivityIndicator color={LIME} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={sh.screen} edges={['top']}>
      {/* App bar */}
      <View style={sh.appBar}>
        <TouchableOpacity style={sh.backBtn} onPress={() => router.back()} activeOpacity={0.75}>
          <Feather name="arrow-left" size={22} color="#FFF" />
        </TouchableOpacity>
        <Text style={sh.appBarTitle} numberOfLines={1}>{sellerName}</Text>
        <View style={{ width: 38 }} />
      </View>

      <FlatList
        data={filteredListings}
        keyExtractor={item => String(item.id)}
        numColumns={2}
        columnWrapperStyle={sh.columnWrapper}
        contentContainerStyle={sh.grid}
        ListHeaderComponent={<ListHeader />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={LIME} />}
        renderItem={({ item }) => (
          <ProductCard item={item} onPress={(it) => setSelectedItem(it)} />
        )}
        showsVerticalScrollIndicator={false}
      />

      <ListingDetailSheet
        listing={selectedItem}
        visible={!!selectedItem}
        onClose={() => setSelectedItem(null)}
      />
    </SafeAreaView>
  );
}

const sh = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  loadingBox: { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' },
  appBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  backBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' },
  appBarTitle: { color: '#FFF', fontSize: 16, fontWeight: '900', flex: 1, textAlign: 'center' },
  bannerTouch: { width: '100%' },
  banner: { width: '100%', height: 160, justifyContent: 'flex-end', alignItems: 'flex-end', padding: 12 },
  bannerPlaceholder: { backgroundColor: 'rgba(205,255,0,0.05)' },
  bannerEditBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  bannerEditText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  hero: { padding: 20, gap: 16 },
  heroContent: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  avatarWrap: { position: 'relative' },
  avatarImg: { width: 72, height: 72, borderRadius: 22, borderWidth: 2, borderColor: LIME },
  avatarText: { width: 72, height: 72, borderRadius: 22, backgroundColor: 'rgba(205,255,0,0.1)', textAlign: 'center', lineHeight: 72, fontSize: 28, fontWeight: '900', color: LIME, borderWidth: 2, borderColor: 'rgba(205,255,0,0.3)', overflow: 'hidden' },
  verifiedBadge: { position: 'absolute', bottom: -4, right: -4, backgroundColor: BG, borderRadius: 12, padding: 2 },
  heroInfo: { flex: 1, gap: 6 },
  shopName: { color: '#FFF', fontSize: 20, fontWeight: '900' },
  bio: { color: 'rgba(255,255,255,0.45)', fontSize: 13, lineHeight: 18 },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  stat: { color: 'rgba(255,255,255,0.4)', fontSize: 12 },
  statNum: { color: '#FFF', fontWeight: '800' },
  statSep: { color: 'rgba(255,255,255,0.2)' },
  actionRow: { flexDirection: 'row', gap: 10 },
  followBtn: { flex: 1, height: 42, borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  followBtnActive: { backgroundColor: LIME, borderColor: LIME },
  followBtnText: { color: '#FFF', fontWeight: '800', fontSize: 13 },
  followBtnTextActive: { color: BG },
  msgBtn: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 18, height: 42, borderRadius: 14, backgroundColor: 'rgba(205,255,0,0.08)', borderWidth: 1.5, borderColor: 'rgba(205,255,0,0.25)' },
  msgBtnText: { color: LIME, fontWeight: '800', fontSize: 13 },
  editShopBtn: { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start', paddingHorizontal: 14, height: 38, borderRadius: 12, backgroundColor: 'rgba(205,255,0,0.07)', borderWidth: 1, borderColor: 'rgba(205,255,0,0.2)' },
  editShopText: { color: LIME, fontWeight: '800', fontSize: 12 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginVertical: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  searchInput: { flex: 1, color: '#FFF', fontSize: 14 },
  catRow: { paddingHorizontal: 14, gap: 8, marginBottom: 12 },
  catChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  catChipActive: { backgroundColor: LIME, borderColor: LIME },
  catText: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '700' },
  catTextActive: { color: BG },
  emptyBox: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyTitle: { color: 'rgba(255,255,255,0.4)', fontSize: 16, fontWeight: '800' },
  emptySub: { color: 'rgba(255,255,255,0.2)', fontSize: 13 },
  columnWrapper: { gap: CARD_GAP, paddingHorizontal: 16 },
  grid: { paddingBottom: 120, gap: CARD_GAP },
});
