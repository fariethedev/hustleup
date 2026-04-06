import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { bookingsApi, authApi } from '../../src/api/client';

const LIME = '#CDFF00';
const BG   = '#050505';

const PAYMENT_METHODS = [
  { id: 'blik', icon: 'cellphone', label: 'Blik', sub: 'Polish mobile payment', color: '#E5007D' },
  { id: 'card', icon: 'credit-card-outline', label: 'Debit / Credit Card', sub: 'Visa, Mastercard, Amex', color: '#38BDF8' },
  { id: 'bank', icon: 'bank-outline', label: 'Bank Transfer', sub: 'Direct bank payment', color: '#A78BFA' },
];

export default function WalletScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [completedOrders, setCompletedOrders] = useState([]);
  const [totalEarned, setTotalEarned] = useState(0);
  const [totalSpent, setTotalSpent] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const [meRes, bookRes] = await Promise.all([
          authApi.me().catch(() => ({ data: {} })),
          bookingsApi.getAll().catch(() => ({ data: [] })),
        ]);
        const bookings = bookRes.data || [];
        const done = bookings.filter(b => b.status === 'COMPLETED');
        setCompletedOrders(done);
        setTotalEarned(done.filter(b => b.role === 'seller').reduce((sum, b) => sum + Number(b.offeredPrice || b.counterPrice || 0), 0));
        setTotalSpent(done.filter(b => b.role === 'buyer').reduce((sum, b) => sum + Number(b.offeredPrice || b.counterPrice || 0), 0));
      } catch {/* silent */} finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleAddMethod = (method) => {
    Alert.alert(
      `Add ${method.label}`,
      'In-app payments are coming soon! Until then, arrange payment directly with the other party via chat.',
      [{ text: 'Got it', style: 'default' }]
    );
  };

  if (loading) {
    return <View style={s.center}><ActivityIndicator color={LIME} size="large" /></View>;
  }

  return (
    <View style={s.screen}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Feather name="arrow-left" size={22} color="#FFF" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>WALLET</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Balance Card */}
        <LinearGradient
          colors={['#1a1f1a', '#0d0f0d']}
          style={s.balanceCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={s.balanceCardInner}>
            <View style={s.limeDot} />
            <Text style={s.balanceLabel}>HUSTLEUP BALANCE</Text>
            <Text style={s.balanceAmount}>PLN 0.00</Text>
            <Text style={s.balanceSub}>In-app payments launching soon</Text>
          </View>
          <View style={s.balanceActions}>
            <TouchableOpacity style={s.balanceActionBtn} onPress={() => Alert.alert('Coming Soon', 'Top-up will be available when in-app payments launch.')}>
              <Feather name="plus" size={16} color={LIME} />
              <Text style={s.balanceActionText}>Top Up</Text>
            </TouchableOpacity>
            <View style={s.balanceActionDivider} />
            <TouchableOpacity style={s.balanceActionBtn} onPress={() => Alert.alert('Coming Soon', 'Withdrawals will be available when in-app payments launch.')}>
              <Feather name="arrow-down-circle" size={16} color={LIME} />
              <Text style={s.balanceActionText}>Withdraw</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Stats Row */}
        <View style={s.statsRow}>
          <View style={s.statBox}>
            <Feather name="trending-up" size={18} color="#34D399" />
            <Text style={s.statAmount}>PLN {totalEarned.toLocaleString()}</Text>
            <Text style={s.statLabel}>Total Earned</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statBox}>
            <Feather name="shopping-bag" size={18} color="#F87171" />
            <Text style={s.statAmount}>PLN {totalSpent.toLocaleString()}</Text>
            <Text style={s.statLabel}>Total Spent</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statBox}>
            <Feather name="check-circle" size={18} color={LIME} />
            <Text style={s.statAmount}>{completedOrders.length}</Text>
            <Text style={s.statLabel}>Completed</Text>
          </View>
        </View>

        {/* Payment Methods */}
        <Text style={s.sectionTitle}>PAYMENT METHODS</Text>
        <View style={s.methodsCard}>
          {PAYMENT_METHODS.map((method, i) => (
            <TouchableOpacity
              key={method.id}
              style={[s.methodRow, i < PAYMENT_METHODS.length - 1 && s.methodRowBorder]}
              onPress={() => handleAddMethod(method)}
              activeOpacity={0.7}
            >
              <View style={[s.methodIcon, { backgroundColor: method.color + '18' }]}>
                <MaterialCommunityIcons name={method.icon} size={20} color={method.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.methodLabel}>{method.label}</Text>
                <Text style={s.methodSub}>{method.sub}</Text>
              </View>
              <View style={s.addBadge}>
                <Feather name="plus" size={14} color={LIME} />
                <Text style={s.addBadgeText}>Add</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* How payments work */}
        <Text style={s.sectionTitle}>HOW PAYMENTS WORK</Text>
        <View style={s.infoCard}>
          {[
            { icon: 'message-circle', text: 'Agree on price & method with the seller/buyer via chat before paying.' },
            { icon: 'shield', text: 'Payments are currently peer-to-peer (bank transfer, cash, Blik).' },
            { icon: 'zap', text: 'In-app card & Blik payments are coming soon for a smoother experience.' },
            { icon: 'flag', text: 'If you have a dispute, contact HustleUp support via Settings > Help.' },
          ].map((tip, i) => (
            <View key={i} style={[s.tipRow, i > 0 && s.tipRowBorder]}>
              <View style={s.tipIcon}><Feather name={tip.icon} size={15} color={LIME} /></View>
              <Text style={s.tipText}>{tip.text}</Text>
            </View>
          ))}
        </View>

        {/* Recent transactions from completed orders */}
        {completedOrders.length > 0 && (
          <>
            <Text style={s.sectionTitle}>RECENT TRANSACTIONS</Text>
            <View style={s.txCard}>
              {completedOrders.slice(0, 10).map((order, i) => {
                const isEarned = order.role === 'seller';
                const amount = Number(order.offeredPrice || order.counterPrice || 0);
                return (
                  <View key={order.id} style={[s.txRow, i > 0 && s.txRowBorder]}>
                    <View style={[s.txIcon, { backgroundColor: isEarned ? '#34D39915' : '#F8717115' }]}>
                      <Feather name={isEarned ? 'arrow-down-left' : 'arrow-up-right'} size={14} color={isEarned ? '#34D399' : '#F87171'} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.txTitle} numberOfLines={1}>{order.listingTitle || `Order #${order.id}`}</Text>
                      <Text style={s.txDate}>{order.createdAt ? new Date(order.createdAt).toDateString() : ''}</Text>
                    </View>
                    <Text style={[s.txAmount, { color: isEarned ? '#34D399' : '#F87171' }]}>
                      {isEarned ? '+' : '-'} PLN {amount.toLocaleString()}
                    </Text>
                  </View>
                );
              })}
            </View>
          </>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG, paddingTop: 56 },
  center: { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)' },
  headerTitle: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 3 },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },

  balanceCard: { borderRadius: 20, borderWidth: 1, borderColor: LIME + '25', marginBottom: 16, overflow: 'hidden' },
  balanceCardInner: { padding: 24, alignItems: 'center', gap: 6 },
  limeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: LIME, marginBottom: 4 },
  balanceLabel: { color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: '900', letterSpacing: 3 },
  balanceAmount: { color: '#FFF', fontSize: 40, fontWeight: '900', letterSpacing: -1 },
  balanceSub: { color: '#444', fontSize: 12, marginTop: 2 },
  balanceActions: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  balanceActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14 },
  balanceActionText: { color: LIME, fontSize: 13, fontWeight: '700' },
  balanceActionDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 10 },

  statsRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', marginBottom: 24, padding: 16 },
  statBox: { flex: 1, alignItems: 'center', gap: 6 },
  statAmount: { color: '#FFF', fontSize: 16, fontWeight: '900' },
  statLabel: { color: '#444', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 4 },

  sectionTitle: { color: 'rgba(255,255,255,0.2)', fontSize: 10, fontWeight: '900', letterSpacing: 3, marginBottom: 10, marginTop: 4 },

  methodsCard: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', marginBottom: 24, overflow: 'hidden' },
  methodRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  methodRowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  methodIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  methodLabel: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  methodSub: { color: '#444', fontSize: 11, marginTop: 2 },
  addBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: LIME + '15', borderWidth: 1, borderColor: LIME + '30' },
  addBadgeText: { color: LIME, fontSize: 12, fontWeight: '800' },

  infoCard: { backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', marginBottom: 24, overflow: 'hidden' },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14 },
  tipRowBorder: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)' },
  tipIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: LIME + '12', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  tipText: { flex: 1, color: 'rgba(255,255,255,0.4)', fontSize: 12, lineHeight: 18 },

  txCard: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', marginBottom: 24, overflow: 'hidden' },
  txRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  txRowBorder: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  txIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  txTitle: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  txDate: { color: '#333', fontSize: 11, marginTop: 2 },
  txAmount: { fontSize: 14, fontWeight: '900' },
});
