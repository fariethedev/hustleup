import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Pressable, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { swapsApi } from '../src/api/client';
import { Screen, usePalette } from '../src/components/native/Kit';
import { errorMessage, money } from '../src/utils/marketplace';
import { mediaUrl, pickCroppedPhoto, uploadAsset } from '../src/utils/media';

const STATUS = { PENDING: ['Waiting for reply', '#F59E0B'], ACCEPTED: ['Accepted — swap items', '#22C55E'], DECLINED: ['Declined', '#EF4444'], WITHDRAWN: ['Withdrawn', '#9CA3AF'] };

function Side({ label, side, c }) {
  if (!side) return null;
  return (
    <View style={{ flex: 1, gap: 6 }}>
      <Text style={{ color: c.muted, fontSize: 11, fontWeight: '800' }}>{label}</Text>
      {side.imageUrl ? <Image source={{ uri: mediaUrl(side.imageUrl) }} style={{ width: '100%', aspectRatio: 1, borderRadius: 12 }} />
        : <View style={{ width: '100%', aspectRatio: 1, borderRadius: 12, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center' }}><Feather name="package" size={24} color={c.muted} /></View>}
      <Text style={{ color: c.text, fontWeight: '700', fontSize: 13 }} numberOfLines={2}>{side.title || side.text || 'Item'}</Text>
      {side.price != null && <Text style={{ color: c.muted, fontSize: 12 }}>{money(side.price, side.currency)}</Text>}
    </View>
  );
}

export default function Swaps() {
  const c = usePalette();
  const router = useRouter();
  const [tab, setTab] = useState('incoming');
  const [rows, setRows] = useState({ incoming: [], outgoing: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [i, o] = await Promise.all([swapsApi.incoming(), swapsApi.outgoing()]);
      setRows({ incoming: i.data || [], outgoing: o.data || [] });
    } catch (e) { Alert.alert('Swaps unavailable', errorMessage(e)); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const act = async (id, fn, done) => {
    setBusy(id);
    try { await fn(); await load(); if (done) Alert.alert(done); }
    catch (e) { Alert.alert('Could not update swap', errorMessage(e)); }
    finally { setBusy(null); }
  };
  const markReceived = async (swap) => {
    try {
      const photo = await pickCroppedPhoto([1, 1]);
      if (photo) act(swap.id, () => swapsApi.received(swap.id, uploadAsset(photo)), 'Thanks — receipt confirmed.');
    } catch (e) { Alert.alert('Photo access', e.message); }
  };

  const render = ({ item: s }) => {
    const [label, color] = STATUS[s.status] || [s.status, c.muted];
    const other = s.incoming ? s.proposerName : s.targetOwnerName;
    const myReceived = s.incoming ? s.ownerReceivedAt : s.proposerReceivedAt;
    const cashText = s.cashAmount ? `${s.cashDirection === 'PROPOSER_PAYS' ? (s.incoming ? 'They add' : 'You add') : (s.incoming ? 'You add' : 'They add')} ${money(s.cashAmount, s.cashCurrency)}` : null;
    return (
      <View style={{ backgroundColor: c.card, borderRadius: 20, borderWidth: 1, borderColor: c.line, padding: 14, gap: 12, marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {(s.incoming ? s.proposerAvatarUrl : s.targetOwnerAvatarUrl)
            ? <Image source={{ uri: mediaUrl(s.incoming ? s.proposerAvatarUrl : s.targetOwnerAvatarUrl) }} style={{ width: 34, height: 34, borderRadius: 17 }} />
            : <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: c.purpleSoft }} />}
          <Text style={{ color: c.text, fontWeight: '800', flex: 1 }} numberOfLines={1}>{s.incoming ? `${other} wants to swap` : `Offer to ${other}`}</Text>
          <View style={{ paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10, backgroundColor: `${color}22` }}><Text style={{ color, fontSize: 11, fontWeight: '800' }}>{label}</Text></View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Side label={s.incoming ? 'THEY GIVE' : 'YOU GIVE'} side={s.gives} c={c} />
          <Feather name="repeat" size={20} color={c.purple} />
          <Side label={s.incoming ? 'FOR YOUR' : 'FOR THEIR'} side={s.wants} c={c} />
        </View>
        {!!cashText && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: c.purpleSoft }}><Feather name="plus-circle" size={14} color={c.purple} /><Text style={{ color: c.purple, fontWeight: '800', fontSize: 12 }}>Top-up: {cashText}</Text></View>}
        {!!s.message && <Text style={{ color: c.muted, fontStyle: 'italic' }}>“{s.message}”</Text>}
        {busy === s.id ? <ActivityIndicator color={c.purple} /> : (
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {s.status === 'PENDING' && s.incoming && <>
              <TouchableOpacity onPress={() => act(s.id, () => swapsApi.accept(s.id), 'Swap accepted — arrange the handover in chat.')} style={{ flex: 1, minHeight: 42, borderRadius: 21, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#111', fontWeight: '800' }}>Accept</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => act(s.id, () => swapsApi.decline(s.id))} style={{ flex: 1, minHeight: 42, borderRadius: 21, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: c.text, fontWeight: '700' }}>Decline</Text></TouchableOpacity>
            </>}
            {s.status === 'PENDING' && !s.incoming && <TouchableOpacity onPress={() => act(s.id, () => swapsApi.withdraw(s.id))} style={{ flex: 1, minHeight: 42, borderRadius: 21, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: c.text, fontWeight: '700' }}>Withdraw offer</Text></TouchableOpacity>}
            {s.status === 'ACCEPTED' && !myReceived && <TouchableOpacity onPress={() => markReceived(s)} style={{ flex: 1, minHeight: 42, borderRadius: 21, backgroundColor: c.purple, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}><Feather name="camera" size={15} color="#FFF" /><Text style={{ color: '#FFF', fontWeight: '800' }}>I received it</Text></TouchableOpacity>}
            {s.status === 'ACCEPTED' && !!myReceived && <Text style={{ color: c.muted, fontSize: 12 }}>{s.handoverComplete ? 'Swap complete ✓' : 'You confirmed receipt — waiting for the other side.'}</Text>}
            {s.status !== 'DECLINED' && s.status !== 'WITHDRAWN' && <TouchableOpacity onPress={() => router.push({ pathname: '/(tabs)/messages', params: { partnerId: s.incoming ? s.proposerId : s.targetOwnerId, partnerName: other || '' } })} style={{ minHeight: 42, paddingHorizontal: 14, borderRadius: 21, borderWidth: 1, borderColor: c.purple, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}><Feather name="message-circle" size={15} color={c.purple} /><Text style={{ color: c.purple, fontWeight: '700' }}>Chat</Text></TouchableOpacity>}
          </View>
        )}
      </View>
    );
  };

  return (
    <Screen back title="Swaps" scroll={false}>
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingBottom: 10 }}>
        {[['incoming', `Received ${rows.incoming.length || ''}`], ['outgoing', `Sent ${rows.outgoing.length || ''}`]].map(([key, label]) => (
          <Pressable key={key} onPress={() => setTab(key)} style={{ flex: 1, minHeight: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: tab === key ? c.accent : c.card, borderWidth: 1, borderColor: tab === key ? c.accent : c.line }}>
            <Text style={{ color: tab === key ? (c.light ? '#FFF' : '#111') : c.muted, fontWeight: '800', fontSize: 13 }}>{label.trim()}</Text>
          </Pressable>
        ))}
      </View>
      <FlatList
        data={rows[tab]}
        keyExtractor={s => String(s.id)}
        renderItem={render}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 130 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={c.purple} />}
        ListEmptyComponent={!loading && <View style={{ alignItems: 'center', gap: 8, padding: 30 }}>
          <Feather name="repeat" size={32} color={c.purple} />
          <Text style={{ color: c.text, fontWeight: '800' }}>{tab === 'incoming' ? 'No swap offers yet' : 'You haven’t offered any swaps'}</Text>
          <Text style={{ color: c.muted, textAlign: 'center' }}>Listings marked “Open to swaps” show an Offer a swap button.</Text>
        </View>}
      />
    </Screen>
  );
}
