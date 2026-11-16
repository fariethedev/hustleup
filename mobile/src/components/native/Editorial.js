import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Image, RefreshControl, ScrollView, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { jobsApi, newsApi } from '../../api/client';
import { useRemote } from '../../hooks/useRemote';
import { Button, Copy, Notice, Panel, Screen, Section, k, usePalette } from './Kit';
import { mediaUrl } from '../../utils/media';

export const newsCategories = [['lublin', 'Lublin'], ['students', 'Student life'], ['immigration', 'Visas & residence'], ['housing', 'Housing'], ['poland', 'Poland'], ['opportunity', 'Opportunities'], ['event', 'Events'], ['regulation', 'Regulation'], ['business', 'Business'], ['tech', 'Tech']];
export const jobCategories = [['hospitality', 'Hospitality & Food'], ['retail', 'Retail & Sales'], ['warehouse', 'Warehouse & Logistics'], ['factory', 'Industrial & Factory'], ['delivery', 'Delivery & Driving'], ['it', 'IT & Development'], ['office', 'Office & Admin'], ['support', 'Customer Support'], ['language', 'Languages & Translation'], ['teaching', 'Education & Tutoring'], ['babysitting', 'Family & Childcare'], ['cleaning', 'Cleaning & Facilities'], ['healthcare', 'Healthcare & Nursing'], ['creative', 'Creative & Media'], ['other', 'Everything else']];
export async function openSource(url) {
  try { const parsed = new URL(url); if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error(); await WebBrowser.openBrowserAsync(parsed.href); }
  catch { Alert.alert('Cannot open source', 'This source link is unavailable.'); }
}
export default function Editorial({ kind }) {
  const news = kind === 'news';
  const router = useRouter();
  const c = usePalette();
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [page, setPage] = useState(0);
  const [remote, setRemote] = useState(false);
  const fetcher = useCallback(async () => (await (news ? newsApi.feed : jobsApi.board)({ q: search || undefined, category, page, size: 20 })).data, [news, search, category, page]);
  const { data, loading, error, reload } = useRemote(fetcher);
  const rows = (data?.content || []).filter(item => news || !remote || item.remote);
  const input = [k.input, { color: c.text, backgroundColor: c.card, borderColor: c.line, flex: 1 }];
  return <Screen back title={news ? 'Campus News' : 'Jobs & Gigs'} scroll={false}><FlatList data={rows} keyExtractor={item => String(item.id)} contentContainerStyle={k.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={c.accent} />}
    ListHeaderComponent={<View style={{ gap: 14 }}><Section eyebrow={news ? 'News' : 'Jobs'} title={news ? 'Stay curious. Stay ahead.' : 'Make your next move.'} subtitle={news ? 'Ideas, stories and useful perspectives for your next move. Explore the headlines, then make time for a deeper read.' : 'Find a first role, a flexible gig, or the next step. Clear details, real opportunities, and a direct way to apply.'} />
      <View style={{ flexDirection: 'row', gap: 8 }}><TextInput accessibilityLabel={news ? 'Search news' : 'Search jobs'} placeholder={news ? 'Search stories' : 'Search roles or companies'} value={query} onChangeText={setQuery} style={input} placeholderTextColor={c.muted} returnKeyType="search" onSubmitEditing={() => { setPage(0); setSearch(query.trim()); }} /><Button onPress={() => { setPage(0); setSearch(query.trim()); }}>Search</Button></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{[['all', 'All'], ...(news ? newsCategories : jobCategories)].map(([id, name]) => <Button key={id} secondary={id !== category} onPress={() => { setPage(0); setCategory(id); }}>{name}</Button>)}</ScrollView>
      {!news && <View style={{ gap: 10 }}><Button secondary={!remote} onPress={() => setRemote(value => !value)}>{remote ? 'Remote only · On' : 'Remote only · Off'}</Button><Button secondary onPress={() => router.push('/jobs/applications')}>My applications</Button></View>}
      {!!error && <Notice message={error} onRetry={reload} />}
    </View>}
    ListEmptyComponent={<Notice loading={loading} message={loading ? 'Loading…' : 'No results in this view. Try another search or category.'} />}
    renderItem={({ item }) => <Panel style={{ padding: 0, overflow: 'hidden' }}>{(item.coverImageUrl || item.mediaUrls?.[0]) && <Image source={{ uri: mediaUrl(item.coverImageUrl || item.mediaUrls[0]) }} style={{ width: '100%', aspectRatio: 1.6 }} />}<View style={{ padding: 18, gap: 10 }}><Copy style={{ color: c.accent, fontSize: 11 }}>{news ? item.category : [item.jobType?.replaceAll('_', ' '), item.remote ? 'Remote' : item.location].filter(Boolean).join(' · ')}</Copy><Copy heading style={{ fontSize: 23, lineHeight: 29 }}>{item.title}</Copy><Copy muted>{news ? item.publisherName || item.sourceName : item.companyName}</Copy><Copy numberOfLines={3}>{news ? item.summary : item.description}</Copy><Button secondary onPress={() => router.push('/' + kind + '/' + item.id)}>{news ? 'Read story →' : 'View role →'}</Button></View></Panel>}
    ListFooterComponent={data && <View style={{ flexDirection: 'row', gap: 12 }}><Button secondary disabled={page === 0 || loading} onPress={() => setPage(value => value - 1)}>Previous</Button><Copy muted style={{ flex: 1, textAlign: 'center', paddingTop: 12 }}>Page {page + 1}</Copy><Button secondary disabled={loading || page + 1 >= data.totalPages} onPress={() => setPage(value => value + 1)}>Next</Button></View>} /></Screen>;
}
