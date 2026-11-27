import React, { useCallback, useState } from 'react';
import { Image, Pressable, RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { bookingsApi, listingsApi, notificationsApi, payoutsApi, shopsApi, swapsApi, ticketsApi } from '../src/api/client';
import { useRemote } from '../src/hooks/useRemote';
import { Copy, fonts, LIME, Notice, Screen, usePalette } from '../src/components/native/Kit';
import { Group, Row } from '../src/components/native/GroupedList';
import CreateListingModal from '../src/components/listings/CreateListingModal';
import { ticketIsPast } from '../src/utils/tickets';
import { money } from '../src/utils/marketplace';
import { mediaUrl } from '../src/utils/media';

const SALE_DONE = ['COMPLETED'];
const SHOP_PAID = ['PAID', 'FULFILLED'];

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

/** Round quick-action button under the earnings card. */
function Action({ icon, label, onPress, primary }) {
  const c = usePalette();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => ({ flex: 1, alignItems: 'center', gap: 7, opacity: pressed ? 0.75 : 1 })}>
      <View style={{ width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: primary ? LIME : c.card, borderWidth: primary ? 0 : 1, borderColor: c.line }}>
        <Feather name={icon} size={21} color={primary ? '#111' : c.text} />
      </View>
      <Copy style={{ fontSize: 11.5, fontFamily: fonts.medium }} numberOfLines={1}>{label}</Copy>
    </Pressable>
  );
}

/** Small stat tile: number on top, label underneath. */
function Stat({ label, value, icon, onPress, warn }) {
  const c = usePalette();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value}`} onPress={onPress}
      style={({ pressed }) => ({ width: '48%', flexGrow: 1, padding: 14, gap: 10, borderRadius: 20, backgroundColor: c.card, borderWidth: 1, borderColor: warn ? '#F59E0B66' : c.line, opacity: pressed ? 0.85 : 1 })}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: warn ? '#F59E0B1F' : c.purpleSoft }}>
          <Feather name={icon} size={15} color={warn ? '#F59E0B' : c.purple} />
        </View>
        <Feather name="arrow-up-right" size={15} color={c.muted} style={{ opacity: 0.6 }} />
      </View>
      <View>
        <Copy heading style={{ fontSize: 22 }} numberOfLines={1} adjustsFontSizeToFit>{value}</Copy>
        <Copy muted style={{ fontSize: 12 }}>{label}</Copy>
      </View>
    </Pressable>
  );
}

export default function Dashboard() {
  const user = useSelector(s => s.auth.user);
  const router = useRouter();
  const c = usePalette();
  const [creating, setCreating] = useState(false);

  const fetcher = useCallback(async () => {
    const calls = {
      bookings: bookingsApi.getAll(), orders: shopsApi.orders(), sales: shopsApi.sales(), listings: listingsApi.getMyListings(),
      tickets: ticketsApi.my(), alerts: notificationsApi.getAll(), shop: shopsApi.mine(), payouts: payoutsApi.status(), swaps: swapsApi.incoming(),
    };
    const keys = Object.keys(calls);
    const results = await Promise.allSettled(Object.values(calls));
    return Object.fromEntries(results.map((r, i) => [keys[i], r.status === 'fulfilled' ? r.value.data : null]));
  }, []);
  const { data, loading, error, reload } = useRemote(fetcher);

  const bookings = Array.isArray(data?.bookings) ? data.bookings : [];
  const sales = Array.isArray(data?.sales) ? data.sales : [];
  const listings = Array.isArray(data?.listings) ? data.listings : [];
  const shop = data?.shop && data.shop.id ? data.shop : null;
  const sellerBookings = bookings.filter(b => b.role === 'seller');
  const needsReply = sellerBookings.filter(b => ['INQUIRED', 'NEGOTIATING'].includes(b.status) && (b.lastOfferBy || (b.status === 'NEGOTIATING' ? b.sellerId : b.buyerId)) !== user?.id);
  const inProgress = sellerBookings.filter(b => b.status === 'BOOKED');
  const earnedByCurrency = {};
  sellerBookings.filter(b => SALE_DONE.includes(b.status)).forEach(b => { earnedByCurrency[b.currency || 'PLN'] = (earnedByCurrency[b.currency || 'PLN'] || 0) + Number(b.agreedPrice || 0); });
  sales.filter(o => SHOP_PAID.includes(o.status)).forEach(o => { earnedByCurrency[o.currency || 'PLN'] = (earnedByCurrency[o.currency || 'PLN'] || 0) + Number(o.totalPrice || 0); });
  const earned = Object.entries(earnedByCurrency);
  const payoutsReady = !!data?.payouts?.payoutsEnabled;
  const unreadAlerts = (Array.isArray(data?.alerts) ? data.alerts : []).filter(n => !n.read && !n.isRead).length;
  const pendingSwaps = (Array.isArray(data?.swaps) ? data.swaps : []).filter(s => s.status === 'PENDING').length;
  const openShopOrders = sales.filter(o => o.status === 'PAID').length;
  const upcomingTickets = (Array.isArray(data?.tickets) ? data.tickets : []).filter(t => !ticketIsPast(t)).length;
  const purchases = bookings.filter(b => b.role !== 'seller').length + (Array.isArray(data?.orders) ? data.orders.length : 0);
  const events = listings.filter(l => l.listingType === 'EVENT');
  const go = (pathname, params) => router.push(params ? { pathname, params } : pathname);
  const selling = () => go('/profile/orders', { view: 'selling' });

  // Everything waiting on the user, most urgent first. Payouts only nag sellers.
  const attention = [
    needsReply.length > 0 && { icon: 'message-circle', label: `${needsReply.length} offer${needsReply.length > 1 ? 's' : ''} waiting for your reply`, count: needsReply.length, onPress: selling },
    openShopOrders > 0 && { icon: 'package', label: `${openShopOrders} shop order${openShopOrders > 1 ? 's' : ''} to send`, count: openShopOrders, onPress: selling },
    pendingSwaps > 0 && { icon: 'repeat', label: `${pendingSwaps} swap offer${pendingSwaps > 1 ? 's' : ''} to review`, count: pendingSwaps, onPress: () => go('/swaps') },
    !payoutsReady && (listings.length > 0 || shop) && { icon: 'credit-card', label: 'Set up payouts to get paid', subtitle: 'Connect your bank so sales can be paid out', onPress: () => go('/profile/bank') },
  ].filter(Boolean);

  return (
    <Screen back title="Dashboard" refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={c.purple} />}>
      {/* Earnings */}
      <LinearGradient colors={c.light ? ['#1C1033', '#0E0E10'] : ['#241446', '#0B0B0D']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ borderRadius: 26, padding: 20, gap: 14, borderWidth: 1, borderColor: '#FFFFFF14' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Copy style={{ color: '#C4B5FD', fontSize: 12.5 }}>{greeting()}, {user?.fullName?.split(' ')[0] || 'there'}</Copy>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, height: 26, borderRadius: 13, backgroundColor: '#FFFFFF14' }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: attention.length ? '#F59E0B' : LIME }} />
            <Copy style={{ color: '#F5F3FF', fontSize: 11 }}>{attention.length ? `${attention.length} to do` : 'All caught up'}</Copy>
          </View>
        </View>
        <View style={{ gap: 2 }}>
          <Copy style={{ color: '#A1A1AA', fontSize: 11, letterSpacing: 1, fontFamily: fonts.medium }}>TOTAL EARNED</Copy>
          <Copy heading style={{ color: LIME, fontSize: 32 }} numberOfLines={1} adjustsFontSizeToFit>
            {earned.length ? earned.map(([cur, v]) => money(v, cur)).join(' · ') : money(0, 'PLN')}
          </Copy>
          <Copy style={{ color: '#D4D4D8', fontSize: 12 }}>From completed bookings and paid shop orders</Copy>
        </View>
      </LinearGradient>

      {/* Quick actions */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 4 }}>
        <Action primary icon="plus" label="Add listing" onPress={() => setCreating(true)} />
        <Action icon="shopping-bag" label={shop ? 'My shop' : 'Open shop'} onPress={() => go(shop ? '/shop/manage' : '/shop/create')} />
        <Action icon="package" label="Orders" onPress={() => go('/profile/orders')} />
        <Action icon="credit-card" label="Payouts" onPress={() => go('/profile/bank')} />
      </View>

      {error && <Notice message={error} onRetry={reload} />}

      {attention.length > 0 && (
        <Group title="Needs you">
          {attention.map(a => <Row key={a.label} icon={a.icon} label={a.label} subtitle={a.subtitle} count={a.count} tone="warn" onPress={a.onPress} />)}
        </Group>
      )}

      {/* Stats */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <Stat label="Active listings" value={listings.length} icon="grid" onPress={() => go('/profile/listings')} />
        <Stat label="In progress" value={inProgress.length + openShopOrders} icon="truck" onPress={selling} />
        <Stat label="Needs reply" value={needsReply.length} icon="message-circle" warn={needsReply.length > 0} onPress={selling} />
        <Stat label="Upcoming tickets" value={upcomingTickets} icon="calendar" onPress={() => go('/tickets')} />
      </View>

      {/* Shop */}
      {shop ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`Manage ${shop.name}`} onPress={() => go('/shop/manage')}
          style={({ pressed }) => ({ borderRadius: 24, overflow: 'hidden', backgroundColor: c.card, borderWidth: 1, borderColor: c.line, opacity: pressed ? 0.9 : 1 })}>
          {shop.bannerUrl
            ? <Image source={{ uri: mediaUrl(shop.bannerUrl) }} style={{ width: '100%', height: 96 }} />
            : <LinearGradient colors={['#8B5CF6', '#3B1D7A']} style={{ height: 96 }} />}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Copy heading style={{ fontSize: 16 }} numberOfLines={1}>{shop.name}</Copy>
              <Copy muted style={{ fontSize: 12 }} numberOfLines={1}>{[shop.category, `${shop.productCount ?? 0} products`, shop.published === false && 'Hidden'].filter(Boolean).join(' · ')}</Copy>
            </View>
            <Pressable accessibilityRole="button" onPress={() => go('/shop/[userId]', { userId: shop.ownerId, shopId: shop.id })} style={{ paddingHorizontal: 14, height: 36, borderRadius: 18, borderWidth: 1, borderColor: c.line, justifyContent: 'center' }}>
              <Copy style={{ fontSize: 12.5, fontFamily: fonts.medium }}>View</Copy>
            </Pressable>
          </View>
        </Pressable>
      ) : data && (
        <Pressable accessibilityRole="button" onPress={() => go('/shop/create')}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 24, backgroundColor: c.purpleSoft, borderWidth: 1, borderColor: c.purple + '55', opacity: pressed ? 0.85 : 1 })}>
          <View style={{ width: 46, height: 46, borderRadius: 15, backgroundColor: c.purple, alignItems: 'center', justifyContent: 'center' }}>
            <Feather name="shopping-bag" size={20} color="#FFF" />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Copy heading style={{ fontSize: 15 }}>Open your free shop</Copy>
            <Copy muted style={{ fontSize: 12 }}>A storefront for products or bookable services, paid straight to your bank.</Copy>
          </View>
          <Feather name="chevron-right" size={18} color={c.purple} />
        </Pressable>
      )}

      <Group title="Selling">
        <Row icon="grid" label="My listings" count={listings.length} tone="purple" onPress={() => go('/profile/listings')} />
        <Row icon="bar-chart-2" label="Sales" count={sellerBookings.length + sales.length} onPress={selling} />
        <Row icon="repeat" label="Swaps" count={pendingSwaps} tone="purple" onPress={() => go('/swaps')} />
        <Row icon="trending-up" label="Insights" onPress={() => go('/profile/insights')} />
      </Group>

      <Group title="Buying">
        <Row icon="package" label="My orders" count={purchases} tone="purple" onPress={() => go('/profile/orders', { view: 'buying' })} />
        <Row icon="credit-card" label="Tickets" count={upcomingTickets} onPress={() => go('/tickets')} />
        <Row icon="shopping-cart" label="Cart" tone="purple" onPress={() => go('/cart')} />
        <Row icon="star" label="Reviews" onPress={() => go('/profile/reviews')} />
      </Group>

      <Group title="Account">
        <Row icon="dollar-sign" label="Payments & payouts" value={payoutsReady ? 'Connected' : 'Not set up'} tone={payoutsReady ? 'accent' : 'warn'} onPress={() => go('/profile/bank')} />
        <Row icon="trending-up" label="Earnings" subtitle="Money on its way and released" tone="purple" onPress={() => go('/profile/wallet')} />
        <Row icon="bell" label="Notifications" count={unreadAlerts} onPress={() => go('/notifications')} />
        <Row icon="settings" label="Settings" tone="purple" onPress={() => go('/profile/settings')} />
      </Group>

      {events.length > 0 && (
        <Group title="Event doors" footer="Scan guests' tickets at the door.">
          {events.map(e => <Row key={e.id} icon="maximize" label={e.title} value="Scan" tone="purple" onPress={() => go('/events/' + e.id + '/door')} />)}
        </Group>
      )}

      <CreateListingModal visible={creating} onClose={() => setCreating(false)} onCreated={reload} />
    </Screen>
  );
}
