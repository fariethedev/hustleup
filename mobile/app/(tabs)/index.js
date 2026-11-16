import React, { useState } from 'react';
import { ImageBackground, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { listingsApi, shopsApi } from '../../src/api/client';
import { useRemote } from '../../src/hooks/useRemote';
import { Button, Copy, Notice, Screen, Section, usePalette } from '../../src/components/native/Kit';
import { ListingCard, ShopCard } from '../../src/components/native/DiscoveryCards';
import CreateListingModal from '../../src/components/listings/CreateListingModal';

async function loadHome() {
  const results = await Promise.allSettled([listingsApi.getRecommended(), shopsApi.browse(), listingsApi.browse({ type: 'EVENT' })]);
  const read = i => results[i].status === 'fulfilled' && Array.isArray(results[i].value.data) ? results[i].value.data : [];
  return { listings: read(0), shops: read(1), events: read(2), failed: results.some(r => r.status === 'rejected') };
}

const categories = [
  { label: 'Fashion', icon: 'tag', category: 'FASHION' },
  { label: 'Food', icon: 'coffee', category: 'FOOD' },
  { label: 'Beauty', icon: 'scissors', category: 'HAIR_BEAUTY' },
  { label: 'Events', icon: 'calendar', tab: 'listings' },
];

function CategoryChip({ item, onPress }) {
  const c = usePalette();
  return <Pressable onPress={onPress} style={{ minWidth: 80, alignItems: 'center', gap: 8 }}>
    <View style={{ width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: c.card, borderWidth: 1, borderColor: c.line }}>
      <Feather name={item.icon} size={21} color={c.accent} />
    </View>
    <Copy style={{ fontSize: 11 }}>{item.label}</Copy>
  </Pressable>;
}

export default function Home() {
  const router = useRouter();
  const c = usePalette();
  const user = useSelector(s => s.auth.user);
  const [creating, setCreating] = useState(false);
  const { data, loading, error, reload } = useRemote(loadHome);
  const explore = params => router.push({ pathname: '/(tabs)/explore', params });
  const openListing = item => router.push({ pathname: '/listing/[id]', params: { id: item.id } });

  return <Screen showHeader={false} refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={c.accent} />}>
    <View style={{ gap: 22, paddingTop: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 }}>
        <View style={{ flex: 1 }}><Copy heading style={{ fontSize: 17 }}>Hustle<Copy style={{ color: c.accent, fontFamily: 'Montserrat_800ExtraBold', fontSize: 17 }}>Space</Copy></Copy><Copy muted style={{ fontSize: 12 }}>{user?.fullName ? `Welcome back, ${user.fullName.split(' ')[0]}` : 'Your community, in one place'}</Copy></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Add a listing" onPress={() => user ? setCreating(true) : router.push('/login')} style={{ minHeight: 44, paddingHorizontal: 14, borderRadius: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: c.accent }}><Feather name="plus" size={17} color={c.light ? '#FFF' : '#050505'} /><Copy style={{ color: c.light ? '#FFF' : '#050505', fontFamily: 'Poppins_600SemiBold', fontSize: 12 }}>Add listing</Copy></Pressable>
      </View>

      <ImageBackground source={{ uri: 'https://images.unsplash.com/photo-1744320911030-1ab998d994d7?auto=format&fit=crop&w=1200&q=80' }} imageStyle={{ borderRadius: 26 }} style={{ minHeight: 235, justifyContent: 'flex-end', overflow: 'hidden', backgroundColor: c.soft }}>
        <View style={{ padding: 20, paddingTop: 65, backgroundColor: '#050505A8', borderRadius: 26, gap: 9 }}>
          <Copy style={{ color: '#CDFF00', fontSize: 11, letterSpacing: 1 }}>DISCOVER. CREATE. GROW.</Copy>
          <Copy heading style={{ color: '#FFF', fontSize: 27, lineHeight: 33 }}>Find something good.</Copy>
          <Copy style={{ color: '#F0F0F0', fontSize: 13 }}>Explore independent shops, useful services and local events.</Copy>
          <Button onPress={() => explore({})} icon="compass" style={{ alignSelf: 'flex-start', marginTop: 4 }}>Explore marketplace</Button>
        </View>
      </ImageBackground>

      <View>
        <Section eyebrow="BROWSE YOUR WAY" title="What are you into?" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 17, paddingVertical: 3 }}>
          {categories.map(item => <CategoryChip key={item.label} item={item} onPress={() => explore(item.category ? { category: item.category, tab: 'listings' } : { tab: item.tab })} />)}
        </ScrollView>
      </View>

      {(error || data?.failed) && <Notice message={error || 'Some sections could not load. You can still browse what is available.'} onRetry={reload} />}

      {!!data?.shops.length && <View><Section eyebrow="COMMUNITY FAVOURITES" title="Shops to know" action="See all" onAction={() => explore({ tab: 'shops' })} /><ScrollView horizontal contentContainerStyle={{ gap: 14 }} showsHorizontalScrollIndicator={false}>{data.shops.slice(0, 8).map(shop => <View key={shop.id} style={{ width: 275 }}><ShopCard shop={shop} onPress={() => router.push({ pathname: '/shop/[userId]', params: { userId: shop.ownerId, shopId: shop.id } })} /></View>)}</ScrollView></View>}

      {!!data?.events.length && <View><Section eyebrow="SAVE THE DATE" title="Events near you" action="Browse" onAction={() => explore({ tab: 'listings', type: 'EVENT' })} /><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>{data.events.slice(0, 9).map(item => <ListingCard key={item.id} item={item} onOpen={openListing} style={{ width: 235 }} />)}</ScrollView></View>}

      <View><Section eyebrow="FRESH FINDS" title="Trending listings" action="View all" onAction={() => explore({ tab: 'listings' })} />
        {loading && !data ? <Notice loading message="Finding local favourites…" /> : data?.listings.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>{data.listings.slice(0, 10).map(item => <ListingCard key={item.id} item={item} onOpen={openListing} style={{ width: 235 }} />)}</ScrollView> : <Notice message="New listings will appear here as your community adds them." onRetry={error ? reload : undefined} />}
      </View>

    </View>
    <CreateListingModal visible={creating} onClose={() => setCreating(false)} onCreated={reload} />
  </Screen>;
}
