/**
 * Shop page — shows all active listings by a specific user.
 * Referenced via Instagram/WhatsApp-style profile shops: tap "Shop" on any profile.
 * Route: /shop/[userId]
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ImageBackground,
  Dimensions,
  TextInput,
  RefreshControl,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSelector } from 'react-redux';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usersApi, listingsApi, followsApi, directMessagesApi } from '../../src/api/client';
import { selectUser } from '../../src/store/authSlice';

const { width } = Dimensions.get('window');

// ── Brand colours (consistent with the rest of the app) ──────────────────────
const LIME    = '#CDFF00';
const BG      = '#050505';
const VIOLET  = '#7C3AED';
const CARD_BG = '#0D0D0D';

// Listing type metadata — badge colour and label per type
const TYPE_META = {
  PRODUCT: { label: 'Product',  color: '#60A5FA' },
  SERVICE: { label: 'Service',  color: '#A78BFA' },
  JOB:     { label: 'Job',      color: '#FB923C' },
  SKILL:   { label: 'Skill',    color: LIME },
  RENTAL:  { label: 'Rental',   color: '#34D399' },
  EVENT:   { label: 'Event',    color: '#F472B6' },
};

// Derived list of all possible category filter tabs from the known listing types
const CATEGORIES = ['All', ...Object.keys(TYPE_META)];

// ── Product card — 2-column grid ─────────────────────────────────────────────
function ProductCard({ item, onPress }) {
  const meta    = TYPE_META[item.listingType] || TYPE_META.PRODUCT;
  const thumb   = item.mediaUrls?.[0];
  const GUTTER  = 12;
  const COLS    = 2;
  const cardW   = (width - GUTTER * (COLS + 1)) / COLS;

  return (
    <TouchableOpacity
      style={[styles.productCard, { width: cardW }]}
      onPress={() => onPress(item)}
      activeOpacity={0.88}
    >
      {/* Thumbnail */}
      <View style={[styles.productThumb, { width: cardW, height: cardW * 1.2 }]}>
        {thumb ? (
          <Image source={{ uri: thumb }} style={styles.productThumbImg} resizeMode="cover" />
        ) : (
          <View style={styles.productNoThumb}>
            <Feather name="package" size={32} color="rgba(255,255,255,0.08)" />
          </View>
        )}
        {/* Gradient overlay for readability */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.8)']}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        {/* Type badge pinned to top-left */}
        <View style={[styles.typeBadge, { backgroundColor: meta.color + '22', borderColor: meta.color + '66' }]}>
          <Text style={[styles.typeBadgeText, { color: meta.color }]}>{meta.label.toUpperCase()}</Text>
        </View>
        {/* Price pinned to bottom-left */}
        <View style={styles.priceWrap}>
          <Text style={styles.priceText}>
            {item.currency || '£'}{Number(item.price).toLocaleString()}
          </Text>
          {item.negotiable && (
            <View style={styles.oboBadge}>
              <Text style={styles.oboText}>OBO</Text>
            </View>
          )}
        </View>
      </View>

      {/* Title + location */}
      <View style={styles.productMeta}>
        <Text style={styles.productTitle} numberOfLines={2}>{item.title}</Text>
        {item.locationCity ? (
          <View style={styles.productLocation}>
            <Feather name="map-pin" size={9} color="rgba(255,255,255,0.3)" />
            <Text style={styles.productLocationText}>{item.locationCity}</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

// ── Main shop screen ──────────────────────────────────────────────────────────
export default function ShopPage() {
  const router        = useRouter();
  const { userId }    = useLocalSearchParams();
  const currentUser   = useSelector(selectUser);
  const insets        = useSafeAreaInsets();

  const [user,       setUser]       = useState(null);
  const [listings,   setListings]   = useState([]);
  const [filtered,   setFiltered]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [category,   setCategory]   = useState('All');
  const [search,     setSearch]     = useState('');
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  // ── Data loading ────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!userId) return;
    try {
      const [profRes, listRes, followRes] = await Promise.allSettled([
        usersApi.getProfile(userId),
        listingsApi.getByUser(userId),
        followsApi.isFollowing(userId),
      ]);
      if (profRes.status === 'fulfilled')   setUser(profRes.value.data);
      if (listRes.status === 'fulfilled')   setListings(listRes.value.data || []);
      if (followRes.status === 'fulfilled') setIsFollowing(followRes.value.data?.isFollowing ?? false);
    } catch (e) {
      console.error('Shop load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Category + search filter ─────────────────────────────────────────────
  useEffect(() => {
    let items = listings;
    if (category !== 'All') {
      items = items.filter(l => l.listingType === category);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      items = items.filter(l =>
        l.title?.toLowerCase().includes(q) ||
        l.description?.toLowerCase().includes(q) ||
        l.locationCity?.toLowerCase().includes(q)
      );
    }
    setFiltered(items);
  }, [listings, category, search]);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  // ── Follow / Message helpers ─────────────────────────────────────────────
  const handleFollow = async () => {
    if (followLoading) return;
    setFollowLoading(true);
    try {
      if (isFollowing) {
        await followsApi.unfollow(userId);
        setIsFollowing(false);
      } else {
        await followsApi.follow(userId);
        setIsFollowing(true);
      }
    } catch (e) {
      console.error('Follow toggle error:', e);
    } finally {
      setFollowLoading(false);
    }
  };

  const handleMessage = async () => {
    try {
      const res = await directMessagesApi.getOrCreateConversation(userId);
      const conv = res.data;
      router.push(`/chat/${conv.id}?name=${encodeURIComponent(user?.fullName || user?.username || '')}&avatar=${encodeURIComponent(user?.avatarUrl || '')}`);
    } catch (e) {
      console.error('Message error:', e);
    }
  };

  // ── Derived stats ────────────────────────────────────────────────────────
  const isOwnShop    = currentUser?.id === userId;
  const productCount = listings.length;
  const avgRating    = user?.avgRating?.toFixed(1) || '—';

  // ── Loading state ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color={LIME} size="large" />
      </View>
    );
  }

  // ── Category tabs row ────────────────────────────────────────────────────
  // Only show categories that have at least one listing
  const activeCats = CATEGORIES.filter(cat =>
    cat === 'All' ? true : listings.some(l => l.listingType === cat)
  );

  return (
    <View style={[styles.screen, { paddingTop: 0 }]}>
      <StatusBar style="light" />

      {/* Back button — absolute over the hero banner */}
      <TouchableOpacity
        style={[styles.backBtn, { top: insets.top + 12 }]}
        onPress={() => router.back()}
      >
        <Feather name="arrow-left" size={20} color="#FFF" />
      </TouchableOpacity>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={LIME} />}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        {/* ── Hero banner ─────────────────────────────────────────────────── */}
        <View style={styles.heroWrap}>
          <ImageBackground
            source={{ uri: user?.shopBannerUrl || 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1000&q=80' }}
            style={styles.heroBanner}
          >
            <LinearGradient
              colors={['rgba(5,5,5,0.15)', 'rgba(5,5,5,0.6)', BG]}
              style={StyleSheet.absoluteFillObject}
            />
          </ImageBackground>

          {/* Avatar + identity block anchored at bottom of banner */}
          <View style={styles.heroIdentity}>
            <View style={styles.avatarRing}>
              <Image
                source={{ uri: user?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80' }}
                style={styles.avatarImg}
              />
            </View>
            <View style={styles.identityText}>
              <Text style={styles.shopName}>{user?.fullName || user?.username || 'Shop'}</Text>
              <Text style={styles.shopHandle}>@{user?.username}</Text>
            </View>
          </View>
        </View>

        {/* ── Stats row ───────────────────────────────────────────────────── */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{productCount}</Text>
            <Text style={styles.statLabel}>DROPS</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{avgRating}</Text>
            <Text style={styles.statLabel}>RATING</Text>
          </View>
          {user?.bio ? (
            <>
              <View style={styles.statDivider} />
              <View style={[styles.statItem, { flex: 2, alignItems: 'flex-start', paddingLeft: 16 }]}>
                <Text style={styles.shopBio} numberOfLines={2}>{user.bio}</Text>
              </View>
            </>
          ) : null}
        </View>

        {/* ── Action buttons ───────────────────────────────────────────────── */}
        {!isOwnShop && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.followBtn, isFollowing && styles.followBtnActive]}
              onPress={handleFollow}
              disabled={followLoading}
            >
              {followLoading ? (
                <ActivityIndicator color={isFollowing ? BG : '#FFF'} size="small" />
              ) : (
                <Text style={[styles.followBtnText, isFollowing && styles.followBtnTextActive]}>
                  {isFollowing ? '✓ Following' : 'Follow'}
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.messageBtn} onPress={handleMessage}>
              <Feather name="message-circle" size={18} color={BG} />
              <Text style={styles.messageBtnText}>Message</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Search bar ──────────────────────────────────────────────────── */}
        <View style={styles.searchWrap}>
          <Feather name="search" size={16} color="rgba(255,255,255,0.3)" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search this shop..."
            placeholderTextColor="rgba(255,255,255,0.25)"
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Feather name="x" size={14} color="rgba(255,255,255,0.4)" />
            </TouchableOpacity>
          )}
        </View>

        {/* ── Category filter tabs ─────────────────────────────────────────── */}
        {activeCats.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.catScroll}
          >
            {activeCats.map(cat => (
              <TouchableOpacity
                key={cat}
                style={[styles.catTab, category === cat && styles.catTabActive]}
                onPress={() => setCategory(cat)}
              >
                <Text style={[styles.catTabText, category === cat && styles.catTabTextActive]}>
                  {cat === 'All' ? 'All' : (TYPE_META[cat]?.label || cat)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* ── Product grid ─────────────────────────────────────────────────── */}
        <View style={styles.grid}>
          {filtered.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Feather name="shopping-bag" size={36} color="rgba(255,255,255,0.08)" />
              </View>
              <Text style={styles.emptyTitle}>
                {search || category !== 'All' ? 'No matches' : 'No drops yet'}
              </Text>
              <Text style={styles.emptyText}>
                {search || category !== 'All'
                  ? 'Try adjusting your search or filter'
                  : "This seller hasn't listed anything yet"}
              </Text>
            </View>
          ) : (
            <View style={styles.gridRow}>
              {filtered.map(item => (
                <ProductCard
                  key={item.id}
                  item={item}
                  onPress={(it) => router.push(`/listing/${it.id}`)}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen:        { flex: 1, backgroundColor: BG },
  loadingScreen: { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' },

  // Back button
  backBtn: {
    position: 'absolute', left: 16, zIndex: 100,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Hero ──────────────────────────────────────────────────────────────────
  heroWrap:     { height: 280, position: 'relative' },
  heroBanner:   { width: '100%', height: '100%' },
  heroIdentity: {
    position: 'absolute', bottom: 20, left: 20, right: 20,
    flexDirection: 'row', alignItems: 'flex-end', gap: 14,
  },
  avatarRing: {
    width: 84, height: 84, borderRadius: 42,
    borderWidth: 3, borderColor: LIME,
    overflow: 'hidden', backgroundColor: '#111',
  },
  avatarImg:    { width: '100%', height: '100%' },
  identityText: { paddingBottom: 6, flex: 1 },
  shopName:     { color: '#FFF', fontSize: 22, fontWeight: '900', letterSpacing: -0.4 },
  shopHandle:   { color: 'rgba(255,255,255,0.45)', fontSize: 13, fontWeight: '700', marginTop: 2 },

  // ── Stats row ─────────────────────────────────────────────────────────────
  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
    paddingVertical: 16, paddingHorizontal: 24,
  },
  statItem:    { alignItems: 'center', minWidth: 60 },
  statValue:   { color: '#FFF', fontSize: 18, fontWeight: '900' },
  statLabel:   { color: 'rgba(255,255,255,0.35)', fontSize: 9, fontWeight: '900', letterSpacing: 1.5, marginTop: 2 },
  statDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.08)', marginHorizontal: 20 },
  shopBio:     { color: 'rgba(255,255,255,0.55)', fontSize: 12, lineHeight: 17 },

  // ── Action buttons ────────────────────────────────────────────────────────
  actionRow:        { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingVertical: 16 },
  followBtn:        { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', paddingVertical: 13, borderRadius: 14, alignItems: 'center' },
  followBtnActive:  { backgroundColor: LIME, borderColor: LIME },
  followBtnText:    { color: '#FFF', fontWeight: '900', fontSize: 14 },
  followBtnTextActive: { color: BG },
  messageBtn:       { flex: 1, backgroundColor: LIME, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 13, borderRadius: 14, gap: 7 },
  messageBtnText:   { color: BG, fontWeight: '900', fontSize: 14 },

  // ── Search bar ────────────────────────────────────────────────────────────
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14, paddingHorizontal: 14, gap: 8, height: 44,
  },
  searchInput: {
    flex: 1, color: '#FFF', fontSize: 14,
    ...Platform.select({ web: { outlineWidth: 0 } }),
  },

  // ── Category tabs ─────────────────────────────────────────────────────────
  catScroll:       { paddingHorizontal: 12, paddingVertical: 4, gap: 8, flexDirection: 'row' },
  catTab:          { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  catTabActive:    { backgroundColor: LIME, borderColor: LIME },
  catTabText:      { color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: '800' },
  catTabTextActive:{ color: BG },

  // ── Product grid ──────────────────────────────────────────────────────────
  grid:         { paddingHorizontal: 12, paddingTop: 12 },
  gridRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  productCard: {
    borderRadius: 18, overflow: 'hidden',
    backgroundColor: CARD_BG,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 0, // gap handles spacing
  },
  productThumb:    { position: 'relative', overflow: 'hidden' },
  productThumbImg: { width: '100%', height: '100%' },
  productNoThumb: {
    width: '100%', height: '100%',
    backgroundColor: '#111',
    alignItems: 'center', justifyContent: 'center',
  },
  typeBadge: {
    position: 'absolute', top: 10, left: 10,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 8, borderWidth: 1,
  },
  typeBadgeText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  priceWrap: {
    position: 'absolute', bottom: 10, left: 10,
    flexDirection: 'row', alignItems: 'center', gap: 5,
  },
  priceText:    { color: '#FFF', fontSize: 15, fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  oboBadge:     { backgroundColor: 'rgba(205,255,0,0.18)', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
  oboText:      { color: LIME, fontSize: 9, fontWeight: '900' },
  productMeta:  { padding: 10 },
  productTitle: { color: '#FFF', fontSize: 13, fontWeight: '800', lineHeight: 18 },
  productLocation: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  productLocationText: { color: 'rgba(255,255,255,0.3)', fontSize: 10 },

  // ── Empty state ───────────────────────────────────────────────────────────
  empty: { paddingTop: 60, alignItems: 'center', paddingHorizontal: 40 },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  emptyTitle: { color: 'rgba(255,255,255,0.7)', fontSize: 18, fontWeight: '900', marginBottom: 8 },
  emptyText:  { color: 'rgba(255,255,255,0.3)', fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
