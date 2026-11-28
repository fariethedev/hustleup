import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Feather } from '../native/Icon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { listingsApi } from '../../api/client';
import { usePalette } from '../native/Kit';
import { errorMessage, money } from '../../utils/marketplace';

const n = v => (v == null || v === '' ? null : Number(v));
const DAYS_AHEAD = 14;
const TIMES = Array.from({ length: 21 }, (_, i) => [9 + Math.floor(i / 2), i % 2 ? 30 : 0]); // 09:00–19:00

const sameMinute = (a, b) => Math.abs(new Date(a).getTime() - new Date(b).getTime()) < 60000;
const dayLabel = d => d.toLocaleDateString([], { weekday: 'short' });
const when = iso => new Date(iso).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Everything a renter pays, laid out like a letting agent would: monthly and up front. */
export function RentalCosts({ listing }) {
  const c = usePalette();
  const rent = n(listing.price) || 0;
  const deposit = n(listing.depositAmount);
  const fee = n(listing.agentFeeAmount);
  const bills = n(listing.billsAmount);
  const moveIn = rent + (deposit || 0) + (fee || 0);
  const row = (label, value, hint, strong) => (
    <View key={label} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: c.line }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: strong ? c.text : c.muted, fontSize: 14, fontWeight: strong ? '800' : '500' }}>{label}</Text>
        {!!hint && <Text style={{ color: c.muted, fontSize: 12, marginTop: 1 }}>{hint}</Text>}
      </View>
      <Text style={{ color: c.text, fontSize: strong ? 17 : 15, fontWeight: strong ? '900' : '700' }}>{value}</Text>
    </View>
  );
  return (
    <View style={{ padding: 16, borderRadius: 18, backgroundColor: c.card, borderWidth: 1, borderColor: c.line }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <Feather name="home" size={16} color={c.accent} />
        <Text style={{ color: c.text, fontSize: 16, fontWeight: '800' }}>What it costs</Text>
      </View>
      {row('Rent', `${money(rent, listing.currency)} / month`)}
      {row('Deposit', deposit != null ? money(deposit, listing.currency) : 'Ask the agent', 'One-off, usually refundable')}
      {row('Agent fee', fee != null && fee > 0 ? money(fee, listing.currency) : listing.agentFee ? 'Applies, ask the agent' : 'None')}
      {row('Bills', bills != null ? `~${money(bills, listing.currency)} / month` : 'Ask the agent', 'Estimate, paid on top of rent')}
      {row('To move in', money(moveIn, listing.currency), 'First month + deposit + agent fee', true)}
    </View>
  );
}

function Avatar({ person, size = 34, ring }) {
  const c = usePalette();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: ring || c.card, backgroundColor: c.purpleSoft, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
      {person?.avatarUrl
        ? <Image source={{ uri: person.avatarUrl }} style={{ width: '100%', height: '100%' }} />
        : <Text style={{ color: c.purple, fontWeight: '900', fontSize: size * 0.4 }}>{(person?.name || '?')[0].toUpperCase()}</Text>}
    </View>
  );
}

/** Loads the viewing list for a rental and hands back booking actions. */
export function useViewings(listingId, enabled) {
  const [data, setData] = useState(null);
  const reload = useCallback(() => {
    if (!enabled) return Promise.resolve();
    return listingsApi.viewings(listingId)
      .then(res => setData(res.data))
      .catch(() => setData(d => d || { count: 0, viewers: [], slots: [], mine: null }));
  }, [listingId, enabled]);
  useEffect(() => { reload(); }, [reload]);
  return { data, reload };
}

/** "Who's coming to view" with avatars, the caller's own appointment, and the agent's list. */
export function ViewingSummary({ data, own, onBook, onCancel }) {
  const c = usePalette();
  if (!data) return null;
  const others = data.viewers || [];
  return (
    <View style={{ padding: 16, borderRadius: 18, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Feather name="calendar" size={16} color={c.accent} />
        <Text style={{ color: c.text, fontSize: 16, fontWeight: '800', flex: 1 }}>Viewings</Text>
        <Text style={{ color: c.muted, fontSize: 13 }}>{data.count === 0 ? 'None booked yet' : `${data.count} booked`}</Text>
      </View>

      {others.length > 0 && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flexDirection: 'row' }}>
          {others.slice(0, 5).map((p, i) => <View key={i} style={{ marginLeft: i ? -10 : 0 }}><Avatar person={p} /></View>)}
        </View>
        <Text style={{ color: c.muted, fontSize: 13, flex: 1 }} numberOfLines={2}>
          {others.slice(0, 2).map(p => p.name).join(', ')}{others.length > 2 ? ` and ${others.length - 2} more` : ''} {others.length === 1 ? 'is' : 'are'} viewing this place
        </Text>
      </View>}
      {others.length === 0 && !data.mine && !own && <Text style={{ color: c.muted, fontSize: 13 }}>Be the first to see it. Pick a time that suits you, and the agent will be told straight away.</Text>}

      {!!data.mine && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, backgroundColor: c.purpleSoft }}>
        <Feather name="check-circle" size={18} color={c.purple} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.purple, fontWeight: '800' }}>Your viewing</Text>
          <Text style={{ color: c.text, fontSize: 13 }}>{when(data.mine.scheduledAt)}</Text>
        </View>
        <Pressable onPress={onBook} hitSlop={8}><Text style={{ color: c.purple, fontWeight: '800', fontSize: 13 }}>Change</Text></Pressable>
        <Pressable onPress={onCancel} hitSlop={8}><Text style={{ color: c.danger, fontWeight: '800', fontSize: 13 }}>Cancel</Text></Pressable>
      </View>}

      {own && (data.appointments?.length
        ? data.appointments.map(a => <View key={a.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Avatar person={a} size={36} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.text, fontWeight: '700' }}>{a.name}</Text>
              <Text style={{ color: c.muted, fontSize: 12 }}>{when(a.scheduledAt)}{a.note ? ` · ${a.note}` : ''}</Text>
            </View>
          </View>)
        : <Text style={{ color: c.muted, fontSize: 13 }}>When someone books a viewing it shows up here and in your notifications.</Text>)}
    </View>
  );
}

/** Bottom sheet: pick a day and a time, add a note, book. */
export function ViewingSheet({ visible, listing, data, onClose, onBooked }) {
  const c = usePalette();
  const insets = useSafeAreaInsets();
  const { days, earliest } = useMemo(() => {
    const start = new Date();
    return {
      earliest: start.getTime() + 30 * 60000,
      days: Array.from({ length: DAYS_AHEAD }, (_, i) => { const d = new Date(start); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + i); return d; }),
    };
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps
  const [day, setDay] = useState(0);
  const [time, setTime] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const slotAt = (d, [h, m]) => { const t = new Date(d); t.setHours(h, m, 0, 0); return t; };
  const info = t => (data?.slots || []).find(s => sameMinute(s.scheduledAt, t));

  const book = async () => {
    if (!time) return;
    setBusy(true);
    try {
      await listingsApi.bookViewing(listing.id, time.toISOString(), note.trim() || undefined);
      setNote(''); setTime(null);
      onBooked?.(time);
    } catch (e) { Alert.alert('Viewing not booked', errorMessage(e, 'Please try another time.')); }
    finally { setBusy(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#0006' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Close" />
        <View style={{ backgroundColor: c.bg, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 16), maxHeight: '88%' }}>
          <View style={{ alignSelf: 'center', width: 42, height: 5, borderRadius: 3, backgroundColor: c.line, marginBottom: 12 }} />
          <ScrollView contentContainerStyle={{ paddingHorizontal: 18, gap: 14 }} keyboardShouldPersistTaps="handled">
            <View>
              <Text style={{ color: c.text, fontSize: 21, fontWeight: '800' }}>Book a viewing</Text>
              <Text style={{ color: c.muted, fontSize: 14, marginTop: 2 }} numberOfLines={1}>{listing?.title}{listing?.locationCity ? ` · ${listing.locationCity}` : ''}</Text>
            </View>

            <Text style={{ color: c.text, fontWeight: '800' }}>Day</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {days.map((d, i) => {
                const on = i === day;
                return <Pressable key={i} onPress={() => { setDay(i); setTime(null); }} accessibilityRole="radio" accessibilityState={{ checked: on }}
                  style={{ width: 58, paddingVertical: 10, borderRadius: 16, alignItems: 'center', backgroundColor: on ? c.lime : c.card, borderWidth: 1, borderColor: on ? c.lime : c.line }}>
                  <Text style={{ color: on ? '#151A00' : c.muted, fontSize: 12, fontWeight: '700' }}>{i === 0 ? 'Today' : dayLabel(d)}</Text>
                  <Text style={{ color: on ? '#151A00' : c.text, fontSize: 18, fontWeight: '900' }}>{d.getDate()}</Text>
                </Pressable>;
              })}
            </ScrollView>

            <Text style={{ color: c.text, fontWeight: '800' }}>Time</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {TIMES.map(hm => {
                const t = slotAt(days[day], hm);
                const s = info(t);
                const past = t.getTime() < earliest;
                const full = s?.full;
                const on = time && sameMinute(time, t);
                const mine = data?.mine && sameMinute(data.mine.scheduledAt, t);
                const disabled = past || (full && !mine);
                return <Pressable key={hm.join(':')} disabled={disabled} onPress={() => setTime(t)} accessibilityLabel={`${t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}${s ? `, ${s.count} booked` : ''}`}
                  style={{ width: '23%', paddingVertical: 9, borderRadius: 12, alignItems: 'center', opacity: disabled ? 0.35 : 1,
                    backgroundColor: on ? c.lime : mine ? c.purpleSoft : c.card, borderWidth: 1, borderColor: on ? c.lime : c.line }}>
                  <Text style={{ color: on ? '#151A00' : c.text, fontWeight: '800', fontSize: 14 }}>{`${String(hm[0]).padStart(2, '0')}:${hm[1] ? '30' : '00'}`}</Text>
                  {!!s && <Text style={{ color: on ? '#151A00' : c.muted, fontSize: 10, fontWeight: '700' }}>{full ? 'Full' : `${s.count} going`}</Text>}
                </Pressable>;
              })}
            </View>

            <TextInput value={note} onChangeText={setNote} placeholder="Anything the agent should know? (optional)" placeholderTextColor={c.muted} maxLength={500} multiline
              style={{ minHeight: 64, borderRadius: 14, borderWidth: 1, borderColor: c.line, backgroundColor: c.card, padding: 14, color: c.text, fontSize: 15, textAlignVertical: 'top' }} />

            <Pressable onPress={book} disabled={!time || busy} accessibilityRole="button"
              style={{ minHeight: 54, borderRadius: 27, backgroundColor: c.lime, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, opacity: !time || busy ? 0.5 : 1 }}>
              {busy ? <ActivityIndicator color="#151A00" /> : <><Feather name="calendar" size={18} color="#151A00" /><Text style={{ color: '#151A00', fontSize: 16, fontWeight: '800' }}>{time ? `Book ${when(time.toISOString())}` : 'Pick a time'}</Text></>}
            </Pressable>
            <Text style={{ color: c.muted, fontSize: 12, textAlign: 'center' }}>Free to book. Never pay a deposit before you&apos;ve seen the place.</Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export const confirmCancelViewing = (listingId, done) => Alert.alert('Cancel your viewing?', 'The agent will be told.', [
  { text: 'Keep it', style: 'cancel' },
  { text: 'Cancel viewing', style: 'destructive', onPress: async () => {
    try { await listingsApi.cancelViewing(listingId); done?.(); }
    catch (e) { Alert.alert('Could not cancel', errorMessage(e, 'Please try again.')); }
  } },
]);
