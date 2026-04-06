import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { authApi, listingsApi, feedApi, followsApi, bookingsApi } from '../../src/api/client';

const LIME = '#CDFF00';
const BG   = '#050505';

function StatCard({ icon, value, label, color = LIME, sub }) {
  return (
    <View style={s.statCard}>
      <View style={[s.statIconBox, { backgroundColor: color + '15' }]}>
        <Feather name={icon} size={18} color={color} />
      </View>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
      {sub ? <Text style={s.statSub}>{sub}</Text> : null}
    </View>
  );
}

function BarRow({ label, value, max, color }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <View style={s.barRow}>
      <Text style={s.barLabel}>{label}</Text>
      <View style={s.barTrack}>
        <View style={[s.barFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={s.barValue}>{value}</Text>
    </View>
  );
}

const TYPE_COLORS = {
  HAIR_BEAUTY: '#F472B6', FOOD: '#FB923C', EVENT: '#FBBF24',
  FASHION: '#A78BFA', GOODS: '#34D399', SKILL: LIME,
  JOB: '#38BDF8', RENTAL: '#60A5FA',
};

export default function InsightsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    followers: 0, following: 0, listings: [], posts: [], orders: [], userId: null,
  });

  useEffect(() => {
    const load = async () => {
      try {
        const meRes = await authApi.me();
        const user = meRes.data;
        const [countsRes, listRes, feedRes, ordersRes] = await Promise.all([
          followsApi.getCounts(user.id).catch(() => ({ data: { followers: 0, following: 0 } })),
          listingsApi.getMyListings().catch(() => ({ data: [] })),
          feedApi.getPosts().catch(() => ({ data: [] })),
          bookingsApi.getAll().catch(() => ({ data: [] })),
        ]);
        const allPosts = feedRes.data || [];
        setData({
          followers: countsRes.data?.followers || 0,
          following: countsRes.data?.following || 0,
          listings: listRes.data || [],
          posts: allPosts.filter(p => String(p.authorId) === String(user.id)),
          orders: ordersRes.data || [],
          userId: user.id,
        });
      } catch {/* silent */} finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return <View style={s.center}><ActivityIndicator color={LIME} size="large" /></View>;
  }

  const { followers, following, listings, posts, orders } = data;
  const activeListings   = listings.filter(l => l.status === 'ACTIVE' || !l.status);
  const soldListings     = listings.filter(l => l.status === 'SOLD');
  const totalOrders      = orders.length;
  const completedOrders  = orders.filter(o => o.status === 'COMPLETED');
  const salesOrders      = completedOrders.filter(o => o.role === 'seller');
  const totalRevenue     = salesOrders.reduce((sum, o) => sum + Number(o.offeredPrice || o.counterPrice || 0), 0);
  const totalLikes       = posts.reduce((sum, p) => sum + (p.likesCount || 0), 0);
  const totalComments    = posts.reduce((sum, p) => sum + (p.commentsCount || 0), 0);
  const pendingOrders    = orders.filter(o => o.status === 'INQUIRED' && o.role === 'seller');

  // Listing breakdown by type
  const typeBreakdown = listings.reduce((acc, l) => {
    const t = l.listingType || 'GOODS';
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});
  const maxTypeCount = Math.max(...Object.values(typeBreakdown), 1);

  return (
    <View style={s.screen}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Feather name="arrow-left" size={22} color="#FFF" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>INSIGHTS</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Pending alert */}
        {pendingOrders.length > 0 && (
          <TouchableOpacity style={s.alertBanner} onPress={() => router.push('/profile/orders')} activeOpacity={0.8}>
            <View style={s.alertDot} />
            <Text style={s.alertText}>{pendingOrders.length} order{pendingOrders.length > 1 ? 's' : ''} waiting for your response</Text>
            <Feather name="arrow-right" size={14} color={LIME} />
          </TouchableOpacity>
        )}

        {/* Audience */}
        <Text style={s.sectionTitle}>AUDIENCE</Text>
        <View style={s.statsGrid}>
          <StatCard icon="users" value={followers} label="Followers" color={LIME} />
          <StatCard icon="user-check" value={following} label="Following" color="#38BDF8" />
          <StatCard icon="message-square" value={posts.length} label="Posts" color="#A78BFA" />
          <StatCard icon="heart" value={totalLikes} label="Total Likes" color="#F472B6" />
        </View>

        {/* Shop performance */}
        <Text style={s.sectionTitle}>SHOP PERFORMANCE</Text>
        <View style={s.statsGrid}>
          <StatCard icon="shopping-bag" value={activeListings.length} label="Active" color="#34D399" />
          <StatCard icon="tag" value={soldListings.length} label="Sold" color={LIME} />
          <StatCard icon="package" value={totalOrders} label="Orders" color="#FBBF24" />
          <StatCard icon="check-circle" value={completedOrders.length} label="Completed" color="#34D399" />
        </View>

        {/* Revenue banner */}
        <View style={s.revenueBanner}>
          <View>
            <Text style={s.revenueLabel}>TOTAL REVENUE</Text>
            <Text style={s.revenueAmount}>PLN {totalRevenue.toLocaleString()}</Text>
            <Text style={s.revenueSub}>From {salesOrders.length} completed sale{salesOrders.length !== 1 ? 's' : ''}</Text>
          </View>
          <TouchableOpacity style={s.revenueBtn} onPress={() => router.push('/profile/orders')}>
            <Text style={s.revenueBtnText}>View Orders</Text>
            <Feather name="arrow-right" size={13} color={BG} />
          </TouchableOpacity>
        </View>

        {/* Engagement */}
        <Text style={s.sectionTitle}>ENGAGEMENT</Text>
        <View style={s.infoCard}>
          {[
            { icon: 'heart', label: 'Post Likes', value: totalLikes, color: '#F472B6' },
            { icon: 'message-circle', label: 'Comments', value: totalComments, color: '#38BDF8' },
            { icon: 'share-2', label: 'Posts Created', value: posts.length, color: '#A78BFA' },
          ].map((row, i) => (
            <View key={i} style={[s.engRow, i > 0 && s.engRowBorder]}>
              <View style={[s.engIconBox, { backgroundColor: row.color + '15' }]}>
                <Feather name={row.icon} size={15} color={row.color} />
              </View>
              <Text style={s.engLabel}>{row.label}</Text>
              <Text style={s.engValue}>{row.value}</Text>
            </View>
          ))}
        </View>

        {/* Listing type breakdown */}
        {Object.keys(typeBreakdown).length > 0 && (
          <>
            <Text style={s.sectionTitle}>LISTINGS BY TYPE</Text>
            <View style={s.infoCard}>
              {Object.entries(typeBreakdown)
                .sort((a, b) => b[1] - a[1])
                .map(([type, count]) => (
                  <BarRow
                    key={type}
                    label={type.replace('_', ' ')}
                    value={count}
                    max={maxTypeCount}
                    color={TYPE_COLORS[type] || LIME}
                  />
                ))}
            </View>
          </>
        )}

        {/* Tips */}
        <Text style={s.sectionTitle}>GROW YOUR HUSTLE</Text>
        <View style={s.tipsCard}>
          {[
            followers < 10   && { icon: 'users',       text: 'Build your audience — share your profile link and post regularly to attract followers.' },
            posts.length < 3 && { icon: 'edit-3',      text: 'Post more content to increase visibility. Sellers with 5+ posts get 3x more profile views.' },
            activeListings.length === 0 && { icon: 'shopping-bag', text: 'Add your first listing — turn your skills or goods into income on HustleUp.' },
            completedOrders.length === 0 && totalOrders > 0 && { icon: 'check-circle', text: 'You have pending orders! Accept or decline them from the Orders screen.' },
            !false && { icon: 'star', text: 'Complete orders quickly to build positive reviews and trust with buyers.' },
          ].filter(Boolean).slice(0, 3).map((tip, i) => (
            <View key={i} style={[s.tipRow, i > 0 && s.tipBorder]}>
              <View style={s.tipIcon}><Feather name={tip.icon} size={14} color={LIME} /></View>
              <Text style={s.tipText}>{tip.text}</Text>
            </View>
          ))}
        </View>

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

  alertBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: LIME + '15', borderRadius: 14, borderWidth: 1, borderColor: LIME + '35', padding: 14, marginBottom: 20 },
  alertDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: LIME },
  alertText: { flex: 1, color: LIME, fontSize: 13, fontWeight: '700' },

  sectionTitle: { color: 'rgba(255,255,255,0.2)', fontSize: 10, fontWeight: '900', letterSpacing: 3, marginBottom: 10, marginTop: 4 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  statCard: { width: '47%', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', padding: 16, gap: 6 },
  statIconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statValue: { color: '#FFF', fontSize: 24, fontWeight: '900' },
  statLabel: { color: '#444', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  statSub: { color: '#333', fontSize: 10 },

  revenueBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: LIME + '0F', borderRadius: 18, borderWidth: 1, borderColor: LIME + '30', padding: 20, marginBottom: 20 },
  revenueLabel: { color: 'rgba(255,255,255,0.3)', fontSize: 9, fontWeight: '900', letterSpacing: 3, marginBottom: 4 },
  revenueAmount: { color: '#FFF', fontSize: 28, fontWeight: '900' },
  revenueSub: { color: '#444', fontSize: 11, marginTop: 2 },
  revenueBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: LIME, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  revenueBtnText: { color: BG, fontSize: 12, fontWeight: '900' },

  infoCard: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', marginBottom: 20, overflow: 'hidden' },
  engRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  engRowBorder: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  engIconBox: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  engLabel: { flex: 1, color: 'rgba(255,255,255,0.6)', fontSize: 13 },
  engValue: { color: '#FFF', fontSize: 16, fontWeight: '900' },

  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  barLabel: { width: 80, color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '600' },
  barTrack: { flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  barValue: { width: 24, color: '#FFF', fontSize: 12, fontWeight: '800', textAlign: 'right' },

  tipsCard: { backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', marginBottom: 20, overflow: 'hidden' },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14 },
  tipBorder: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  tipIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: LIME + '12', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  tipText: { flex: 1, color: 'rgba(255,255,255,0.4)', fontSize: 12, lineHeight: 18 },
});
