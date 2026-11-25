import React, { useCallback, useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { bookingsApi, listingsApi, notificationsApi, payoutsApi, shopsApi, swapsApi, ticketsApi } from '../src/api/client';
import { useRemote } from '../src/hooks/useRemote';
import { Notice, usePalette } from '../src/components/native/Kit';
import CreateListingModal from '../src/components/listings/CreateListingModal';
import { ticketIsPast } from '../src/utils/tickets';
import { money } from '../src/utils/marketplace';
import { mediaUrl } from '../src/utils/media';

const SALE_DONE = ['COMPLETED'];
const SHOP_PAID = ['PAID', 'FULFILLED'];

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
  const tasks = needsReply.length + openShopOrders + pendingSwaps;
  const go = (pathname, params) => router.push(params ? { pathname, params } : pathname);

  const kpis = [
    { label: 'Earned', value: earned.length ? earned.map(([cur, v]) => money(v, cur)).join(' · ') : money(0, 'PLN'), icon: 'trending-up', highlight: true, onPress: () => go('/profile/orders', { view: 'selling' }) },
    { label: 'Needs reply', value: needsReply.length, icon: 'message-circle', warn: needsReply.length > 0, onPress: () => go('/profile/orders', { view: 'selling' }) },
    { label: 'In progress', value: inProgress.length + openShopOrders, icon: 'truck', onPress: () => go('/profile/orders', { view: 'selling' }) },
    { label: 'Payouts', value: payoutsReady ? 'Ready' : 'Set up', icon: 'credit-card', warn: !payoutsReady, onPress: () => go('/profile/bank') },
  ];
  const groups = [
    { title: 'Selling', items: [
      ['Listings', 'grid', (data?.listings || []).length, () => go('/profile/listings')],
      ['Shop', 'shopping-bag', shop ? (shop.productCount ?? 0) : '+', () => go(shop ? '/shop/manage' : '/shop/create')],
      ['Sales', 'bar-chart-2', sellerBookings.length + sales.length, () => go('/profile/orders', { view: 'selling' })],
      ['Swaps', 'repeat', pendingSwaps || '', () => go('/swaps')],
    ] },
    { title: 'Buying', items: [
      ['Orders', 'package', bookings.filter(b => b.role !== 'seller').length + (data?.orders || []).length, () => go('/profile/orders', { view: 'buying' })],
      ['Tickets', 'credit-card', (data?.tickets || []).filter(t => !ticketIsPast(t)).length, () => go('/tickets')],
      ['Cart', 'shopping-cart', '', () => go('/cart')],
      ['Reviews', 'star', '', () => go('/profile/reviews')],
    ] },
    { title: 'Account', items: [
      ['Payments', 'dollar-sign', payoutsReady ? '✓' : '!', () => go('/profile/bank')],
      ['Wallet', 'briefcase', '', () => go('/profile/wallet')],
      ['Alerts', 'bell', unreadAlerts || '', () => go('/notifications')],
      ['Settings', 'settings', '', () => go('/profile/settings')],
    ] },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 120 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={c.purple} />}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <TouchableOpacity accessibilityLabel="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: c.card, borderWidth: 1, borderColor: c.line }}>
            <Feather name="arrow-left" size={19} color={c.text} />
          </TouchableOpacity>
          <Text style={{ color: c.text, fontSize: 18, fontWeight: '900', flex: 1 }}>Dashboard</Text>
        </View>

        {/* Hero */}
        <LinearGradient colors={['#8B5CF6', '#3B1D7A', '#120A26']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 24, padding: 18, gap: 10 }}>
          <Text style={{ color: '#DDD6FE', fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>YOUR WORKSPACE</Text>
          <Text style={{ color: '#FFF', fontSize: 22, fontWeight: '900', lineHeight: 28 }}>Good to see you, {user?.fullName?.split(' ')[0] || 'there'}.</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tasks ? '#F59E0B' : '#CDFF00' }} />
            <Text style={{ color: '#EDE9FE', fontSize: 13 }}>{tasks ? `${tasks} thing${tasks > 1 ? 's' : ''} need${tasks > 1 ? '' : 's'} you` : 'All caught up — nothing waiting on you'}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
            <TouchableOpacity onPress={() => setCreating(true)} style={{ flex: 1, minHeight: 42, borderRadius: 21, backgroundColor: '#CDFF00', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}>
              <Feather name="plus" size={16} color="#111" /><Text style={{ color: '#111', fontWeight: '900' }}>Add listing</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => go(shop ? '/shop/manage' : '/shop/create')} style={{ flex: 1, minHeight: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}>
              <Feather name="shopping-bag" size={16} color="#FFF" /><Text style={{ color: '#FFF', fontWeight: '800' }}>{shop ? 'Manage shop' : 'Create shop'}</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {error && <Notice message={error} onRetry={reload} />}

        {/* KPIs */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {kpis.map(k => (
            <Pressable key={k.label} onPress={k.onPress} style={{ width: '48%', flexGrow: 1, borderRadius: 18, padding: 14, gap: 6, backgroundColor: k.highlight ? 'transparent' : c.card, borderWidth: 1, borderColor: k.warn ? '#F59E0B66' : k.highlight ? '#CDFF0055' : c.line, overflow: 'hidden' }}>
              {k.highlight && <LinearGradient colors={['#CDFF0033', '#CDFF0008']} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />}
              <Feather name={k.icon} size={18} color={k.highlight ? c.accent : k.warn ? '#F59E0B' : c.purple} />
              <Text style={{ color: c.text, fontSize: 19, fontWeight: '900' }} numberOfLines={1} adjustsFontSizeToFit>{k.value}</Text>
              <Text style={{ color: c.muted, fontSize: 12 }}>{k.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Shop */}
        {shop ? (
          <View style={{ borderRadius: 20, overflow: 'hidden', backgroundColor: c.card, borderWidth: 1, borderColor: c.line }}>
            {!!shop.bannerUrl && <Image source={{ uri: mediaUrl(shop.bannerUrl) }} style={{ width: '100%', height: 110 }} />}
            <View style={{ padding: 14, gap: 10 }}>
              <View><Text style={{ color: c.text, fontWeight: '900', fontSize: 16 }}>{shop.name}</Text><Text style={{ color: c.muted, fontSize: 12 }}>{shop.category} · {shop.productCount ?? 0} products{shop.published === false ? ' · Hidden' : ''}</Text></View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity onPress={() => go('/shop/[userId]', { userId: shop.ownerId, shopId: shop.id })} style={{ flex: 1, minHeight: 38, borderRadius: 19, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: c.text, fontWeight: '700' }}>View shop</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => go('/shop/manage')} style={{ flex: 1, minHeight: 38, borderRadius: 19, backgroundColor: c.purple, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#FFF', fontWeight: '800' }}>Manage</Text></TouchableOpacity>
              </View>
            </View>
          </View>
        ) : data && (
          <View style={{ borderRadius: 20, padding: 16, gap: 12, backgroundColor: c.card, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.purple }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.purpleSoft, alignItems: 'center', justifyContent: 'center' }}><Feather name="shopping-bag" size={18} color={c.purple} /></View>
              <View style={{ flex: 1 }}><Text style={{ color: c.text, fontWeight: '900', fontSize: 16 }}>Start your shop — it’s free</Text><Text style={{ color: c.muted, fontSize: 12 }}>A storefront for your products or bookable services.</Text></View>
            </View>
            {['Name your shop and pick its type (store, salon, barber, tutor…)', 'Add a banner, then your products or services with prices', 'Connect payouts so sales land in your bank'].map((step, i) => (
              <View key={step} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: i % 2 ? c.purple : c.accent, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: i % 2 ? '#FFF' : '#111', fontSize: 11, fontWeight: '900' }}>{i + 1}</Text></View>
                <Text style={{ color: c.text, fontSize: 13, flex: 1, lineHeight: 19 }}>{step}</Text>
              </View>
            ))}
            <TouchableOpacity onPress={() => go('/shop/create')} style={{ minHeight: 46, borderRadius: 23, backgroundColor: c.purple, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}>
              <Feather name="plus" size={16} color="#FFF" /><Text style={{ color: '#FFF', fontWeight: '900' }}>Create my shop</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Grouped tiles, like the web dashboard's sidebar */}
        {groups.map(g => (
          <View key={g.title} style={{ gap: 8 }}>
            <Text style={{ color: c.muted, fontSize: 12, fontWeight: '800', letterSpacing: 0.6 }}>{g.title.toUpperCase()}</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {g.items.map(([label, icon, count, onPress]) => (
                <Pressable key={label} onPress={onPress} style={({ pressed }) => ({ flex: 1, alignItems: 'center', gap: 6, paddingVertical: 12, borderRadius: 16, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, opacity: pressed ? 0.8 : 1 })}>
                  <View>
                    <Feather name={icon} size={20} color={c.purple} />
                    {count !== '' && count !== 0 && count != null && <View style={{ position: 'absolute', top: -8, right: -14, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#111', fontSize: 10, fontWeight: '900' }}>{count}</Text></View>}
                  </View>
                  <Text style={{ color: c.text, fontSize: 12, fontWeight: '700' }}>{label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ))}

        {!!data?.listings?.some(l => l.listingType === 'EVENT') && <View style={{ gap: 8 }}>
          <Text style={{ color: c.muted, fontSize: 12, fontWeight: '800', letterSpacing: 0.6 }}>EVENT DOORS</Text>
          {data.listings.filter(l => l.listingType === 'EVENT').map(e => (
            <TouchableOpacity key={e.id} onPress={() => go('/events/' + e.id + '/door')} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 16, backgroundColor: c.card, borderWidth: 1, borderColor: c.line }}>
              <Feather name="maximize" size={18} color={c.purple} /><Text style={{ color: c.text, fontWeight: '700', flex: 1 }} numberOfLines={1}>{e.title}</Text><Text style={{ color: c.purple, fontWeight: '800', fontSize: 12 }}>Scan tickets →</Text>
            </TouchableOpacity>
          ))}
        </View>}
      </ScrollView>
      <CreateListingModal visible={creating} onClose={() => setCreating(false)} onCreated={reload} />
    </SafeAreaView>
  );
}
