import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { bookingsApi, listingsApi } from '../../src/api/client';

const LIME = '#CDFF00';
const BG   = '#050505';

const STATUS_META = {
  INQUIRED:    { label: 'Pending',    color: '#FBBF24', bg: '#FBBF2420' },
  NEGOTIATING: { label: 'Countered',  color: '#A78BFA', bg: '#A78BFA20' },
  BOOKED:      { label: 'Accepted',   color: '#34D399', bg: '#34D39920' },
  COMPLETED:   { label: 'Completed',  color: LIME,      bg: LIME + '20' },
  CANCELLED:   { label: 'Cancelled',  color: '#F87171', bg: '#F8717120' },
  POSTED:      { label: 'Draft',      color: '#555',    bg: '#55555520' },
};

function OrderCard({ item, onAccept, onCancel, onComplete }) {
  const meta = STATUS_META[item.status] || STATUS_META.PENDING;
  const isActionable = item.status === 'INQUIRED' || item.status === 'NEGOTIATING';
  const isBuyer = item.role === 'buyer';

  return (
    <View style={s.card}>
      <View style={s.cardTop}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={s.cardTitle} numberOfLines={2}>{item.listingTitle || `Listing #${item.listingId}`}</Text>
          <Text style={s.cardSub}>{isBuyer ? 'You ordered from' : 'Order from'} {isBuyer ? item.sellerName || 'seller' : item.buyerName || 'buyer'}</Text>
        </View>
        <View style={[s.statusBadge, { backgroundColor: meta.bg, borderColor: meta.color + '55' }]}>
          <Text style={[s.statusText, { color: meta.color }]}>{meta.label}</Text>
        </View>
      </View>

      <View style={s.priceRow}>
        <Feather name="tag" size={13} color="rgba(255,255,255,0.3)" />
        <Text style={s.price}>
          {item.currency || 'PLN'} {Number(item.offeredPrice || item.price || 0).toLocaleString()}
          {item.status === 'NEGOTIATING' && item.counterPrice && (
            <Text style={s.counterNote}> → Counter: {item.currency || 'PLN'} {Number(item.counterPrice).toLocaleString()}</Text>
          )}
        </Text>
      </View>

      {item.message ? (
        <Text style={s.message}>"{item.message}"</Text>
      ) : null}

      <View style={s.cardFooter}>
        <Text style={s.cardDate}>{item.createdAt ? new Date(item.createdAt).toDateString() : ''}</Text>
        {isActionable && !isBuyer && (
          <View style={s.actions}>
            <TouchableOpacity style={s.acceptBtn} onPress={() => onAccept(item.id)}>
              <Text style={s.acceptBtnText}>Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.cancelBtn} onPress={() => onCancel(item.id)}>
              <Text style={s.cancelBtnText}>Decline</Text>
            </TouchableOpacity>
          </View>
        )}
        {item.status === 'BOOKED' && !isBuyer && (
          <TouchableOpacity style={s.completeBtn} onPress={() => onComplete(item.id)}>
            <Text style={s.completeBtnText}>Mark Complete</Text>
          </TouchableOpacity>
        )}
        {isActionable && isBuyer && (
          <TouchableOpacity style={s.cancelBtn} onPress={() => onCancel(item.id)}>
            <Text style={s.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export default function OrdersScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('all');

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await bookingsApi.getAll();
      setOrders(res.data || []);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleAccept = async (id) => {
    try {
      await bookingsApi.accept(id);
      setOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'ACCEPTED' } : o));
    } catch { Alert.alert('Error', 'Could not accept order.'); }
  };

  const handleCancel = (id) => {
    Alert.alert('Cancel Order', 'Are you sure you want to cancel this order?', [
      { text: 'Back', style: 'cancel' },
      { text: 'Cancel Order', style: 'destructive', onPress: async () => {
        try {
          await bookingsApi.cancel(id, 'User cancelled');
          setOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'CANCELLED' } : o));
        } catch { Alert.alert('Error', 'Could not cancel order.'); }
      }},
    ]);
  };

  const handleComplete = async (id) => {
    try {
      await bookingsApi.complete(id);
      setOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'COMPLETED' } : o));
    } catch { Alert.alert('Error', 'Could not complete order.'); }
  };

  const filtered = tab === 'all' ? orders
    : tab === 'buying' ? orders.filter(o => o.role === 'buyer')
    : orders.filter(o => o.role === 'seller');

  const counts = {
    all: orders.length,
    buying: orders.filter(o => o.role === 'buyer').length,
    selling: orders.filter(o => o.role === 'seller').length,
  };

  return (
    <View style={s.screen}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Feather name="arrow-left" size={22} color="#FFF" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>ORDERS</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs */}
      <View style={s.tabs}>
        {[['all','All'], ['buying','Buying'], ['selling','Selling']].map(([key, label]) => (
          <TouchableOpacity key={key} style={[s.tab, tab === key && s.tabActive]} onPress={() => setTab(key)}>
            <Text style={[s.tabText, tab === key && s.tabTextActive]}>{label}</Text>
            {counts[key] > 0 && (
              <View style={[s.tabBadge, tab === key && s.tabBadgeActive]}>
                <Text style={[s.tabBadgeText, tab === key && s.tabBadgeTextActive]}>{counts[key]}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={LIME} size="large" /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => String(i.id)}
          contentContainerStyle={filtered.length === 0 ? s.emptyContainer : s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={LIME} />}
          renderItem={({ item }) => (
            <OrderCard item={item} onAccept={handleAccept} onCancel={handleCancel} onComplete={handleComplete} />
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <Feather name="package" size={52} color="rgba(255,255,255,0.05)" />
              <Text style={s.emptyTitle}>NO ORDERS YET</Text>
              <Text style={s.emptyHint}>
                {tab === 'buying' ? 'Browse listings and make an offer to start buying.'
                  : tab === 'selling' ? 'Create a listing so buyers can place orders.'
                  : 'Orders you buy or receive will appear here.'}
              </Text>
              {tab !== 'selling' && (
                <TouchableOpacity style={s.ctaBtn} onPress={() => router.push('/(tabs)/explore')}>
                  <Text style={s.ctaBtnText}>Browse Listings</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG, paddingTop: 56 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)' },
  headerTitle: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 3 },

  tabs: { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 16 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  tabActive: { backgroundColor: LIME + '15', borderColor: LIME + '50' },
  tabText: { color: '#555', fontSize: 13, fontWeight: '700' },
  tabTextActive: { color: LIME },
  tabBadge: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  tabBadgeActive: { backgroundColor: LIME + '25' },
  tabBadgeText: { color: '#666', fontSize: 11, fontWeight: '800' },
  tabBadgeTextActive: { color: LIME },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: 20, paddingBottom: 120 },
  emptyContainer: { flex: 1, paddingHorizontal: 20 },

  card: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', padding: 16, marginBottom: 12 },
  cardTop: { flexDirection: 'row', gap: 12, marginBottom: 10 },
  cardTitle: { color: '#FFF', fontSize: 14, fontWeight: '800', lineHeight: 20 },
  cardSub: { color: '#555', fontSize: 12 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, alignSelf: 'flex-start' },
  statusText: { fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  price: { color: '#FFF', fontSize: 15, fontWeight: '900' },
  counterNote: { color: '#A78BFA', fontSize: 13 },
  message: { color: 'rgba(255,255,255,0.4)', fontSize: 12, fontStyle: 'italic', marginBottom: 10, lineHeight: 18 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  cardDate: { color: '#333', fontSize: 11 },
  actions: { flexDirection: 'row', gap: 8 },
  acceptBtn: { backgroundColor: LIME, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7 },
  acceptBtnText: { color: BG, fontSize: 12, fontWeight: '900' },
  cancelBtn: { backgroundColor: 'rgba(248,113,113,0.12)', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: '#F8717130' },
  cancelBtnText: { color: '#F87171', fontSize: 12, fontWeight: '700' },
  completeBtn: { backgroundColor: 'rgba(52,211,153,0.12)', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: '#34D39930' },
  completeBtnText: { color: '#34D399', fontSize: 12, fontWeight: '700' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  emptyTitle: { color: 'rgba(255,255,255,0.12)', fontSize: 16, fontWeight: '900', letterSpacing: 3 },
  emptyHint: { color: '#444', fontSize: 13, textAlign: 'center', lineHeight: 20, maxWidth: 260 },
  ctaBtn: { marginTop: 8, backgroundColor: LIME, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12 },
  ctaBtnText: { color: BG, fontSize: 13, fontWeight: '900' },
});
