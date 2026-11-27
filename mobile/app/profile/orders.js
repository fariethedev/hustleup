import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import * as WebBrowser from 'expo-web-browser';
import { bookingsApi, shopsApi, claimsApi, payoutsApi } from '../../src/api/client';
import { errorMessage, money } from '../../src/utils/marketplace';
import { deliverySteps, orderLabel, orderState } from '../../src/utils/orderState';
import { stripeUrl } from '../../src/utils/secureLinks';

const reasons = [['NOT_RECEIVED', 'Not received'], ['DAMAGED', 'Arrived damaged'], ['NOT_AS_DESCRIBED', 'Not as described'], ['OTHER', 'Something else']];
/**
 * Delivery progress as a vertical timeline, like a courier app: done steps are filled, the
 * current one is highlighted, the rest are dimmed. Built from the same step list sellers pick
 * from, so the two can never disagree.
 */
function OrderTimeline({ order, colors }) {
  const f = order.fulfilment || {};
  const steps = deliverySteps[f.shippingMethod] || deliverySteps.NONE;
  const paid = ['PAID', 'TRANSFERRED'].includes(order.paymentStatus) || ['PAID', 'FULFILLED', 'COMPLETED'].includes(order.status);
  const confirmed = !!f.buyerConfirmedAt;
  const reached = confirmed ? steps.length - 1 : Math.max(steps.indexOf(f.fulfilmentStatus), paid ? 0 : -1);
  const when = { SHIPPED: f.shippedAt, DELIVERED: f.deliveredAt, COLLECTED: f.deliveredAt };
  const all = [...steps, 'RECEIVED'];
  return (
    <View style={{ gap: 0, paddingLeft: 2 }}>
      {all.map((step, i) => {
        const done = step === 'RECEIVED' ? confirmed : i <= reached;
        const current = step === 'RECEIVED' ? false : i === reached && !confirmed;
        const color = done ? colors.accent : colors.line;
        return (
          <View key={step} style={{ flexDirection: 'row', gap: 12, minHeight: 34 }}>
            <View style={{ alignItems: 'center', width: 22 }}>
              <View style={{ width: current ? 22 : 16, height: current ? 22 : 16, borderRadius: 11, backgroundColor: done ? colors.accent : colors.card, borderWidth: 2, borderColor: color, alignItems: 'center', justifyContent: 'center', marginTop: current ? 0 : 3 }}>
                {done && <Feather name="check" size={current ? 13 : 10} color="#111" />}
              </View>
              {i < all.length - 1 && <View style={{ width: 2, flex: 1, backgroundColor: i < reached || (confirmed && i < all.length - 1) ? colors.accent : colors.line, marginVertical: 2 }} />}
            </View>
            <View style={{ flex: 1, paddingBottom: 8 }}>
              <Text style={{ color: done ? colors.text : colors.muted, fontWeight: current ? '800' : '600', textTransform: 'capitalize' }}>{step === 'RECEIVED' ? 'Receipt confirmed' : orderLabel(step)}</Text>
              {!!when[step] && done && <Text style={{ color: colors.muted, fontSize: 12 }}>{new Date(when[step]).toLocaleString()}</Text>}
              {current && step !== 'DELIVERED' && step !== 'COLLECTED' && !!f.estimatedDelivery && <Text style={{ color: colors.muted, fontSize: 12 }}>Estimated delivery {new Date(f.estimatedDelivery).toLocaleDateString()}</Text>}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const stepIcons = { CONFIRMED: 'check-circle', PREPARING: 'package', SHIPPED: 'truck', OUT_FOR_DELIVERY: 'truck', READY_FOR_PICKUP: 'map-pin', DELIVERED: 'check-circle', COLLECTED: 'check-circle' };

export default function OrdersScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const user = useSelector(state => state.auth.user);
  const light = useColorScheme() === 'light';
  const colors = light ? { bg: '#F7F7F5', card: '#FFF', text: '#171717', muted: '#666', line: '#DDD', accent: '#526B00' } : { bg: '#080808', card: '#151515', text: '#FFF', muted: '#AAA', line: '#333', accent: '#CDFF00' };
  const [orders, setOrders] = useState([]);
  const [claims, setClaims] = useState([]);
  const [claimsReady, setClaimsReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [tab, setTab] = useState(params.view === 'selling' ? 'selling' : 'buying');
  const [dialog, setDialog] = useState(null);
  const [detail, setDetail] = useState('');
  const [reason, setReason] = useState('NOT_RECEIVED');
  const [amount, setAmount] = useState('');
  const [formError, setFormError] = useState('');
  const [delivery, setDelivery] = useState({ status: '', carrier: '', trackingNumber: '', trackingUrl: '', note: '' });
  const [feePercent, setFeePercent] = useState(null);
  const listRef = useRef(null);
  // Set when another screen (a chat offer card, a notification) links to one booking: the
  // list switches to the tab that booking lives on, scrolls to it and highlights it.
  const focusId = typeof params.bookingId === 'string' ? params.bookingId : null;
  const [highlightId, setHighlightId] = useState(null);

  const load = useCallback(async () => {
    const results = await Promise.allSettled([bookingsApi.getAll(), shopsApi.orders(), shopsApi.sales(), claimsApi.mine()]);
    const read = index => results[index].status === 'fulfilled' ? results[index].value.data || [] : [];
    setOrders([
      ...read(0).map(order => ({ ...order, kind: 'booking' })),
      ...read(1).map(order => ({ ...order, kind: 'shop', role: 'buyer' })),
      ...read(2).map(order => ({ ...order, kind: 'shop', role: 'seller' })),
    ].sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0)));
    setClaims(read(3));
    setClaimsReady(results[3].status === 'fulfilled');
    const failed = results.some((result, index) => result.status === 'rejected' && !(index === 2 && result.reason?.response?.status === 403));
    setError(failed ? 'Some order information could not load. Pull down to retry. Receipt approval stays disabled if problem reports cannot be checked.' : '');
    setLoading(false); setRefreshing(false);
  }, []);
  useFocusEffect(useCallback(() => {
    load();
    payoutsApi.status().then(r => setFeePercent(Number(r.data?.platformFeePercent))).catch(() => {});
    const listener = AppState.addEventListener('change', state => { if (state === 'active') load(); });
    return () => listener.remove();
  }, [load]));

  const run = async (operation, inDialog = false) => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setFormError('');
    try { await operation(); if (inDialog) setDialog(null); await load(); }
    catch (failure) {
      const message = errorMessage(failure, failure.message || 'Something went wrong. Please retry.');
      if (inDialog) setFormError(message); else Alert.alert('Could not update order', message);
      // A stale negotiation must be re-read before another offer can be made.
      if (failure.response?.status === 409) await load();
    } finally { busyRef.current = false; setBusy(false); }
  };
  const open = (mode, order) => {
    setDialog({ mode, order }); setDetail(''); setReason('NOT_RECEIVED'); setAmount(''); setFormError('');
    const f = order.fulfilment || {};
    setDelivery({ status: f.fulfilmentStatus || 'CONFIRMED', carrier: f.carrier || '', trackingNumber: f.trackingNumber || '', trackingUrl: f.trackingUrl || '', note: '' });
  };
  const close = () => { if (!busyRef.current) setDialog(null); };
  const Button = ({ title, icon, onPress, disabled = false, primary = false }) => <Pressable accessibilityRole="button" accessibilityState={{ disabled: disabled || busy }} disabled={disabled || busy} onPress={onPress} style={[s.button, { borderColor: colors.line, backgroundColor: primary ? '#CDFF00' : colors.card, opacity: disabled || busy ? .45 : 1 }]}>
    {icon && <Feather name={icon} size={18} color={primary ? '#161A00' : colors.accent} />}<Text style={{ color: primary ? '#161A00' : colors.text, fontWeight: '700' }}>{title}</Text>
  </Pressable>;
  const claimFor = order => claims.find(claim => claim.orderId === order.id && claim.orderType === (order.kind === 'shop' ? 'SHOP_ORDER' : 'BOOKING'));
  const filtered = orders.filter(order => tab === 'all' || (tab === 'buying') === orderState(order, user?.id).buyer);

  // Step 1 of focusing a linked booking: once orders load, pick the tab it belongs to.
  useEffect(() => {
    if (!focusId || loading) return;
    const target = orders.find(order => order.kind === 'booking' && String(order.id) === focusId);
    if (!target) {
      Alert.alert('Offer not found', 'This offer may have been cancelled, or it belongs to a different account.');
      router.setParams({ bookingId: undefined });
      return;
    }
    setTab(orderState(target, user?.id).buyer ? 'buying' : 'selling');
    setHighlightId(target.id);
  }, [focusId, loading, orders, router, user?.id]);

  // Step 2: after the tab has re-rendered, scroll the card into view, then clear the param
  // so pulling to refresh or coming back later does not jump again.
  useEffect(() => {
    if (!highlightId) return;
    const index = filtered.findIndex(order => order.kind === 'booking' && order.id === highlightId);
    if (index < 0) return;
    const timer = setTimeout(() => {
      listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.1 });
      router.setParams({ bookingId: undefined });
    }, 250);
    return () => clearTimeout(timer);
  }, [highlightId, filtered.length, tab]); // eslint-disable-line react-hooks/exhaustive-deps
  const submit = () => {
    const { mode, order } = dialog;
    if (mode === 'claim') return run(() => claimsApi.raise(order.kind === 'shop' ? 'SHOP_ORDER' : 'BOOKING', order.id, reason, detail.trim()), true);
    if (mode === 'counter') return run(() => bookingsApi.counter(order.id, Number(amount.replace(',', '.')), order.version), true);
    return run(() => (order.kind === 'shop' ? shopsApi : bookingsApi).updateFulfilment(order.id, delivery), true);
  };
  const renderOrder = ({ item: order }) => {
    const claim = claimFor(order), state = orderState(order, user?.id, claim);
    const api = order.kind === 'shop' ? shopsApi : bookingsApi;
    const focused = order.kind === 'booking' && order.id === highlightId;
    return <View style={[s.card, { backgroundColor: colors.card, borderColor: focused ? colors.accent : colors.line, borderWidth: focused ? 2 : 1 }]}>
      {focused && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: '#CDFF00' }}>
        <Feather name="tag" size={12} color="#161A00" /><Text style={{ color: '#161A00', fontSize: 11, fontWeight: '800' }}>{state.canRespond ? 'THIS OFFER IS WAITING FOR YOU' : 'THE OFFER YOU OPENED'}</Text>
      </View>}
      <Text style={{ color: colors.accent, fontSize: 12, textTransform: 'capitalize' }}>{order.kind === 'shop' ? 'Store order' : 'Marketplace booking'} · {orderLabel(order.status)}</Text>
      <Text style={[s.title, { color: colors.text }]}>{order.listingTitle || order.productName || 'Order'}</Text>
      <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>{money(order.totalPrice ?? order.agreedPrice ?? order.counterPrice ?? order.offeredPrice, order.currency)}</Text>
      {[['credit-card', 'Payment', state.paid ? 'Payment received' : orderLabel(order.paymentStatus || order.status)],
        ['truck', 'Delivery', orderLabel(order.fulfilment?.fulfilmentStatus)],
        ['shield', 'Seller payout', state.payout]].map(([icon, label, value]) => <View key={label} style={s.row}><Feather name={icon} size={20} color={colors.accent} /><View style={{ flex: 1 }}><Text style={{ color: colors.muted, fontSize: 12 }}>{label}</Text><Text style={{ color: colors.text, textTransform: 'capitalize', marginTop: 3 }}>{value}</Text></View></View>)}
      {state.paid && state.active && <OrderTimeline order={order} colors={colors} />}
      {!!order.fulfilment?.trackingNumber && <View style={[s.row, { justifyContent: 'space-between' }]}>
        <Text selectable style={{ color: colors.muted, flex: 1 }}>{order.fulfilment.carrier || 'Tracking'} · {order.fulfilment.trackingNumber}</Text>
        {!!order.fulfilment.trackingUrl && /^https:\/\//.test(order.fulfilment.trackingUrl) && <Pressable accessibilityRole="link" onPress={() => WebBrowser.openBrowserAsync(order.fulfilment.trackingUrl)}><Text style={{ color: colors.accent, fontWeight: '700' }}>Track parcel</Text></Pressable>}
      </View>}
      {!state.buyer && feePercent > 0 && state.paid && <Text style={{ color: colors.muted, fontSize: 12 }}>You receive {money((Number(order.totalPrice ?? order.agreedPrice ?? 0)) * (1 - feePercent / 100) + Number(order.fulfilment?.shippingPrice || 0), order.currency)} after the {feePercent}% platform fee (delivery passes through in full).</Text>}
      {!!claim && <Text style={{ color: colors.accent }}>Problem report: {orderLabel(claim.status)}{claim.resolutionNote ? ' — ' + claim.resolutionNote : ''}</Text>}
      <View style={s.actions}>
        {state.canRespond && <><Button title="Accept offer" icon="check" primary onPress={() => run(() => bookingsApi.accept(order.id, order.version))} /><Button title="Counter offer" icon="edit-2" onPress={() => open('counter', order)} /></>}
        {state.canPay && <Button title="Pay securely" icon="credit-card" primary onPress={() => run(async () => { const { data } = await bookingsApi.checkoutSession(order.id); await WebBrowser.openBrowserAsync(stripeUrl(data.url)); })} />}
        {state.canReceive && <Button title="Confirm received" icon="check-circle" primary disabled={!claimsReady} onPress={() => Alert.alert('Have you checked your goods?', 'Confirm only after checking your purchase. This approves the seller’s payment, subject to payout checks.', [{ text: 'Not yet', style: 'cancel' }, { text: 'Confirm received', onPress: () => run(() => api.confirmReceipt(order.id)) }])} />}
        {state.canReport && <Button title="Report a problem" icon="alert-circle" disabled={!claimsReady} onPress={() => open('claim', order)} />}
        {state.canTrack && <Button title="Update delivery" icon="truck" onPress={() => open('delivery', order)} />}
        {(state.buyer ? order.sellerId : order.buyerId) && <Button title={state.buyer ? 'Message seller' : 'Message buyer'} icon="message-circle" onPress={() => router.push({ pathname: '/(tabs)/messages', params: { partnerId: state.buyer ? order.sellerId : order.buyerId, partnerName: (state.buyer ? order.sellerName : order.buyerName || order.customerName) || '' } })} />}
        {order.kind === 'booking' && ['INQUIRED', 'NEGOTIATING'].includes(order.status) && <Button title="Cancel request" onPress={() => Alert.alert('Cancel this request?', 'No payment is taken for an unaccepted request.', [{ text: 'Keep it', style: 'cancel' }, { text: 'Cancel request', style: 'destructive', onPress: () => run(() => bookingsApi.cancel(order.id, 'Cancelled from mobile')) }])} />}
      </View>
      <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>Check your purchase before confirming receipt. Seller delivery updates do not approve their own payout. Payment holds, open claims and bank verification still apply.</Text>
    </View>;
  };
  return <SafeAreaView style={[s.screen, { backgroundColor: colors.bg }]}>
    <View style={s.header}><Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/profile')} style={s.back}><Feather name="arrow-left" size={24} color={colors.text} /></Pressable><Text style={[s.heading, { color: colors.text }]}>Your orders</Text></View>
    <View style={s.tabs}>{['buying', 'selling', 'all'].map(value => <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: tab === value }} onPress={() => setTab(value)} style={[s.button, { backgroundColor: tab === value ? '#CDFF00' : colors.card, borderColor: colors.line }]}><Text style={{ color: tab === value ? '#161A00' : colors.text, textTransform: 'capitalize', fontWeight: '700' }}>{value}</Text></Pressable>)}</View>
    {!!error && <Text accessibilityRole="alert" style={[s.error, { color: light ? '#9F2424' : '#FCA5A5' }]}>{error}</Text>}
    {loading ? <ActivityIndicator color={colors.accent} style={{ margin: 40 }} /> : <FlatList ref={listRef} onScrollToIndexFailed={({ index, averageItemLength }) => { listRef.current?.scrollToOffset({ offset: index * averageItemLength, animated: true }); setTimeout(() => listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.1 }), 300); }} data={filtered} keyExtractor={order => order.kind + order.id} renderItem={renderOrder} contentContainerStyle={s.list} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.accent} />} ListEmptyComponent={<View style={s.card}><Text style={{ color: colors.text, fontSize: 18 }}>{error ? 'Orders unavailable' : 'No orders here yet'}</Text><Button title={error ? 'Retry' : 'Explore listings'} onPress={() => error ? load() : router.push('/(tabs)/explore')} /></View>} />}
    <Modal visible={!!dialog} animationType="slide" onRequestClose={close} presentationStyle="pageSheet">
      <SafeAreaView style={[s.screen, { backgroundColor: colors.bg }]}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.list}>
        <Button title="Close" icon="x" onPress={close} />
        <Text style={[s.heading, { color: colors.text }]}>{dialog?.mode === 'claim' ? 'Report a problem' : dialog?.mode === 'counter' ? 'Make a counter offer' : 'Update delivery'}</Text>
        <Text style={{ color: colors.muted }}>{dialog?.order.listingTitle || dialog?.order.productName}</Text>
        {dialog?.mode === 'claim' ? <>
          <Text style={{ color: colors.muted, lineHeight: 22 }}>Tell us what happened. An open report holds any unreleased payout while it is reviewed; it does not automatically refund an already released payment.</Text>
          {reasons.map(([value, label]) => <Button key={value} title={label} primary={reason === value} onPress={() => setReason(value)} />)}
          <TextInput accessibilityLabel="Describe the problem" placeholder="Describe the problem (at least 10 characters)" placeholderTextColor={colors.muted} multiline maxLength={1000} value={detail} onChangeText={setDetail} editable={!busy} style={[s.input, { color: colors.text, borderColor: colors.line, minHeight: 130 }]} />
        </> : dialog?.mode === 'counter' ? <><Text style={{ color: colors.muted }}>Offers alternate until one of you accepts. Payment happens only after agreement.</Text><TextInput accessibilityLabel="Counter offer amount" keyboardType="decimal-pad" placeholder="Amount" placeholderTextColor={colors.muted} value={amount} onChangeText={setAmount} editable={!busy} style={[s.input, { color: colors.text, borderColor: colors.line }]} /></> : dialog && <>
          {(deliverySteps[dialog.order.fulfilment?.shippingMethod] || deliverySteps.NONE).map(step => { const steps = deliverySteps[dialog.order.fulfilment?.shippingMethod] || deliverySteps.NONE; const previous = steps.indexOf(dialog.order.fulfilment?.fulfilmentStatus); return <Button key={step} title={orderLabel(step)} icon={stepIcons[step]} primary={delivery.status === step} disabled={steps.indexOf(step) < previous} onPress={() => setDelivery({ ...delivery, status: step })} />; })}
          {['COURIER', 'POST', 'PARCEL_LOCKER'].includes(dialog.order.fulfilment?.shippingMethod) && ['carrier', 'trackingNumber', 'trackingUrl'].map(field => <TextInput key={field} autoCapitalize={field === 'trackingUrl' ? 'none' : 'sentences'} keyboardType={field === 'trackingUrl' ? 'url' : 'default'} accessibilityLabel={field === 'carrier' ? 'Carrier' : field === 'trackingUrl' ? 'Tracking link' : 'Tracking number'} placeholder={field === 'carrier' ? 'Carrier (e.g. InPost, DPD)' : field === 'trackingUrl' ? 'Tracking link (https://…)' : 'Tracking number'} placeholderTextColor={colors.muted} value={delivery[field]} onChangeText={value => setDelivery({ ...delivery, [field]: value })} editable={!busy} style={[s.input, { color: colors.text, borderColor: colors.line }]} />)}
          <TextInput accessibilityLabel="Delivery note" placeholder="Optional note for the buyer" placeholderTextColor={colors.muted} value={delivery.note} onChangeText={note => setDelivery({ ...delivery, note })} editable={!busy} maxLength={1000} style={[s.input, { color: colors.text, borderColor: colors.line }]} />
        </>}
        {!!formError && <Text accessibilityRole="alert" style={{ color: light ? '#9F2424' : '#FCA5A5' }}>{formError}</Text>}
        <Button title={busy ? 'Saving…' : dialog?.mode === 'claim' ? 'Submit report' : dialog?.mode === 'counter' ? 'Send counter offer' : 'Save & notify buyer'} primary disabled={dialog?.mode === 'claim' ? detail.trim().length < 10 : dialog?.mode === 'counter' ? !(Number(amount.replace(',', '.')) > 0 && Number.isFinite(Number(amount.replace(',', '.')))) : false} onPress={submit} />
      </ScrollView></KeyboardAvoidingView></SafeAreaView>
    </Modal>
  </SafeAreaView>;
}
const s = StyleSheet.create({
  screen: { flex: 1 }, header: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16 },
  back: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  heading: { fontSize: 26, fontWeight: '800' }, title: { fontSize: 20, fontWeight: '700' },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingBottom: 12 },
  list: { padding: 20, paddingBottom: 48, gap: 16 }, card: { borderWidth: 1, borderRadius: 22, padding: 18, gap: 14, marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: { minHeight: 48, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  input: { minHeight: 52, padding: 14, borderWidth: 1, borderRadius: 14, textAlignVertical: 'top', fontSize: 16 },
  error: { paddingHorizontal: 20, paddingBottom: 12, lineHeight: 20 },
});
