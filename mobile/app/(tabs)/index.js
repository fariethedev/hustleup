import React, { useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, View, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { listingsApi, shopsApi } from '../../src/api/client';
import { useRemote } from '../../src/hooks/useRemote';
import { Button, Copy, Notice, Panel, Screen, Section, fonts, usePalette } from '../../src/components/native/Kit';
import { ListingCard, ShopCard } from '../../src/components/native/DiscoveryCards';
import CreateListingModal from '../../src/components/listings/CreateListingModal';
import FeaturedBanner, { buildFeatured, featuredHeight } from '../../src/components/native/FeaturedBanner';
import { LISTING_CATEGORIES } from '../../src/utils/marketplace';
import { mediaUrl } from '../../src/utils/media';

async function loadHome() {
  const results = await Promise.allSettled([listingsApi.getRecommended(), shopsApi.browse(), listingsApi.browse({ type: 'EVENT' })]);
  const read = i => results[i].status === 'fulfilled' && Array.isArray(results[i].value.data) ? results[i].value.data : [];
  return { listings: read(0), shops: read(1), events: read(2), failed: results.some(r => r.status === 'rejected') };
}
/** Round category shortcut, like a shop's department row. */
function CategoryChip({ item, onPress }) {
  const c = usePalette();
  return <Pressable accessibilityRole="button" accessibilityLabel={`Browse ${item.label}`} onPress={onPress} style={({ pressed }) => ({ width: 76, alignItems: 'center', gap: 6, opacity: pressed ? 0.7 : 1 })}>
    <View style={{ width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: c.card, borderWidth: 1, borderColor: c.line }}>
      <Feather name={item.icon} size={22} color={c.accent} />
    </View>
    <Copy style={{ fontSize: 13, textAlign: 'center' }} numberOfLines={1}>{item.label}</Copy>
  </Pressable>;
}

function Task({ icon, title, description, onPress }) {
  const c = usePalette();
  return <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${description}`} onPress={onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, minHeight: 88, borderRadius: 20, borderWidth: 1, borderColor: c.line, backgroundColor: pressed ? c.soft : c.card })}>
    <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center' }}><Feather name={icon} size={24} color={c.accent} /></View>
    <View style={{ flex: 1, gap: 3 }}><Copy style={{ fontFamily: fonts.medium, fontSize: 18 }}>{title}</Copy><Copy muted style={{ fontSize: 15 }}>{description}</Copy></View>
    <Feather name="chevron-right" size={22} color={c.muted} />
  </Pressable>;
}
export default function Home() {
  const router = useRouter();
  const c = usePalette();
  const { fontScale, width } = useWindowDimensions();
  const user = useSelector(s => s.auth.user);
  const [creating, setCreating] = useState(false);
  const { data, loading, error, reload } = useRemote(loadHome);
  const browse = params => router.push({ pathname: '/(tabs)/explore', params });
  return <Screen refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={c.accent} />}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 8 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Your profile" onPress={() => router.push(user?.id ? '/(tabs)/me' : '/login')} hitSlop={6}
        style={{ width: 52, height: 52, borderRadius: 26, overflow: 'hidden', backgroundColor: c.purpleSoft, borderWidth: 2, borderColor: c.card, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 }}>
        {user?.avatarUrl
          ? <Image source={{ uri: mediaUrl(user.avatarUrl) }} style={{ width: '100%', height: '100%' }} accessibilityIgnoresInvertColors />
          : user?.fullName ? <Copy style={{ color: c.purple, fontFamily: fonts.heading, fontSize: 20 }}>{user.fullName[0].toUpperCase()}</Copy>
            : <Feather name="user" size={22} color={c.purple} />}
      </Pressable>
      <View style={{ flex: 1 }}>
        <Copy heading accessibilityRole="header" numberOfLines={1} style={{ fontSize: 24 }}>{user?.fullName ? `Hello, ${user.fullName.split(' ')[0]}` : 'Welcome'}</Copy>
        <Copy muted numberOfLines={1} style={{ fontSize: 14 }}>What would you like to do today?</Copy>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Search products, services and shops" onPress={() => browse({ tab: 'listings' })} hitSlop={6}
        style={({ pressed }) => ({ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.line, backgroundColor: pressed ? c.soft : c.card })}>
        <Feather name="search" size={22} color={c.text} />
      </Pressable>
    </View>
    {(() => {
      // Trending now: upcoming events first, then the most popular listings with photos.
      const featured = buildFeatured(data?.events, data?.listings);
      if (featured.length) return <View>
        <Section eyebrow="TRENDING NOW" title="Popular on HustleSpace" action="See all" onAction={() => browse({ tab: 'listings' })} />
        <FeaturedBanner featured={featured} onOpen={item => router.push({ pathname: '/listing/[id]', params: { id: item.id } })} />
      </View>;
      return loading && !data ? <View style={{ height: featuredHeight(width), borderRadius: 28, backgroundColor: c.soft }} /> : null;
    })()}
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 2 }} style={{ marginHorizontal: -20 }} contentInset={{ left: 20, right: 20 }}>
      <View style={{ width: 14 }} />
      {LISTING_CATEGORIES.map(cat => <CategoryChip key={cat.key} item={cat} onPress={() => browse({ tab: 'listings', category: cat.key })} />)}
      <View style={{ width: 14 }} />
    </ScrollView>
    <View style={{ gap: 12 }}>
      <Task icon="shopping-bag" title="Browse & shop" description="Find products from local sellers" onPress={() => browse({ tab: 'listings' })} />
      <Task icon="calendar" title="Book an appointment" description="Haircuts, beauty and other services" onPress={() => browse({ tab: 'shops', appointments: 'true' })} />
      <Task icon="package" title="My orders & bookings" description="Check purchases and appointments" onPress={() => router.push(user ? '/profile/orders' : '/login')} />
    </View>
    <Panel style={{ backgroundColor: c.soft }}>
      <Copy heading style={{ fontSize: 21 }}>Have something to offer?</Copy>
      <Copy muted>Sell an item or share a service with your community.</Copy>
      <Button icon="plus" onPress={() => user ? setCreating(true) : router.push('/login')}>Sell something</Button>
    </Panel>
    {(error || data?.failed) && <Notice message="Some recommendations could not load. You can still use the menu above." onRetry={reload} />}
    <Section title="Local shops" action="See all" onAction={() => browse({ tab: 'shops' })} />
    {loading && !data ? <Notice loading message="Loading shops…" /> : data?.shops.length ? data.shops.slice(0, 3).map(shop => <ShopCard key={shop.id} shop={shop} onPress={() => router.push({ pathname: '/shop/[userId]', params: { userId: shop.ownerId, shopId: shop.id } })} />) : <Copy muted>Local shops will appear here.</Copy>}
    <Section title="Discover something new" action="See all" onAction={() => browse({ tab: 'listings' })} />
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      {data?.listings.slice(0, 4).map(item => <ListingCard key={item.id} item={item} onOpen={item => router.push({ pathname: '/listing/[id]', params: { id: item.id } })} style={{ width: fontScale > 1.2 ? '100%' : '48%' }} />)}
    </View>
    <CreateListingModal visible={creating} onClose={() => setCreating(false)} onCreated={reload} />
  </Screen>;
}
