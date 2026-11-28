import React, { useCallback, useRef, useState } from 'react';
import { Pressable, RefreshControl, TextInput, View } from 'react-native';
import { useSelector } from 'react-redux';
import { Feather } from '../../src/components/native/Icon';
import { bookingsApi, reviewsApi, shopsApi } from '../../src/api/client';
import { useRemote } from '../../src/hooks/useRemote';
import { Button, Copy, Notice, Panel, Screen, Section, k, usePalette } from '../../src/components/native/Kit';
import { errorMessage } from '../../src/utils/marketplace';

export default function Reviews() {
  const user = useSelector(state => state.auth.user);
  const c = usePalette();
  const [selected, setSelected] = useState(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');
  const [submitted, setSubmitted] = useState([]);
  const lock = useRef(false);
  const fetcher = useCallback(async () => {
    if (!user?.id) return null;
    const results = await Promise.allSettled([reviewsApi.forUser(user.id), bookingsApi.getAll(), shopsApi.orders()]);
    const read = index => results[index].status === 'fulfilled' ? results[index].value.data : null;
    const bookings = (read(1) || []).filter(item => item.status === 'COMPLETED' && item.reviewedByMe !== true && item.buyerId !== item.sellerId).map(item => ({ key: 'booking:' + item.id, bookingId: item.id, title: item.listingTitle, person: item.role === 'seller' ? item.buyerName : item.sellerName }));
    const orders = (read(2) || []).filter(item => item.status === 'FULFILLED' && item.reviewedByMe !== true && item.sellerId !== user.id).map(item => ({ key: 'shop:' + item.id, shopOrderId: item.id, title: item.shopName || 'Store order', person: item.sellerName }));
    return { reviews: read(0), transactions: [...bookings, ...orders], partial: results.some(item => item.status === 'rejected') };
  }, [user]);
  const { data, loading, error, reload } = useRemote(fetcher);
  const save = async () => {
    if (lock.current || !selected || rating < 1) return;
    lock.current = true; setBusy(true); setFailure('');
    try {
      await reviewsApi.create({ ...(selected.bookingId ? { bookingId: selected.bookingId } : { shopOrderId: selected.shopOrderId }), rating, comment: comment.trim() });
      setSubmitted(previous => [...previous, selected.key]); setSelected(null); setRating(0); setComment(''); await reload();
    } catch (e) { setFailure(errorMessage(e, 'Could not save this review. Your rating and comment have been kept.')); }
    finally { lock.current = false; setBusy(false); }
  };
  const received = data?.reviews || [];
  const average = received.length ? (received.reduce((total, item) => total + item.rating, 0) / received.length).toFixed(1) : null;
  return <Screen back title="Reviews" refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={c.accent} />}>
    <Section eyebrow="Built on trust" title="Your reputation, in their words." subtitle="Real feedback from the people you have traded with." />
    {(error || data?.partial) && <Notice message={error || 'Some reviews or completed orders could not load.'} onRetry={reload} />}
    {loading && !data && <Notice loading message="Loading reviews…" />}
    {data?.reviews && <Panel><Copy heading style={{ fontSize: 32, lineHeight: 40 }}>{average ? average + ' / 5' : 'No rating yet'}</Copy><Copy muted>{received.length} received reviews</Copy>{[5, 4, 3, 2, 1].map(stars => <View key={stars} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Copy muted>{stars} ★</Copy><View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: c.line }}><View style={{ width: (received.length ? received.filter(item => item.rating === stars).length / received.length * 100 : 0) + '%', height: 6, backgroundColor: c.lime, borderRadius: 3 }} /></View><Copy muted>{received.filter(item => item.rating === stars).length}</Copy></View>)}</Panel>}
    {selected && <Panel><Copy heading>How was {selected.person || 'your experience'}?</Copy><Copy muted>{selected.title}</Copy><View style={{ flexDirection: 'row', gap: 8 }}>{[1, 2, 3, 4, 5].map(value => <Pressable key={value} accessibilityRole="button" accessibilityLabel={'Rate ' + value + ' stars'} accessibilityState={{ selected: value === rating }} disabled={busy} onPress={() => setRating(value)} style={{ minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' }}><Feather name="star" size={27} color={value <= rating ? c.accent : c.muted} /></Pressable>)}</View><TextInput accessibilityLabel="Review comment" value={comment} onChangeText={setComment} multiline editable={!busy} placeholder="Tell them what went well or could be better" placeholderTextColor={c.muted} style={[k.input, { minHeight: 110, paddingTop: 12, color: c.text, borderColor: c.line, textAlignVertical: 'top' }]} />{!!failure && <Copy accessibilityRole="alert" style={{ color: '#D55656' }}>{failure}</Copy>}<Button busy={busy} disabled={!rating} onPress={save}>Submit review</Button><Button secondary disabled={busy} onPress={() => { setSelected(null); setFailure(''); }}>Cancel</Button></Panel>}
    {!selected && (data?.transactions || []).filter(item => !submitted.includes(item.key)).map(item => <Panel key={item.key}><Copy heading>{item.title}</Copy><Copy muted>{item.person || 'Completed transaction'}</Copy><Button secondary icon="star" onPress={() => { setSelected(item); setRating(0); setComment(''); setFailure(''); }}>Write a review</Button></Panel>)}
    <Section title="Received reviews" />{received.map(item => <Panel key={item.id}><Copy heading>{item.reviewerName || 'Community member'}</Copy><Copy style={{ color: c.accent }}>{'★'.repeat(Math.max(0, Math.min(5, item.rating)))}</Copy>{!!item.comment && <Copy>{item.comment}</Copy>}<Copy muted style={{ fontSize: 11 }}>{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''}</Copy></Panel>)}{data?.reviews && !received.length && <Notice message="Your first review will appear here after a completed transaction." />}
  </Screen>;
}
