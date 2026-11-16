import React, { useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { listingsApi, shopsApi, usersApi } from '../../src/api/client';
import { useRemote } from '../../src/hooks/useRemote';
import { filterListings, normalized, storeListing } from '../../src/utils/discovery';
import { LISTING_CATEGORIES } from '../../src/utils/marketplace';
import { Button, Copy, Notice, Panel, Screen, Section, k, usePalette } from '../../src/components/native/Kit';
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
  return <ExploreContent key={String(params.tab || '') + String(params.category || '')} initialTab={params.tab} initialCategory={params.category} />;
}
function ExploreContent({ initialTab, initialCategory }) {
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
  const shops = (data?.shops || []).filter(s => normalized([s.name, s.description, s.city].join(' ')).includes(normalized(query)) && normalized(s.city).includes(normalized(city)));
  const people = (data?.people || []).filter(person => person.id !== user?.id && normalized([person.fullName, person.username, person.bio, person.city].join(' ')).includes(normalized(query)) && normalized(person.city).includes(normalized(city)));
  const sections = [];
  const group = (type, title, subtitle, items) => {
    sections.push({ id: type + '-heading', type: 'heading', title, subtitle });
    if (!items.length) sections.push({ id: type + '-empty', type: 'empty' });
    if (type === 'listings') for (let i = 0; i < items.length; i += 2) sections.push({ id: type + i, type, items: items.slice(i, i + 2) });
    else items.forEach(item => sections.push({ id: type + item.id, type, item }));
  };
  if (tab === 'overview' || tab === 'listings') group('listings', 'Discover something good', 'Fresh finds from the student community', tab === 'overview' ? listings.slice(0, 12) : listings);
  if (tab === 'overview' || tab === 'shops') group('shops', 'Shops with a point of view', 'Small businesses worth getting to know', tab === 'overview' ? shops.slice(0, 3) : shops);
  if (tab === 'overview' || tab === 'people') group('people', 'People to know', 'Meet the people making things happen in your community', tab === 'overview' ? people.slice(0, 4) : people);
  const input = [k.input, { color: c.text, borderColor: c.line, backgroundColor: c.card }];
  return <Screen scroll={false}>
    <FlatList data={loading && !data ? [] : sections} keyExtractor={row => row.id} keyboardShouldPersistTaps="handled" contentContainerStyle={k.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={c.accent} />}
      ListHeaderComponent={<View style={{ gap: 14 }}>
        <Section eyebrow="The student marketplace" title="A little discovery goes a long way." subtitle="Find your next favourite. Meet the people behind it." />
        <Button icon="plus" onPress={() => user ? setCreating(true) : router.push('/login')}>Add listing</Button>
        <TextInput accessibilityLabel="Search listings, shops and people" placeholder="Search listings, shops and people" placeholderTextColor={c.muted} style={input} value={query} onChangeText={setQuery} returnKeyType="search" />
        <View accessibilityRole="tablist" style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor: c.line }}>{['overview', 'listings', 'shops', 'people'].map(value => <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: value === tab }} onPress={() => setTab(value)} style={{ flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderColor: value === tab ? c.accent : 'transparent' }}><Copy style={{ fontSize: 12, color: value === tab ? c.accent : c.muted }}>{value[0].toUpperCase() + value.slice(1)}</Copy></Pressable>)}</View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><Copy muted style={{ flex: 1, fontSize: 12 }}>{listingFilters ? 'Categories, location & sort' : 'Filter by location'}</Copy><Button secondary icon="sliders" onPress={() => setFiltersOpen(true)}>Filters{activeFilters.length ? ' (' + activeFilters.length + ')' : ''}</Button></View>
        {!!activeFilters.length && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{activeFilters.map(item => <Pressable key={item.label} accessibilityRole="button" accessibilityLabel={'Remove filter: ' + item.label} onPress={item.clear} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingHorizontal: 12, borderRadius: 12, backgroundColor: c.soft }}><Copy numberOfLines={1} style={{ fontSize: 12, maxWidth: 160 }}>{item.label}</Copy><Feather name="x" size={14} color={c.muted} /></Pressable>)}</ScrollView>}
        {(error || data?.failed.length > 0) && <Notice message={error || data.failed.join(', ') + ' could not load. Other sections remain available.'} onRetry={reload} />}
        {loading && !data && <Notice loading message="Discovering your community…" />}
      </View>}
      renderItem={({ item: row }) => row.type === 'heading' ? <Section title={row.title} subtitle={row.subtitle} /> : row.type === 'empty' ? <Notice message="Nothing matches yet. Try another category, city or search." /> : row.type === 'listings' ? <View style={{ flexDirection: 'row', alignItems: 'stretch', gap: 12 }}>{row.items.map(item => <ListingCard key={item.id} item={item} onOpen={item => router.push({ pathname: '/listing/[id]', params: { id: item.id } })} style={{ flex: 1 }} />)}{row.items.length === 1 && <View style={{ flex: 1 }} />}</View> : row.type === 'shops' ? <ShopCard shop={row.item} onPress={() => router.push({ pathname: '/shop/[userId]', params: { userId: row.item.ownerId, shopId: row.item.id } })} /> : row.type === 'people' ? <PersonCard person={row.item} onPress={() => router.push('/profile/' + row.item.id)} /> : null} />
    {filtersOpen && <ExploreFilters category={category} city={city} sort={sort} listingFilters={listingFilters} onClose={() => setFiltersOpen(false)} onApply={draft => { setCategory(draft.category); setCity(draft.city); setSort(draft.sort); setFiltersOpen(false); }} />}
    <CreateListingModal visible={creating} onClose={() => setCreating(false)} onCreated={reload} />
  </Screen>;
}
