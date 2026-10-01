import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { listingsApi, shopsApi } from '../../src/api/client';
import { useCart } from '../../src/store/CartProvider';
import ListingDetailSheet from '../../src/components/listings/ListingDetailSheet';
import CreateListingModal from '../../src/components/listings/CreateListingModal';
import { LISTING_CATEGORIES, categoryLabel, errorMessage, money } from '../../src/utils/marketplace';
import { mediaUrl } from '../../src/utils/media';

const LIME = '#CDFF00';

export default function ExploreScreen() {
  const router = useRouter();
  const { items } = useCart();
  const [listings, setListings] = useState([]);
  const [shops, setShops] = useState([]);
  const [tab, setTab] = useState('listings');
  const [category, setCategory] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [creating, setCreating] = useState(false);
  const request = useRef(0);

  const load = useCallback(async () => {
    const id = ++request.current;
    setLoading(true); setError('');
    try {
      const response = tab === 'shops' ? await shopsApi.browse() : await listingsApi.browse({ type: category || undefined, q: query.trim() || undefined, sort: 'latest' });
      if (id !== request.current) return;
      if (!Array.isArray(response.data)) throw new Error('Unexpected response');
      if (tab === 'shops') setShops(response.data); else setListings(response.data);
    } catch (failure) {
      if (id === request.current) { setError(errorMessage(failure, 'Could not load Explore. Please try again.')); setListings([]); setShops([]); }
    } finally { if (id === request.current) { setLoading(false); setRefreshing(false); } }
  }, [category, query, tab]);

  useEffect(() => {
    const timer = setTimeout(load, 300);
    return () => { clearTimeout(timer); request.current += 1; };
  }, [load]);

  const rows = tab === 'shops' ? shops.filter(shop => `${shop.name} ${shop.category} ${shop.city}`.toLowerCase().includes(query.trim().toLowerCase())) : listings;
  const openShop = (shop) => router.push({ pathname: '/shop/[userId]', params: { userId: shop.ownerId, shopId: shop.id } });
  return <SafeAreaView edges={['top']} style={s.screen}>
    <View style={s.header}>
      <View><Text style={s.title}>Explore</Text><Text style={s.muted}>Find your next local favourite.</Text></View>
      <TouchableOpacity style={s.icon} onPress={() => router.push('/cart')} accessibilityLabel={`Cart, ${items.reduce((sum, item) => sum + item.quantity, 0)} items`}>
        <Feather name="shopping-bag" size={23} color="#FFF" />{items.length > 0 && <Text style={s.count}>{items.reduce((sum, item) => sum + item.quantity, 0)}</Text>}
      </TouchableOpacity>
    </View>
    <View style={s.search}><Feather name="search" size={19} color="#999" /><TextInput style={s.searchInput} accessibilityLabel="Search Explore" placeholder="Search listings and shops" placeholderTextColor="#888" value={query} onChangeText={setQuery} returnKeyType="search" />
      {!!query && <TouchableOpacity style={s.icon} onPress={() => setQuery('')} accessibilityLabel="Clear search"><Feather name="x" size={20} color="#FFF" /></TouchableOpacity>}
    </View>
    <View style={s.tabs}>{['listings', 'shops'].map(value => <TouchableOpacity key={value} style={[s.tab, tab === value && s.tabActive]} onPress={() => setTab(value)} accessibilityRole="tab" accessibilityState={{ selected: tab === value }}><Text style={[s.tabText, tab === value && { color: '#FFF' }]}>{value === 'listings' ? 'Listings' : 'Shops'}</Text></TouchableOpacity>)}</View>
    {tab === 'listings' && <View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filters}>
      {[{ key: '', label: 'All' }, ...LISTING_CATEGORIES].map(value => <TouchableOpacity key={value.key} style={[s.chip, category === value.key && s.chipActive]} onPress={() => setCategory(value.key)} accessibilityRole="button" accessibilityState={{ selected: category === value.key }}><Text style={[s.chipText, category === value.key && { color: '#050505' }]}>{value.label}</Text></TouchableOpacity>)}
    </ScrollView></View>}
    <FlatList data={loading && !refreshing ? [] : rows} keyExtractor={item => String(item.id)} keyboardShouldPersistTaps="handled" contentContainerStyle={s.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={LIME} />}
      ListEmptyComponent={<View style={s.empty}>{loading ? <ActivityIndicator color={LIME} /> : <><Feather name={error ? 'wifi-off' : 'search'} size={28} color="#AAA" /><Text style={s.emptyTitle}>{error || 'Nothing here yet'}</Text><Text style={s.muted}>{error ? 'Your live listings will appear when the connection returns.' : 'Try another category or search.'}</Text>{!!error && <TouchableOpacity style={s.retry} onPress={load}><Text style={s.chipText}>Try again</Text></TouchableOpacity>}</>}</View>}
      renderItem={({ item }) => tab === 'shops' ? <TouchableOpacity style={s.row} onPress={() => openShop(item)}>
        <View style={s.avatar}>{item.ownerAvatarUrl ? <Image source={{ uri: mediaUrl(item.ownerAvatarUrl) }} style={s.avatarImage} /> : <Feather name={item.appointmentBased ? 'scissors' : 'shopping-bag'} size={22} color={LIME} />}</View>
        <View style={s.body}><Text style={s.seller}>{item.name}</Text><Text style={s.muted}>{item.businessType?.replaceAll('_', ' ')}{item.city ? ` · ${item.city}` : ''}</Text><Text style={s.description}>{item.tagline || item.description}</Text><Text style={s.link}>{item.appointmentBased ? 'View services & appointments' : 'Shop products'} →</Text></View>
      </TouchableOpacity> : <TouchableOpacity style={s.row} onPress={() => setSelected(item)} activeOpacity={0.8}>
        <View style={s.avatar}>{item.sellerAvatarUrl ? <Image source={{ uri: mediaUrl(item.sellerAvatarUrl) }} style={s.avatarImage} /> : <Text style={s.initial}>{(item.sellerName || '?')[0]}</Text>}</View>
        <View style={s.body}>
          <View style={s.byline}><Text style={s.seller}>{item.sellerName || 'Seller'}</Text><Text style={s.muted}>{categoryLabel(item.listingType)}</Text></View>
          <Text style={s.listingTitle}>{item.title}</Text>
          {!!item.description && <Text style={s.description} numberOfLines={3}>{item.description}</Text>}
          {!!item.mediaUrls?.[0] && <Image source={{ uri: mediaUrl(item.mediaUrls[0]) }} style={s.photo} resizeMode="cover" />}
          <View style={s.byline}><Text style={s.price}>{money(item.price, item.currency)}</Text>{!!item.locationCity && <Text style={s.muted}>{item.locationCity}</Text>}</View>
          <Text style={s.link}>View listing{item.negotiable ? ' · Open to offers' : ''} →</Text>
        </View>
      </TouchableOpacity>} />
    <TouchableOpacity style={s.compose} onPress={() => setCreating(true)} accessibilityLabel="Add listing"><Feather name="plus" size={22} color="#050505" /><Text style={s.composeText}>Add listing</Text></TouchableOpacity>
    <ListingDetailSheet listing={selected} visible={!!selected} onClose={() => setSelected(null)} />
    <CreateListingModal visible={creating} onClose={() => setCreating(false)} onCreated={load} />
  </SafeAreaView>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#080808' }, header: { paddingHorizontal: 20, paddingVertical: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, title: { color: '#FFF', fontSize: 30, fontWeight: '800', marginBottom: 4 }, muted: { color: '#AAA', fontSize: 12, lineHeight: 18 },
  icon: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }, count: { color: '#050505', backgroundColor: LIME, borderRadius: 10, paddingHorizontal: 5, position: 'absolute', right: 0, top: 0, fontSize: 12, fontWeight: '700' },
  search: { marginHorizontal: 20, borderRadius: 14, backgroundColor: '#1A1A1A', paddingLeft: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }, searchInput: { flex: 1, minHeight: 48, color: '#FFF', fontSize: 16 }, tabs: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#2A2A2A', marginTop: 12 }, tab: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderColor: 'transparent' }, tabActive: { borderColor: '#FFF' }, tabText: { color: '#888', fontSize: 15, fontWeight: '700' },
  filters: { padding: 16, gap: 8 }, chip: { minHeight: 44, paddingHorizontal: 16, justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: '#444' }, chipActive: { backgroundColor: LIME, borderColor: LIME }, chipText: { color: '#EEE', fontWeight: '600' },
  list: { paddingBottom: 180, flexGrow: 1 }, row: { flexDirection: 'row', padding: 18, gap: 12, borderBottomWidth: 1, borderColor: '#242424' }, avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#232323', alignItems: 'center', justifyContent: 'center' }, avatarImage: { width: 38, height: 38, borderRadius: 19 }, initial: { color: '#DDD', fontSize: 17, fontWeight: '600' }, body: { flex: 1, gap: 9 }, byline: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 }, seller: { color: '#FFF', fontSize: 14, fontWeight: '700' }, listingTitle: { color: '#FFF', fontSize: 17, fontWeight: '600', lineHeight: 24 }, description: { color: '#CCC', fontSize: 14, lineHeight: 21 }, photo: { width: '100%', aspectRatio: 1, borderRadius: 16, backgroundColor: '#181818' }, price: { color: '#FFF', fontSize: 16, fontWeight: '700' }, link: { color: LIME, fontSize: 13, paddingVertical: 5 },
  empty: { alignItems: 'center', padding: 32, gap: 12 }, emptyTitle: { color: '#EEE', textAlign: 'center', fontSize: 16 }, retry: { padding: 16, borderWidth: 1, borderColor: '#555', borderRadius: 12 }, compose: { position: 'absolute', bottom: 100, right: 20, minHeight: 52, paddingHorizontal: 18, borderRadius: 26, backgroundColor: LIME, flexDirection: 'row', alignItems: 'center', gap: 8 }, composeText: { color: '#050505', fontSize: 15, fontWeight: '700' },
});
