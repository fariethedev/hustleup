import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as Haptics from 'expo-haptics';
import { useCart } from '../src/store/CartProvider';
import { bookingsApi, shopsApi } from '../src/api/client';
import { cartKey, checkoutPrompts, errorMessage, money } from '../src/utils/marketplace';
import { stripeUrl } from '../src/utils/secureLinks';
import { mediaUrl } from '../src/utils/media';
import { usePalette } from '../src/components/native/Kit';

const PAID = ['PAID', 'FULFILLED', 'COMPLETED', 'TRANSFERRED'];
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
/** One Stripe payment per currency; almost every cart has exactly one. */
const payGroup = item => `pay:${item.currency || 'PLN'}`;
const needsAddress = rows => rows.some(row => row.shippingMethod && !['NONE', 'PICKUP', 'DIGITAL'].includes(row.shippingMethod));

/** The order a payment session covers, tolerating sessions saved by the previous per-seller checkout. */
const sessionIds = session => ({
  bookings: session.bookingIds || (session.kind !== 'product' ? session.orderIds || [] : []),
  shopOrders: session.shopOrderIds || (session.kind === 'product' ? session.orderIds || [] : []),
});

/** Builds the whole-cart request: marketplace lines plus one basket per shop. */
function cartBody(rows, customer, answers) {
  const listings = rows.filter(r => r.kind !== 'product').map(r => ({ listingId: r.id, quantity: r.quantity, ...(r.ticketTier ? { ticketTier: r.ticketTier } : {}) }));
  const shops = Object.values(rows.filter(r => r.kind === 'product').reduce((acc, r) => {
    (acc[r.shopId] ||= { shopId: r.shopId, items: [] }).items.push({ productId: r.id, quantity: r.quantity });
    return acc;
  }, {}));
  return {
    listings, shops,
    customer: { ...customer, fullName: customer.name, answers },
    notes: customer.address ? `Delivery address: ${customer.address}` : '',
  };
}

/**
 * Checkout: who you are, where it goes, and one secure Stripe payment for everything in the
 * cart — however many sellers it came from. The cart screen is only for reviewing items.
 */
export default function CheckoutScreen() {
  const router = useRouter();
  const c = usePalette();
  const insets = useSafeAreaInsets();
  const user = useSelector(state => state.auth.user);
  const { items, ready, sessions, saveSession, finishSession, dropSession } = useCart();
  const [customer, setCustomer] = useState({ name: user?.fullName || '', email: user?.email || '', phone: '', address: '' });
  const [answers, setAnswers] = useState({});
  const [busy, setBusy] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [placed, setPlaced] = useState(null);
  const lock = useRef(false);
  const awaitingReturn = useRef(null);

  const groups = items.reduce((acc, item) => { (acc[payGroup(item)] ||= []).push(item); return acc; }, {});
  // Resume an unfinished payment first; otherwise the next currency that has not been paid.
  const openSession = Object.entries(sessions).find(([, s]) => s?.url);
  const nextGroup = openSession ? null : Object.entries(groups).find(([g]) => !sessions[g]);
  const current = openSession || nextGroup;
  const rows = openSession ? items.filter(item => openSession[1].keys?.includes(cartKey(item))) : nextGroup?.[1] || [];
  const currency = rows[0]?.currency || 'PLN';
  const subtotal = rows.reduce((t, r) => t + Number(r.price) * r.quantity, 0);
  const delivery = rows.reduce((t, r) => t + Number(r.shippingPrice || 0), 0);
  const sellerCount = new Set(rows.map(r => (r.kind === 'product' ? `shop:${r.shopId}` : `seller:${r.sellerId}`))).size;
  const prompts = rows.flatMap(r => checkoutPrompts(r).map(p => [r, p]));
  const wantsAddress = needsAddress(rows);

  /** Confirms with the server once the buyer is back from Stripe; retries while the webhook lands. */
  const verify = useCallback(async (group, { quiet = false } = {}) => {
    const session = sessions[group];
    if (!session) return false;
    const ids = sessionIds(session);
    setVerifying(true);
    try {
      const sessionId = session.sessionId || session.url?.match(/cs_(test|live)_[A-Za-z0-9]+/)?.[0];
      if (sessionId) await bookingsApi.confirmPayment(sessionId).catch(() => {});
      for (let attempt = 0; attempt < 5; attempt++) {
        const [b, o] = await Promise.all([
          ids.bookings.length ? bookingsApi.getAll().then(r => r.data || []) : [],
          ids.shopOrders.length ? shopsApi.orders().then(r => r.data || []) : [],
        ]);
        const bookings = b.filter(x => ids.bookings.includes(x.id));
        const orders = o.filter(x => ids.shopOrders.includes(x.id));
        const all = [...bookings, ...orders];
        if (all.length && all.every(x => PAID.includes(x.status) || PAID.includes(x.paymentStatus))) {
          finishSession(group);
          try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch { /* optional */ }
          setPlaced({ count: all.length, awaitingApproval: session.awaitingApproval?.length || 0 });
          return true;
        }
        if (all.length && all.every(x => ['CANCELLED', 'REFUNDED'].includes(x.status))) {
          finishSession(group); setError('This order was cancelled. Nothing was charged.'); return false;
        }
        if (attempt < 4) await wait(2000);
      }
      if (!quiet) setError('We haven’t received the payment yet. If you finished paying, it will appear in your orders shortly. Otherwise tap “Continue payment”.');
      return false;
    } catch (failure) {
      if (!quiet) setError(errorMessage(failure, 'Could not check your payment.'));
      return false;
    } finally { setVerifying(false); }
  }, [sessions, finishSession]);

  // Android custom tabs return immediately; the real "came back" moment is the app resuming.
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active' && awaitingReturn.current) { const g = awaitingReturn.current; awaitingReturn.current = null; verify(g); }
    });
    return () => sub.remove();
  }, [verify]);

  const openStripe = async (group, url) => {
    awaitingReturn.current = group;
    const result = await WebBrowser.openBrowserAsync(stripeUrl(url), { dismissButtonStyle: 'close', presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET });
    if (result.type !== 'opened' && awaitingReturn.current === group) { awaitingReturn.current = null; await verify(group); }
  };

  const pay = async () => {
    if (lock.current || busy || !current) return;
    lock.current = true; setError('');
    try {
      const [group] = current;
      if (sessions[group]?.url) { setBusy(true); await openStripe(group, sessions[group].url); return; }
      if (!customer.name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email.trim())) { setError('Add your name and a valid email address.'); return; }
      if (wantsAddress && !customer.address.trim()) { setError('Add the address your order should be delivered to.'); return; }
      if (prompts.some(([r, p]) => !answers[r.id]?.[p]?.trim())) { setError('Answer the seller’s questions to continue.'); return; }
      setBusy(true);
      const { data } = await bookingsApi.checkoutCart(cartBody(rows, customer, answers));
      if (!data.url) {
        // Everything needs the seller's approval first; nothing is charged yet.
        finishSession(group);
        setPlaced({ count: rows.length, awaitingApproval: data.awaitingApproval?.length || rows.length, nothingCharged: true });
        return;
      }
      const url = stripeUrl(data.url);
      saveSession(group, { keys: rows.map(cartKey), url, sessionId: data.url.match(/cs_(test|live)_[A-Za-z0-9]+/)?.[0], bookingIds: data.bookingIds || [], shopOrderIds: data.shopOrderIds || [], awaitingApproval: data.awaitingApproval || [] });
      await openStripe(group, url);
    } catch (failure) { setError(errorMessage(failure, 'Could not start the payment. Please try again.')); }
    finally { setBusy(false); lock.current = false; }
  };

  const input = { color: c.text, borderWidth: 1, borderColor: c.line, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, backgroundColor: c.bg };

  if (placed) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 14 }}>
        <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: placed.nothingCharged ? c.purpleSoft : `${c.accent}22`, alignItems: 'center', justifyContent: 'center' }}>
          <Feather name={placed.nothingCharged ? 'clock' : 'check'} size={44} color={placed.nothingCharged ? c.purple : c.accent} />
        </View>
        <Text style={{ color: c.text, fontSize: 22, fontWeight: '900', textAlign: 'center' }}>{placed.nothingCharged ? 'Request sent' : 'Payment successful'}</Text>
        <Text style={{ color: c.muted, textAlign: 'center', lineHeight: 21 }}>
          {placed.nothingCharged
            ? 'The seller needs to accept first. Nothing has been charged. We’ll notify you when it’s time to pay.'
            : `Your payment covered ${placed.count} order${placed.count === 1 ? '' : 's'}. Each seller has been told. Sellers are paid only after you confirm your order arrived.`}
          {!placed.nothingCharged && placed.awaitingApproval ? ` ${placed.awaitingApproval} item${placed.awaitingApproval === 1 ? ' needs' : 's need'} the seller’s approval before you pay.` : ''}
        </Text>
        <TouchableOpacity onPress={() => router.replace('/profile/orders')} style={{ alignSelf: 'stretch', minHeight: 54, borderRadius: 27, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#111', fontWeight: '900', fontSize: 16 }}>Track my orders</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => (items.length ? setPlaced(null) : router.replace('/(tabs)/explore'))} style={{ alignSelf: 'stretch', minHeight: 50, borderRadius: 25, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: c.text, fontWeight: '700' }}>{items.length ? 'Pay for the rest of your cart' : 'Keep shopping'}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const inFlight = current && sessions[current[0]]?.url;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10 }}>
          <TouchableOpacity accessibilityLabel="Back to cart" onPress={() => (router.canGoBack() ? router.back() : router.replace('/cart'))}
            style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: c.card, borderWidth: 1, borderColor: c.line }}>
            <Feather name="arrow-left" size={19} color={c.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.text, fontSize: 20, fontWeight: '900' }}>Checkout</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Feather name="lock" size={11} color={c.accent} /><Text style={{ color: c.muted, fontSize: 12 }}>Secure payment by Stripe</Text>
            </View>
          </View>
        </View>
        {/* Where you are: the cart is done, this screen is details then payment. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 8 }}>
          {[['Cart', true], ['Details', !inFlight], ['Payment', !!inFlight]].map(([label, on], i) => (
            <React.Fragment key={label}>
              {i > 0 && <View style={{ flex: 1, height: 2, borderRadius: 1, backgroundColor: i === 1 || inFlight ? c.purple : c.line }} />}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <View style={{ width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: i === 0 || on ? c.purple : c.line }}>
                  {i === 0 ? <Feather name="check" size={11} color="#FFF" /> : <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '900' }}>{i + 1}</Text>}
                </View>
                <Text style={{ color: on || i === 0 ? c.text : c.muted, fontSize: 12, fontWeight: '700' }}>{label}</Text>
              </View>
            </React.Fragment>
          ))}
        </View>

        {!ready ? <ActivityIndicator color={c.purple} style={{ marginTop: 40 }} /> : !current ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
            <Feather name="shopping-bag" size={36} color={c.purple} />
            <Text style={{ color: c.text, fontSize: 17, fontWeight: '800' }}>Nothing to pay for</Text>
            <Text style={{ color: c.muted, textAlign: 'center' }}>Add something to your cart first.</Text>
            <TouchableOpacity onPress={() => router.replace('/(tabs)/explore')} style={{ minHeight: 48, paddingHorizontal: 24, borderRadius: 24, backgroundColor: c.accent, justifyContent: 'center' }}><Text style={{ color: '#111', fontWeight: '900' }}>Explore</Text></TouchableOpacity>
          </View>
        ) : (
          <>
            <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 200 + insets.bottom }} keyboardShouldPersistTaps="handled">
              {/* Order summary */}
              <Card c={c} title={`Order summary · ${rows.length} item${rows.length === 1 ? '' : 's'}`} action="Edit" onAction={inFlight ? null : () => router.push('/cart')}>
                {rows.map(r => (
                  <View key={cartKey(r)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    {r.mediaUrls?.[0] || r.imageUrl ? <Image source={{ uri: mediaUrl(r.mediaUrls?.[0] || r.imageUrl) }} style={{ width: 44, height: 44, borderRadius: 10 }} />
                      : <View style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: c.soft }} />}
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: c.text, fontWeight: '600', fontSize: 13 }} numberOfLines={1}>{r.title || r.name}</Text>
                      <Text style={{ color: c.muted, fontSize: 11 }} numberOfLines={1}>{r.kind === 'product' ? r.shopName || 'Shop' : r.sellerName || 'Marketplace'} · Qty {r.quantity}</Text>
                    </View>
                    <Text style={{ color: c.text, fontWeight: '700', fontSize: 13 }}>{money(Number(r.price) * r.quantity, r.currency)}</Text>
                  </View>
                ))}
              </Card>

              {!inFlight && (
                <Card c={c} title="Your details">
                  <TextInput value={customer.name} onChangeText={v => setCustomer(p => ({ ...p, name: v }))} placeholder="Full name" placeholderTextColor={c.muted} autoComplete="name" style={input} />
                  <TextInput value={customer.email} onChangeText={v => setCustomer(p => ({ ...p, email: v }))} placeholder="Email for your receipt" placeholderTextColor={c.muted} keyboardType="email-address" autoCapitalize="none" autoComplete="email" style={input} />
                  <TextInput value={customer.phone} onChangeText={v => setCustomer(p => ({ ...p, phone: v }))} placeholder="Phone (optional, for the courier)" placeholderTextColor={c.muted} keyboardType="phone-pad" autoComplete="tel" style={input} />
                </Card>
              )}
              {!inFlight && wantsAddress && (
                <Card c={c} title="Delivery address">
                  <TextInput value={customer.address} onChangeText={v => setCustomer(p => ({ ...p, address: v }))} placeholder="Street, building, postcode, city" placeholderTextColor={c.muted} multiline autoComplete="street-address" style={[input, { minHeight: 70, textAlignVertical: 'top' }]} />
                </Card>
              )}
              {!inFlight && prompts.length > 0 && (
                <Card c={c} title="Questions from the seller">
                  {prompts.map(([r, p]) => (
                    <TextInput key={`${r.id}:${p}`} value={answers[r.id]?.[p] || ''} onChangeText={v => setAnswers(prev => ({ ...prev, [r.id]: { ...prev[r.id], [p]: v } }))} placeholder={p} placeholderTextColor={c.muted} style={input} />
                  ))}
                </Card>
              )}

              {/* Payment */}
              <Card c={c} title="Payment">
                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                  <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: '#635BFF', alignItems: 'center', justifyContent: 'center' }}><Feather name="credit-card" size={19} color="#FFF" /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: c.text, fontWeight: '800' }}>Pay on Stripe’s secure page</Text>
                    <Text style={{ color: c.muted, fontSize: 12, lineHeight: 17 }}>{sellerCount > 1 ? `One payment covers all ${sellerCount} sellers.` : 'Your card details never touch HustleSpace.'}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {['Card', 'BLIK', 'Apple Pay', 'Google Pay'].map(m => (
                    <View key={m} style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: c.line }}><Text style={{ color: c.text, fontSize: 11, fontWeight: '700' }}>{m}</Text></View>
                  ))}
                </View>
                {inFlight && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, backgroundColor: c.purpleSoft }}>
                    {verifying ? <ActivityIndicator color={c.purple} /> : <Feather name="clock" size={16} color={c.purple} />}
                    <Text style={{ color: c.text, flex: 1, fontSize: 13 }}>{verifying ? 'Checking your payment…' : 'Payment started but not confirmed yet.'}</Text>
                    {!verifying && <TouchableOpacity onPress={() => verify(current[0])}><Text style={{ color: c.purple, fontWeight: '800' }}>Check</Text></TouchableOpacity>}
                  </View>
                )}
              </Card>

              {Object.keys(groups).length > 1 && !inFlight && <Text style={{ color: c.muted, fontSize: 12 }}>Your cart has more than one currency. This payment covers the {currency} items; you’ll pay for the rest next.</Text>}
              {!!error && <Text accessibilityRole="alert" style={{ color: '#FF6B6B', lineHeight: 20 }}>{error}</Text>}
              {inFlight && !verifying && (
                <Pressable onPress={() => { dropSession(current[0]); setError(''); }} style={{ alignSelf: 'center', minHeight: 40, justifyContent: 'center' }}>
                  <Text style={{ color: c.muted, fontSize: 12, textDecorationLine: 'underline' }}>Cancel this payment and edit my cart</Text>
                </Pressable>
              )}
            </ScrollView>

            <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, paddingBottom: insets.bottom + 12, backgroundColor: c.bg, borderTopWidth: 1, borderTopColor: c.line, gap: 5 }}>
              <Line c={c} label="Items" value={money(subtotal, currency)} />
              <Line c={c} label="Delivery" value={delivery ? money(delivery, currency) : 'Free'} />
              <Line c={c} label="Buyer fees" value="None" />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
                <Text style={{ color: c.text, fontWeight: '900', fontSize: 17 }}>Total</Text>
                <Text style={{ color: c.text, fontWeight: '900', fontSize: 17 }}>{money(subtotal + delivery, currency)}</Text>
              </View>
              <TouchableOpacity accessibilityRole="button" disabled={busy || verifying} onPress={pay}
                style={{ marginTop: 6, minHeight: 56, borderRadius: 28, backgroundColor: c.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: busy || verifying ? 0.6 : 1 }}>
                {busy ? <ActivityIndicator color="#111" /> : <>
                  <Feather name="lock" size={16} color="#111" />
                  <Text style={{ color: '#111', fontWeight: '900', fontSize: 16 }}>{inFlight ? 'Continue payment' : `Pay ${money(subtotal + delivery, currency)}`}</Text>
                </>}
              </TouchableOpacity>
              <Text style={{ color: c.muted, fontSize: 10, textAlign: 'center' }}>Buyer protection: sellers are paid only after you confirm delivery.</Text>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Card({ c, title, action, onAction, children }) {
  return (
    <View style={{ backgroundColor: c.card, borderRadius: 20, borderWidth: 1, borderColor: c.line, padding: 14, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ color: c.text, fontWeight: '800', fontSize: 15, flex: 1 }}>{title}</Text>
        {action && onAction && <Pressable onPress={onAction} hitSlop={8}><Text style={{ color: c.purple, fontWeight: '800', fontSize: 13 }}>{action}</Text></Pressable>}
      </View>
      {children}
    </View>
  );
}

function Line({ c, label, value }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={{ color: c.muted, fontSize: 13 }}>{label}</Text>
      <Text style={{ color: c.text, fontSize: 13, fontWeight: '600' }}>{value}</Text>
    </View>
  );
}
