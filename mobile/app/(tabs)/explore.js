import React, { useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { listingsApi, shopsApi, usersApi } from '../../src/api/client';
import { useRemote } from '../../src/hooks/useRemote';
import { filterListings, normalized, storeListing } from '../../src/utils/discovery';
import { LISTING_CATEGORIES } from '../../src/utils/marketplace';
import { Copy, Notice, Screen, fonts, k, usePalette } from '../../src/components/native/Kit';
import { ListingCard, PersonCard, ShopCard } from '../../src/components/native/DiscoveryCards';
import CreateListingModal from '../../src/components/listings/CreateListingModal';
import ExploreFilters, { SORT_OPTIONS } from '../../src/components/native/ExploreFilters';
import { Feather } from '@expo/vector-icons';

async function loadExplore() {
  const results = await Promise.allSettled([listingsApi.browse({ sort: 'latest' }), shopsApi.browse(), usersApi.getAll()]);
  const read = i => results[i].status === 'fulfilled' && Array.isArray(results[i].value.data) ? results[i].value.data : [];
  const shops = read(1);
  return { listings: [...read(0), ...shops.flatMap(shop => (shop.products || []).map(product => storeListing(shop, product)))], shops, people: read(2), failed: results.map((r, i) => r.status === 'rejected' ? ['Listings', 'Shops', 'People'][i] : null).filter(Boolean) };
}
export default function Explore() {
  const params = useLocalSearchParams();
  return <ExploreContent key={String(params.tab || '') + String(params.category || '') + String(params.appointments || '')} initialTab={params.tab} initialCategory={params.category} appointmentsOnly={params.appointments === 'true'} />;
}
function ExploreContent({ initialTab, initialCategory, appointmentsOnly }) {
  const { fontScale } = useWindowDimensions();
  const columns = fontScale > 1.2 ? 1 : 2;
  const router = useRouter();
  const c = usePalette();
  const user = useSelector(s => s.auth.user);
  const { data, loading, error, reload } = useRemote(loadExplore);
  const [tab, setTab] = useState(['listings', 'shops', 'people'].includes(initialTab) ? initialTab : 'overview');
  const [category, setCategory] = useState(initialCategory || '');
  const [query, setQuery] = useState('');
  const [city, setCity] = useState('');
  const [sort, setSort] = useState('latest');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const listingFilters = tab === 'overview' || tab === 'listings';
  const activeFilters = [
    ...(listingFilters && category ? [{ label: LISTING_CATEGORIES.find(item => item.key === category)?.label || category, clear: () => setCategory('') }] : []),
    ...(city ? [{ label: city, clear: () => setCity('') }] : []),
    ...(listingFilters && sort !== 'latest' ? [{ label: SORT_OPTIONS.find(item => item[0] === sort)?.[1] || sort, clear: () => setSort('latest') }] : []),
  ];
  const [creating, setCreating] = useState(false);
  const listings = filterListings(data?.listings || [], { query, category, city, sort });
  const shops = (data?.shops || []).filter(s => (!appointmentsOnly || s.appointmentBased || ['BARBERSHOP', 'HAIR_SALON', 'NAIL_STUDIO', 'SPA_MASSAGE', 'TATTOO_PIERCING', 'FITNESS_TRAINING', 'TUTORING_LESSONS', 'REPAIR_SERVICES'].includes(s.businessType)) && normalized([s.name, s.description, s.city].join(' ')).includes(normalized(query)) && normalized(s.city).includes(normalized(city)));
  const people = (data?.people || []).filter(person => person.id !== user?.id && normalized([person.fullName, person.username, person.bio, person.city].join(' ')).includes(normalized(query)) && normalized(person.city).includes(normalized(city)));
  const sections = [];
  const group = (type, title, subtitle, items) => {
    sections.push({ id: type + '-heading', type: 'heading', title, subtitle, tab: type });
    if (!items.length) sections.push({ id: type + '-empty', type: 'empty' });
    if (type === 'listings') for (let i = 0; i < items.length; i += columns) sections.push({ id: type + i, type, items: items.slice(i, i + columns) });
    else items.forEach(item => sections.push({ id: type + item.id, type, item }));
  };
  if (tab === 'overview' || tab === 'listings') group('listings', 'Products & services', 'Find something you need', tab === 'overview' ? listings.slice(0, 12) : listings);
  if (tab === 'overview' || tab === 'shops') group('shops', 'Local shops', 'Browse products and book services', tab === 'overview' ? shops.slice(0, 3) : shops);
  if (tab === 'overview' || tab === 'people') group('people', 'People to know', 'Meet the people making things happen in your community', tab === 'overview' ? people.slice(0, 4) : people);
  return <Screen scroll={false}>
    <FlatList data={loading && !data ? [] : sections} keyExtractor={row => row.id} keyboardShouldPersistTaps="handled" contentContainerStyle={k.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={c.accent} />}
      ListHeaderComponent={<View style={{ gap: 12 }}>
        {/* Compact top row, like Home: title + round filter and add buttons */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 }}>
          <View style={{ flex: 1 }}>
            <Copy heading style={{ fontSize: 24, lineHeight: 30 }}>{appointmentsOnly ? 'Book an appointment' : 'Browse'}</Copy>
            <Copy muted style={{ fontSize: 15 }}>Shops, services, events and people near you</Copy>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={`Filters${activeFilters.length ? `, ${activeFilters.length} active` : ''}`} onPress={() => setFiltersOpen(true)}
            style={({ pressed }) => ({ width: 48, height: 48, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: c.purple, transform: [{ scale: pressed ? 0.94 : 1 }] })}>
            <Feather name="sliders" size={18} color="#FFF" />
            {!!activeFilters.length && <View style={{ position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: c.accent, borderWidth: 2, borderColor: c.bg, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#111', fontSize: 9, fontWeight: '900' }}>{activeFilters.length}</Text></View>}
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Add a listing" onPress={() => user ? setCreating(true) : router.push('/login')}
            style={({ pressed }) => ({ width: 48, height: 48, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accent, transform: [{ scale: pressed ? 0.94 : 1 }] })}>
            <Feather name="plus" size={22} color={c.light ? '#FFF' : '#050505'} />
          </Pressable>
        </View>

        {/* Search pill */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, paddingHorizontal: 14, borderRadius: 22, backgroundColor: c.card, borderWidth: 1, borderColor: c.line }}>
          <Feather name="search" size={16} color={c.muted} />
          <TextInput accessibilityLabel="Search listings, shops and people" placeholder="Search listings, shops and people" placeholderTextColor={c.muted}
            style={{ flex: 1, color: c.text, fontFamily: fonts.body, fontSize: 17, paddingVertical: 8 }} value={query} onChangeText={setQuery} returnKeyType="search" />
          {!!query && <Pressable accessibilityLabel="Clear search" onPress={() => setQuery('')} hitSlop={8}><Feather name="x" size={16} color={c.muted} /></Pressable>}
        </View>

        {/* Small pill tabs */}
        <View accessibilityRole="tablist" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {[['overview', 'All'], ['listings', 'Listings'], ['shops', 'Shops'], ['people', 'People']].map(([value, label]) => (
            <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: value === tab }} onPress={() => setTab(value)}
              style={{ minHeight: 48, paddingHorizontal: 14, borderRadius: 16, justifyContent: 'center', backgroundColor: value === tab ? c.accent : c.card, borderWidth: 1, borderColor: value === tab ? c.accent : c.line }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: value === tab ? (c.light ? '#FFF' : '#111') : c.muted }}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Quick category chips */}
        {listingFilters && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {[{ key: '', label: 'All', icon: 'grid' }, ...LISTING_CATEGORIES].map(item => {
            const on = category === item.key;
            return <Pressable key={item.key || 'all'} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => setCategory(item.key)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 48, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1, borderColor: on ? c.purple : c.line, backgroundColor: on ? c.purpleSoft : 'transparent' }}>
              <Feather name={item.icon} size={13} color={on ? c.purple : c.muted} />
              <Text style={{ fontSize: 15, fontWeight: '600', color: on ? c.purple : c.text }}>{item.label}</Text>
            </Pressable>;
          })}
        </ScrollView>}

        {!!activeFilters.filter(f => f.label !== (LISTING_CATEGORIES.find(item => item.key === category)?.label)).length && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>{activeFilters.filter(f => f.label !== (LISTING_CATEGORIES.find(item => item.key === category)?.label)).map(item => <Pressable key={item.label} accessibilityRole="button" accessibilityLabel={'Remove filter: ' + item.label} onPress={item.clear} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 48, paddingHorizontal: 10, borderRadius: 15, backgroundColor: c.soft }}><Text numberOfLines={1} style={{ fontSize: 15, color: c.text, maxWidth: 160 }}>{item.label}</Text><Feather name="x" size={12} color={c.muted} /></Pressable>)}</ScrollView>}
        {(error || data?.failed.length > 0) && <Notice message={error || data.failed.join(', ') + ' could not load. Other sections remain available.'} onRetry={reload} />}
        {loading && !data && <Notice loading message="Discovering your community…" />}
      </View>}
      renderItem={({ item: row }) => row.type === 'heading' ? <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: 14, marginBottom: 2 }}>
          <View style={{ flex: 1 }}><Copy heading style={{ fontSize: 18, lineHeight: 24 }}>{row.title}</Copy><Copy muted style={{ fontSize: 15 }}>{row.subtitle}</Copy></View>
          {tab === 'overview' && <Pressable onPress={() => setTab(row.tab)} hitSlop={8}><Text style={{ color: c.purple, fontSize: 15, fontWeight: '700' }}>See all →</Text></Pressable>}
        </View> : row.type === 'empty' ? <Notice message="Nothing matches yet. Try another category, city or search." /> : row.type === 'listings' ? <View style={{ flexDirection: 'row', alignItems: 'stretch', gap: 12 }}>{row.items.map(item => <ListingCard key={item.id} item={item} onOpen={item => router.push({ pathname: '/listing/[id]', params: { id: item.id } })} style={{ flex: 1 }} />)}{row.items.length === 1 && <View style={{ flex: 1 }} />}</View> : row.type === 'shops' ? <ShopCard shop={row.item} onPress={() => router.push({ pathname: '/shop/[userId]', params: { userId: row.item.ownerId, shopId: row.item.id } })} /> : row.type === 'people' ? <PersonCard person={row.item} onPress={() => router.push('/profile/' + row.item.id)} /> : null} />
    {filtersOpen && <ExploreFilters category={category} city={city} sort={sort} listingFilters={listingFilters} onClose={() => setFiltersOpen(false)} onApply={draft => { setCategory(draft.category); setCity(draft.city); setSort(draft.sort); setFiltersOpen(false); }} />}
    <CreateListingModal visible={creating} onClose={() => setCreating(false)} onCreated={reload} />
  </Screen>;
}
