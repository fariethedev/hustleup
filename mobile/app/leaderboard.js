import React, { useCallback, useState } from 'react';
import { ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import MembershipGate from '../src/components/native/MembershipGate';
import { Screen, Section, Panel, Copy, Button, Notice } from '../src/components/native/Kit';
import { useRemote } from '../src/hooks/useRemote';
import { leaderboardApi } from '../src/api/client';

export default function Leaderboard() {
  return <MembershipGate allAccess feature="Leaderboards"><Board /></MembershipGate>;
}
function Board() {
  const router = useRouter();
  const [metric, setMetric] = useState('score'), [period, setPeriod] = useState('all');
  const { data, loading, error, reload } = useRemote(useCallback(async () => {
    const result = await leaderboardApi.board(metric, period);
    if (!Array.isArray(result.data)) throw new Error('Invalid leaderboard response');
    return result.data;
  }, [metric, period]));
  return <Screen back title="Leaderboards"><Section title="Community leaders" subtitle="Rankings from the same leaderboard as the website." />
    <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>{[['score', 'Hustle score'], ['sales', 'Sales'], ['earnings', 'Earnings']].map(([key, label]) => <Button key={key} secondary={metric !== key} onPress={() => setMetric(key)}>{label}</Button>)}</ScrollView>
    <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>{[['all', 'All time'], ['week', 'This week'], ['month', 'This month']].map(([key, label]) => <Button key={key} secondary={period !== key} onPress={() => setPeriod(key)}>{label}</Button>)}</ScrollView>
    {loading ? <Notice loading message="Loading rankings…" /> : error ? <Notice message={error} onRetry={reload} /> : !data?.length ? <Notice message="No rankings yet." /> : data.map((row, index) => <Panel key={row.userId || index}><Copy heading>#{row.rank ?? index + 1} · {row.userName || row.fullName || row.username || 'Member'}</Copy><Copy>{metric === 'score' ? row.hustleScore : metric === 'earnings' ? `${row.earnings} ${row.currency || 'PLN'}` : row.salesCount}</Copy>{!!row.userId && <Button secondary onPress={() => router.push('/profile/' + row.userId)}>View profile</Button>}</Panel>)}
  </Screen>;
}
