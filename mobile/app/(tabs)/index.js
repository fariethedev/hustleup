import React, { useCallback, useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { directMessagesApi, listingsApi, notificationsApi, shopsApi } from '../../src/api/client';
import { mediaUrl } from '../../src/utils/media';
import { LISTING_CATEGORIES } from '../../src/utils/marketplace';
import FeaturedBanner, { buildFeatured, featuredHeight } from '../../src/components/native/FeaturedBanner';
import AboutHustleSpace from '../../src/components/native/AboutHustleSpace';
import { useRemote } from '../../src/hooks/useRemote';
import { Copy, Notice, Screen, Section, usePalette } from '../../src/components/native/Kit';
import { ListingCard, ShopCard } from '../../src/components/native/DiscoveryCards';
import CreateListingModal from '../../src/components/listings/CreateListingModal';

async function loadHome() {
  const results = await Promise.allSettled([listingsApi.getRecommended(), shopsApi.browse(), listingsApi.browse({ type: 'EVENT' })]);
  const read = i => results[i].status === 'fulfilled' && Array.isArray(results[i].value.data) ? results[i].value.data : [];
  return { listings: read(0), shops: read(1), events: read(2), failed: results.some(r => r.status === 'rejected') };
}

const categories = LISTING_CATEGORIES.map(c => ({ label: c.label, icon: c.icon, category: c.key }));

function CategoryChip({ item, onPress }) {
  const c = usePalette();
  return <Pressable onPress={onPress} accessibilityLabel={item.label} style={{ width: 70, alignItems: 'center', gap: 6 }}>
    <View style={{ width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: c.card, borderWidth: 1, borderColor: c.line }}>
      <Feather name={item.icon} size={20} color={c.accent} />
    </View>
    <Copy style={{ fontSize: 11, textAlign: 'center' }} numberOfLines={1}>{item.label}</Copy>
  </Pressable>;
}

export default function Home() {
  const router = useRouter();
  const c = usePalette();
  const { width: screenWidth } = useWindowDimensions();
  const user = useSelector(s => s.auth.user);
  const [creating, setCreating] = useState(false);
  const [unread, setUnread] = useState(0);
  const [unreadChats, setUnreadChats] = useState(0);
  useFocusEffect(useCallback(() => {
    if (!user) { setUnread(0); return; }
    notificationsApi.unreadCount().then(r => setUnread(Number(r.data?.count ?? r.data) || 0)).catch(() => {});
    directMessagesApi.unreadCount().then(r => setUnreadChats(Number(r.data?.count) || 0)).catch(() => {});
  }, [user]));
  const { data, loading, error, reload } = useRemote(loadHome);
  const explore = params => router.push({ pathname: '/(tabs)/explore', params });
  const openListing = item => router.push({ pathname: '/listing/[id]', params: { id: item.id } });

  return <Screen showHeader={false} refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={c.accent} />}>
    <View style={{ gap: 22, paddingTop: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={user ? 'Your profile' : 'Sign in'} onPress={() => router.push(user?.id ? `/profile/${user.id}` : '/login')}
          style={{ width: 46, height: 46, borderRadius: 23, padding: 2, borderWidth: 2, borderColor: c.purple }}>
          {user?.avatarUrl
            ? <Image source={{ uri: mediaUrl(user.avatarUrl) }} style={{ width: '100%', height: '100%', borderRadius: 23 }} />
            : <View style={{ flex: 1, borderRadius: 23, backgroundColor: c.purpleSoft, alignItems: 'center', justifyContent: 'center' }}>
                {user?.fullName ? <Text style={{ color: c.purple, fontWeight: '900', fontSize: 18 }}>{user.fullName[0].toUpperCase()}</Text> : <Feather name="user" size={20} color={c.purple} />}
              </View>}
        </Pressable>
        <View style={{ flex: 1 }}>
          <Copy muted style={{ fontSize: 12 }}>{user?.fullName ? 'Welcome back,' : 'Welcome to HustleSpace'}</Copy>
          <Copy heading style={{ fontSize: 16 }} numberOfLines={1}>{user?.fullName ? user.fullName.split(' ')[0] : 'Your community'}</Copy>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Add a listing" onPress={() => user ? setCreating(true) : router.push('/login')}
          style={({ pressed }) => ({ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accent, transform: [{ scale: pressed ? 0.94 : 1 }] })}>
          <Feather name="plus" size={24} color={c.light ? '#FFF' : '#050505'} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={unreadChats ? `Messages, ${unreadChats} unread` : 'Messages'} onPress={() => router.push(user ? '/(tabs)/messages' : '/login')}
          style={({ pressed }) => ({ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: c.card, borderWidth: 1, borderColor: c.line, transform: [{ scale: pressed ? 0.94 : 1 }] })}>
          <Feather name="send" size={18} color={c.purple} />
          {unreadChats > 0 && <View style={{ position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: c.purple, borderWidth: 2, borderColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#FFF', fontSize: 9, fontWeight: '900' }}>{unreadChats > 9 ? '9+' : unreadChats}</Text>
          </View>}
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={unread ? `Notifications, ${unread} unread` : 'Notifications'} onPress={() => router.push(user ? '/notifications' : '/login')}
          style={({ pressed }) => ({ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: c.purple, transform: [{ scale: pressed ? 0.94 : 1 }] })}>
          <Feather name="bell" size={21} color="#FFF" />
          {unread > 0 && <View style={{ position: 'absolute', top: -2, right: -2, minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, backgroundColor: c.accent, borderWidth: 2, borderColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#111', fontSize: 10, fontWeight: '900' }}>{unread > 9 ? '9+' : unread}</Text>
          </View>}
        </Pressable>
      </View>

      {(() => {
        const featured = buildFeatured(data?.events, data?.listings);
        return featured.length ? <View>
          <Section eyebrow="DON'T MISS" title="Happening on HustleSpace" />
          <FeaturedBanner featured={featured} onOpen={openListing} />
        </View> : loading && !data ? <View style={{ height: featuredHeight(screenWidth), borderRadius: 28, backgroundColor: c.soft }} /> : null;
      })()}

      <View>
        <Section eyebrow="BROWSE YOUR WAY" title="What are you into?" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 3 }}>
          {categories.map(item => <CategoryChip key={item.category} item={item} onPress={() => explore({ category: item.category, tab: 'listings' })} />)}
        </ScrollView>
      </View>

      {(error || data?.failed) && <Notice message={error || 'Some sections could not load. You can still browse what is available.'} onRetry={reload} />}

      {!!data?.shops.length && <View><Section eyebrow="COMMUNITY FAVOURITES" title="Shops to know" action="See all" onAction={() => explore({ tab: 'shops' })} /><ScrollView horizontal contentContainerStyle={{ gap: 14 }} showsHorizontalScrollIndicator={false}>{data.shops.slice(0, 8).map(shop => <View key={shop.id} style={{ width: 275 }}><ShopCard shop={shop} onPress={() => router.push({ pathname: '/shop/[userId]', params: { userId: shop.ownerId, shopId: shop.id } })} /></View>)}</ScrollView></View>}

      {!!data?.events.length && <View><Section eyebrow="SAVE THE DATE" title="Events near you" action="Browse" onAction={() => explore({ tab: 'listings', type: 'EVENT' })} /><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>{data.events.slice(0, 9).map(item => <ListingCard key={item.id} item={item} onOpen={openListing} style={{ width: 235 }} />)}</ScrollView></View>}

      <View><Section eyebrow="FRESH FINDS" title="Trending listings" action="View all" onAction={() => explore({ tab: 'listings' })} />
        {loading && !data ? <Notice loading message="Finding local favourites…" /> : data?.listings.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>{data.listings.slice(0, 10).map(item => <ListingCard key={item.id} item={item} onOpen={openListing} style={{ width: 235 }} />)}</ScrollView> : <Notice message="New listings will appear here as your community adds them." onRetry={error ? reload : undefined} />}
      </View>

      <AboutHustleSpace userId={user?.id} onNavigate={route => router.push(route)} onCreateListing={() => user ? setCreating(true) : router.push('/login')} />

    </View>
    <CreateListingModal visible={creating} onClose={() => setCreating(false)} onCreated={reload} />
  </Screen>;
}
