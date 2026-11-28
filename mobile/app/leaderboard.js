import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRemote } from '../src/hooks/useRemote';
import { leaderboardApi } from '../src/api/client';
import { usePalette, fonts, BackButton } from '../src/components/native/Kit';
import { mediaUrl } from '../src/utils/media';
import { money } from '../src/utils/marketplace';

const PURPLE = '#8B5CF6';
const LIME = '#CDFF00';
const MEDALS = { 1: '#FFD54A', 2: '#D1D5DB', 3: '#E0A16B' };
// Tier names from HustleScoreService.tierFor().
const TIER_COLORS = { MOGUL: '#F472B6', OPERATOR: PURPLE, HUSTLER: '#38BDF8', GRINDER: LIME, ROOKIE: '#9CA3AF' };
const METRICS = [['score', 'Hustle score', 'zap'], ['sales', 'Sales', 'shopping-bag'], ['earnings', 'Earnings', 'trending-up']];
const PERIODS = [['week', 'This week'], ['month', 'This month'], ['all', 'All time']];

const valueOf = (row, metric) => metric === 'score' ? `${row.hustleScore ?? 0}`
  : metric === 'earnings' ? money(row.earnings ?? 0, row.currency || 'PLN') : `${row.salesCount ?? 0}`;
const unitOf = metric => (metric === 'score' ? 'pts' : metric === 'sales' ? 'sales' : '');

function Avatar({ uri, name, size, ring }) {
  return (
    <View style={{ width: size + 8, height: size + 8, borderRadius: (size + 8) / 2, borderWidth: 3, borderColor: ring || 'transparent', alignItems: 'center', justifyContent: 'center' }}>
      {uri ? <Image source={{ uri: mediaUrl(uri) }} style={{ width: size, height: size, borderRadius: size / 2 }} />
        : <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#2A2340', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: LIME, fontWeight: '900', fontSize: size * 0.4 }}>{(name || '?')[0].toUpperCase()}</Text>
        </View>}
    </View>
  );
}

function TierChip({ tier }) {
  if (!tier) return null;
  const color = TIER_COLORS[String(tier).toUpperCase()] || PURPLE;
  return <View style={[s.tier, { borderColor: `${color}66`, backgroundColor: `${color}1F` }]}><Text style={{ color, fontSize: 10, fontWeight: '900', letterSpacing: 0.6 }}>{String(tier).toUpperCase()}</Text></View>;
}

function Podium({ rows, metric, onOpen }) {
  // Visual order: 2nd, 1st, 3rd, with the winner raised.
  const order = [rows[1], rows[0], rows[2]];
  return (
    <View style={s.podium}>
      {order.map((row, i) => {
        if (!row) return <View key={i} style={{ flex: 1 }} />;
        const place = row.rank ?? (i === 1 ? 1 : i === 0 ? 2 : 3);
        const first = place === 1;
        return (
          <Pressable key={row.userId || i} onPress={() => onOpen(row)} style={{ flex: 1, alignItems: 'center' }} accessibilityLabel={`Rank ${place}, ${row.userName}`}>
            {first && <MaterialCommunityIcons name="crown" size={30} color={MEDALS[1]} style={{ marginBottom: -4 }} />}
            <Avatar uri={row.avatarUrl} name={row.userName} size={first ? 78 : 60} ring={MEDALS[place]} />
            <Text style={s.podiumName} numberOfLines={1}>{row.userName || 'Member'}</Text>
            <Text style={[s.podiumValue, { color: first ? LIME : '#E9E4FF' }]}>{valueOf(row, metric)}<Text style={s.podiumUnit}> {unitOf(metric)}</Text></Text>
            <LinearGradient colors={first ? [PURPLE, '#5B21B6'] : ['#3B2F5C', '#241D38']} style={[s.step, { height: first ? 96 : place === 2 ? 72 : 56 }]}>
              <Text style={[s.stepRank, { color: MEDALS[place] }]}>{place}</Text>
            </LinearGradient>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function Leaderboard() {
  const router = useRouter();
  const c = usePalette();
  const me = useSelector(state => state.auth.user);
  const [metric, setMetric] = useState('score');
  const [period, setPeriod] = useState('all');
  const { data, loading, error, reload } = useRemote(useCallback(async () => {
    const result = await leaderboardApi.board(metric, period);
    if (!Array.isArray(result.data)) throw new Error('Invalid leaderboard response');
    return result.data;
  }, [metric, period]));

  const rows = data || [];
  const mine = rows.find(r => String(r.userId) === String(me?.id));
  const open = row => row.userId && router.push('/profile/' + row.userId);

  const header = (
    <View>
      <LinearGradient colors={[PURPLE, '#2E1065', c.bg]} locations={[0, 0.55, 1]} style={s.hero}>
        <SafeAreaView edges={['top']}>
          <View style={s.topBar}>
            <BackButton />
            <Text style={s.title}>Leaderboard</Text>
            <View style={s.iconBtn}><Feather name="award" size={20} color={LIME} /></View>
          </View>
          <Text style={s.subtitle}>The community’s top hustlers. Sell, earn great reviews and climb.</Text>
          <View style={s.segment}>
            {METRICS.map(([key, label, icon]) => (
              <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: metric === key }} onPress={() => setMetric(key)} style={[s.segBtn, metric === key && s.segOn]}>
                <Feather name={icon} size={14} color={metric === key ? '#111' : '#E9E4FF'} />
                <Text style={[s.segText, metric === key && { color: '#111' }]}>{label}</Text>
              </Pressable>
            ))}
          </View>
          <View style={s.periods}>
            {PERIODS.map(([key, label]) => (
              <Pressable key={key} onPress={() => setPeriod(key)} style={[s.period, period === key && { backgroundColor: 'rgba(255,255,255,0.18)', borderColor: 'rgba(255,255,255,0.5)' }]}>
                <Text style={{ color: '#FFF', fontWeight: period === key ? '800' : '600', fontSize: 12 }}>{label}</Text>
              </Pressable>
            ))}
          </View>
          {!loading && !error && rows.length > 0 && <Podium rows={rows} metric={metric} onOpen={open} />}
        </SafeAreaView>
      </LinearGradient>
      {mine && (
        <View style={[s.mine, { borderColor: PURPLE, backgroundColor: c.card }]}>
          <Text style={{ color: PURPLE, fontWeight: '900', fontSize: 20, width: 44 }}>#{mine.rank}</Text>
          <View style={{ flex: 1 }}><Text style={{ color: c.text, fontWeight: '800' }}>Your rank</Text><Text style={{ color: c.muted, fontSize: 12 }}>Keep selling to climb higher</Text></View>
          <Text style={{ color: c.accent, fontWeight: '900' }}>{valueOf(mine, metric)} {unitOf(metric)}</Text>
        </View>
      )}
      {loading && <ActivityIndicator color={PURPLE} style={{ marginTop: 30 }} />}
      {!!error && <View style={s.empty}><Text style={{ color: c.text, fontWeight: '800' }}>Couldn’t load rankings</Text><Text style={{ color: c.muted }}>{error}</Text><TouchableOpacity onPress={reload} style={[s.retry, { backgroundColor: PURPLE }]}><Text style={{ color: '#FFF', fontWeight: '800' }}>Try again</Text></TouchableOpacity></View>}
      {!loading && !error && !rows.length && <View style={s.empty}><Feather name="award" size={34} color={PURPLE} /><Text style={{ color: c.text, fontWeight: '800', fontSize: 16 }}>No rankings yet</Text><Text style={{ color: c.muted, textAlign: 'center' }}>Complete a sale to be the first on the board.</Text></View>}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <FlatList
        data={loading || error ? [] : rows.slice(3)}
        keyExtractor={(row, i) => String(row.userId || i)}
        ListHeaderComponent={header}
        refreshControl={<RefreshControl refreshing={false} onRefresh={reload} tintColor={PURPLE} />}
        contentContainerStyle={{ paddingBottom: 60 }}
        renderItem={({ item: row }) => {
          const isMe = String(row.userId) === String(me?.id);
          return (
            <Pressable onPress={() => open(row)} style={[s.row, { backgroundColor: isMe ? `${PURPLE}22` : c.card, borderColor: isMe ? PURPLE : c.line }]}>
              <Text style={[s.rank, { color: c.muted }]}>{row.rank}</Text>
              <Avatar uri={row.avatarUrl} name={row.userName} size={44} />
              <View style={{ flex: 1, gap: 3 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ color: c.text, fontWeight: '800', fontSize: 15, flexShrink: 1 }} numberOfLines={1}>{row.userName || 'Member'}{isMe ? ' (you)' : ''}</Text>
                  {row.verified && <MaterialCommunityIcons name="check-decagram" size={15} color={PURPLE} />}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TierChip tier={row.tier} />
                  {row.avgRating > 0 && <Text style={{ color: c.muted, fontSize: 12 }}>★ {Number(row.avgRating).toFixed(1)}</Text>}
                  {!!row.city && <Text style={{ color: c.muted, fontSize: 12 }} numberOfLines={1}>{row.city}</Text>}
                </View>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: c.text, fontWeight: '900', fontSize: 16 }}>{valueOf(row, metric)}</Text>
                {!!unitOf(metric) && <Text style={{ color: c.muted, fontSize: 11 }}>{unitOf(metric)}</Text>}
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  hero: { paddingBottom: 18, paddingHorizontal: 16 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  iconBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.25)' },
  title: { color: '#FFF', fontFamily: fonts.heading, fontSize: 22 },
  subtitle: { color: '#DDD6FE', fontSize: 13, textAlign: 'center', marginTop: 8, marginBottom: 14 },
  segment: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 16, padding: 4, gap: 4 },
  segBtn: { flex: 1, flexDirection: 'row', gap: 6, minHeight: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: LIME },
  segText: { color: '#E9E4FF', fontWeight: '800', fontSize: 12 },
  periods: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 10 },
  period: { paddingHorizontal: 14, minHeight: 32, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', justifyContent: 'center' },
  podium: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 22, gap: 8 },
  podiumName: { color: '#FFF', fontWeight: '800', fontSize: 13, marginTop: 6, maxWidth: 110 },
  podiumValue: { fontWeight: '900', fontSize: 15, marginTop: 2, marginBottom: 8 },
  podiumUnit: { fontSize: 11, fontWeight: '600', color: '#C4B5FD' },
  step: { width: '100%', borderTopLeftRadius: 14, borderTopRightRadius: 14, alignItems: 'center', paddingTop: 8 },
  stepRank: { fontSize: 28, fontWeight: '900' },
  mine: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginTop: 14, padding: 14, borderRadius: 18, borderWidth: 1.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginTop: 10, padding: 12, borderRadius: 18, borderWidth: 1 },
  rank: { width: 24, textAlign: 'center', fontWeight: '900', fontSize: 15 },
  tier: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, borderWidth: 1 },
  empty: { alignItems: 'center', gap: 8, padding: 30 },
  retry: { marginTop: 6, paddingHorizontal: 20, minHeight: 44, borderRadius: 22, justifyContent: 'center' },
});
