import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { Feather } from '@expo/vector-icons';
import { bookingsApi, listingsApi, notificationsApi, shopsApi, ticketsApi } from '../src/api/client';
import { useRemote } from '../src/hooks/useRemote';
import { Button, Copy, Notice, Panel, Screen, Section, usePalette } from '../src/components/native/Kit';
import CreateListingModal from '../src/components/listings/CreateListingModal';
import { ticketIsPast } from '../src/utils/tickets';
import { money } from '../src/utils/marketplace';

export default function Dashboard() {
  const user = useSelector(s => s.auth.user);
  const router = useRouter();
  const c = usePalette();
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState('overview');
  const fetcher = useCallback(async () => {
    const names = ['bookings', 'orders', 'sales', 'listings', 'tickets', 'activity'];
    const results = await Promise.allSettled([bookingsApi.getAll(), shopsApi.orders(), shopsApi.sales(), listingsApi.getMyListings(), ticketsApi.my(), notificationsApi.getAll()]);
    return Object.fromEntries(results.map((result, i) => [names[i], result.status === 'fulfilled' && Array.isArray(result.value.data) ? result.value.data : null]));
  }, []);
  const { data, loading, error, reload } = useRemote(fetcher);
  const buying = [...(data?.bookings || []).filter(b => b.role !== 'seller'), ...(data?.orders || [])];
  const selling = [...(data?.bookings || []).filter(b => b.role === 'seller'), ...(data?.sales || [])];
  const needsReply = (data?.bookings || []).filter(b => ['INQUIRED', 'NEGOTIATING'].includes(b.status) && (b.lastOfferBy || (b.status === 'NEGOTIATING' ? b.sellerId : b.buyerId)) !== user?.id);
  const openOrders = view => router.push({ pathname: '/profile/orders', params: { view } });
  return <Screen back title="Dashboard" refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={c.accent} />}>
    <Section eyebrow="Your workspace" title={'Good to see you, ' + (user?.fullName?.split(' ')[0] || 'there') + '.'} subtitle="Your orders, shop and next opportunity. All in one place." />
    <Button icon="plus" onPress={() => setCreating(true)}>Add listing</Button>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{['overview', 'buying', 'selling', 'activity'].map(value => <Button key={value} secondary={tab !== value} onPress={() => setTab(value)}>{value[0].toUpperCase() + value.slice(1)}</Button>)}</ScrollView>
    {loading && !data && <Notice loading message="Loading your workspace…" />}
    {(error || (data && Object.values(data).some(value => value === null))) && <Notice message={error || 'Some workspace information is unavailable. Missing counts are not shown as zero.'} onRetry={reload} />}
    {tab === 'overview' && <>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>{[
        ['Needs reply', data?.bookings ? needsReply.length : '—', 'message-circle', () => openOrders('buying')],
        ['Your purchases', data?.bookings && data?.orders ? buying.length : '—', 'package', () => openOrders('buying')],
        ['Your sales', data?.bookings && data?.sales ? selling.length : '—', 'shopping-bag', () => openOrders('selling')],
        ['Upcoming tickets', data?.tickets ? data.tickets.filter(t => !ticketIsPast(t)).length : '—', 'calendar', () => router.push('/tickets')],
      ].map(([label, count, icon, action]) => <Pressable key={label} accessibilityRole="button" onPress={action} style={{ width: '47%', flexGrow: 1 }}><Panel><Feather name={icon} size={22} color={c.accent} /><Copy heading style={{ fontSize: 32, lineHeight: 40 }}>{count}</Copy><Copy muted style={{ fontSize: 12 }}>{label}</Copy></Panel></Pressable>)}</View>
      <Section title="Make your next move" />
      {[
        ['Bookings & orders', 'Track shipping, approve receipt or report a problem.', 'package', () => openOrders('buying')],
        ['Seller workspace', 'Reply to offers, update delivery and manage sold goods.', 'briefcase', () => openOrders('selling')],
        ['Bank & payouts', 'Connect your bank account and view payout status.', 'credit-card', () => router.push('/profile/bank')],
        ['Your listings', 'See your marketplace products, services and events.', 'grid', () => router.push('/profile/listings')],
        ['Your tickets', 'Show your code at the door and see upcoming events.', 'calendar', () => router.push('/tickets')],
        ['Your reviews', 'Read feedback and rate completed transactions.', 'star', () => router.push('/profile/reviews')],
        ['Review activity', 'Read your latest account updates and notifications.', 'activity', () => setTab('activity')],
      ].map(([title, text, icon, action]) => <Pressable key={title} accessibilityRole="button" accessibilityLabel={title} onPress={action}><Panel style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}><Feather name={icon} size={22} color={c.accent} /><View style={{ flex: 1 }}><Copy heading>{title}</Copy><Copy muted style={{ fontSize: 12 }}>{text}</Copy></View><Feather name="chevron-right" size={20} color={c.muted} /></Panel></Pressable>)}
      {!!data?.listings?.some(l => l.listingType === 'EVENT') && <><Section title="Your event doors" />{data.listings.filter(l => l.listingType === 'EVENT').map(event => <Panel key={event.id}><Copy heading>{event.title}</Copy><Button secondary icon="camera" onPress={() => router.push('/events/' + event.id + '/door')}>Guest list & scanner</Button></Panel>)}</>}
      <Panel><Copy heading>From purchase to received.</Copy><Copy muted>Open Bookings & orders to check delivery, tracking and receipt approval. Report a problem there if something is wrong. A seller’s delivery update alone does not approve their payout.</Copy></Panel>
    </>}
    {(tab === 'buying' || tab === 'selling') && <><Section title={tab === 'buying' ? 'Your order centre' : 'Your seller workspace'} subtitle={tab === 'buying' ? 'Track your goods, check delivery and approve receipt.' : 'Respond to offers and keep your buyers updated.'} /><Button onPress={() => openOrders(tab)}>Open bookings & order actions</Button>{(tab === 'buying' ? buying : selling).map((order, index) => <Pressable key={String(order.id) + index} onPress={() => openOrders(tab)}><Panel><Copy heading>{order.listingTitle || order.shopName || 'Store order'}</Copy><Copy muted>{String(order.status || 'Pending').replaceAll('_', ' ')}</Copy>{order.totalAmount != null && <Copy>{money(order.totalAmount, order.currency)}</Copy>}<Copy style={{ color: c.accent }}>View order →</Copy></Panel></Pressable>)}{!(tab === 'buying' ? buying : selling).length && <Notice message="No orders to show in this view." />}</>}
    {tab === 'activity' && <><Section title="Recent activity" /><Button secondary onPress={() => router.push('/notifications')}>Open notifications</Button>{(data?.activity || []).map(item => <Panel key={item.id}><Copy heading>{item.title || item.type?.replaceAll('_', ' ') || 'Update'}</Copy><Copy>{item.message || item.body || item.content}</Copy></Panel>)}{!data?.activity?.length && <Notice message="No activity to show yet." />}</>}
    <CreateListingModal visible={creating} onClose={() => setCreating(false)} onCreated={reload} />
  </Screen>;
}
