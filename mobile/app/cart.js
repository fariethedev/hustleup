import React, { useState } from 'react';
import { ActivityIndicator, Alert, Linking, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { Feather } from '@expo/vector-icons';
import { useCart } from '../src/store/CartProvider';
import { bookingsApi, shopsApi } from '../src/api/client';
import { cartGroup, cartKey, checkoutPrompts, errorMessage, money } from '../src/utils/marketplace';

const paymentUrl = (value) => {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== 'checkout.stripe.com') throw new Error('A secure payment link was not returned.');
  return url.toString();
};

export default function CartScreen() {
  const router = useRouter();
  const user = useSelector(state => state.auth.user);
  const { items, quantity, ready, sessions, saveSession, finishSession, storageError } = useCart();
  const [customer, setCustomer] = useState({ name: user?.fullName || '', email: user?.email || '', phone: '', address: '' });
  const [answers, setAnswers] = useState({});
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const groups = items.reduce((result, item) => { const group = cartGroup(item); (result[group] ||= []).push(item); return result; }, {});
  const checkout = async (group, rows) => {
    if (busy) return;
    setError('');
    if (sessions[group]?.url) { await Linking.openURL(paymentUrl(sessions[group].url)).catch(() => setError('Could not open payment. Try again.')); return; }
    if (!customer.name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email.trim())) { setError('Add your name and a valid email address.'); return; }
    if (rows.some(row => row.shippingMethod && !['NONE', 'PICKUP', 'DIGITAL'].includes(row.shippingMethod)) && !customer.address.trim()) { setError('Enter your delivery address for this order.'); return; }
    if (rows.some(row => checkoutPrompts(row).some(prompt => !answers[row.id]?.[prompt]?.trim()))) { setError('Answer the seller’s questions before continuing.'); return; }
    setBusy(group);
    try {
      const response = rows[0].kind === 'product'
        ? await shopsApi.checkout(rows[0].shopId, { items: rows.map(row => ({ productId: row.id, quantity: row.quantity })), customer: { ...customer, fullName: customer.name }, notes: customer.address ? `Delivery address: ${customer.address}` : '' })
        : await bookingsApi.checkout({ items: rows.map(row => ({ listingId: row.id, quantity: row.quantity })), customer: { ...customer, answers } });
      const { data } = response;
      if (!data.url && !data.awaitingApproval?.length) throw new Error('No payment link or order confirmation was returned.');
      const url = data.url ? paymentUrl(data.url) : null;
      saveSession(group, { keys: rows.map(cartKey), url, orderIds: data.orderIds || [...(data.paidBookingIds || []), ...(data.awaitingApproval || [])], kind: rows[0].kind || 'listing' });
      if (url) await Linking.openURL(url);
      else Alert.alert('Request sent', 'The seller needs to accept your request. No payment has been taken. Check your orders for updates.');
    } catch (failure) { setError(errorMessage(failure, failure.message || 'Could not start checkout. Please try again.')); }
    finally { setBusy(''); }
  };
  const checkOrders = async (group) => {
    setBusy(group); setError('');
    try {
      const session = sessions[group];
      const { data } = session.kind === 'product' ? await shopsApi.orders() : await bookingsApi.getAll();
      const orders = (data || []).filter(order => session.orderIds?.includes(order.id));
      const finished = orders.length === session.orderIds?.length && orders.length > 0 && orders.every(order => ['PAID', 'FULFILLED', 'COMPLETED', 'CANCELLED', 'REFUNDED'].includes(order.status) || order.paymentStatus === 'PAID');
      if (finished) finishSession(group);
      else Alert.alert('Order pending', 'Payment or seller approval is still pending. You can continue payment or check your orders.');
    } catch (failure) { setError(errorMessage(failure, 'Could not check your order status.')); }
    finally { setBusy(''); }
  };
  return <SafeAreaView style={s.screen}>
    <View style={s.header}><TouchableOpacity onPress={() => router.back()} style={s.icon} accessibilityLabel="Back"><Feather name="arrow-left" size={24} color="#FFF" /></TouchableOpacity><Text style={s.title}>Your cart</Text><TouchableOpacity onPress={() => router.push('/profile/orders')} style={s.icon}><Text style={s.link}>Orders</Text></TouchableOpacity></View>
    {!ready ? <ActivityIndicator color="#CDFF00" /> : <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      {!items.length && <View style={s.panel}><Text style={s.title}>Room for a good find.</Text><Text style={s.muted}>Your cart is empty.</Text><TouchableOpacity style={s.button} onPress={() => router.push('/(tabs)/explore')}><Text style={s.buttonText}>Explore listings</Text></TouchableOpacity></View>}
      {items.length > 0 && <View style={s.panel}><Text style={s.heading}>Your details</Text>{[['name', 'Full name'], ['email', 'Email address'], ['phone', 'Phone (optional)'], ['address', 'Delivery address, if needed']].map(([key, label]) => <TextInput key={key} accessibilityLabel={label} placeholder={label} placeholderTextColor="#888" value={customer[key]} onChangeText={value => setCustomer(previous => ({ ...previous, [key]: value }))} keyboardType={key === 'email' ? 'email-address' : key === 'phone' ? 'phone-pad' : 'default'} autoCapitalize={key === 'email' ? 'none' : 'sentences'} style={s.input} />)}</View>}
      {Object.entries(groups).map(([group, rows]) => <View key={group} style={s.panel}>
        <Text style={s.heading}>{rows[0].kind === 'product' ? rows[0].shopName || 'Shop order' : 'Marketplace order'} · {rows[0].currency || 'PLN'}</Text>
        {rows.map(item => <View key={cartKey(item)} style={s.line}>
          <Text style={s.text}>{item.title || item.name}</Text><Text style={s.muted}>{money(item.price, item.currency)} each</Text>
          <View style={s.quantity}><TouchableOpacity style={s.icon} disabled={!!sessions[group]} onPress={() => quantity(item, item.quantity - 1)} accessibilityLabel={`Remove one ${item.title || item.name}`}><Feather name="minus" size={20} color="#FFF" /></TouchableOpacity><Text style={s.text}>{item.quantity}</Text><TouchableOpacity style={s.icon} disabled={!!sessions[group] || (item.stockQuantity != null && item.quantity >= item.stockQuantity)} onPress={() => quantity(item, item.quantity + 1)} accessibilityLabel={`Add one ${item.title || item.name}`}><Feather name="plus" size={20} color="#FFF" /></TouchableOpacity></View>
          {checkoutPrompts(item).map(prompt => <TextInput key={prompt} style={s.input} accessibilityLabel={prompt} placeholder={prompt} placeholderTextColor="#888" value={answers[item.id]?.[prompt] || ''} onChangeText={value => setAnswers(previous => ({ ...previous, [item.id]: { ...previous[item.id], [prompt]: value } }))} />)}
        </View>)}
        <Text style={s.heading}>Total {money(rows.reduce((total, item) => total + Number(item.price) * item.quantity + Number(item.shippingPrice || 0), 0), rows[0].currency)}</Text>
        <Text style={s.muted}>Includes listed delivery charges. Prices and availability are checked by the server.</Text>
        {sessions[group] && <Text style={s.muted}>Order created. Payment or seller approval may still be pending.</Text>}
        {(!sessions[group] || sessions[group].url) && <TouchableOpacity style={[s.button, busy && { opacity: .5 }]} disabled={!!busy} onPress={() => checkout(group, rows)}><Text style={s.buttonText}>{busy === group ? 'Please wait…' : sessions[group] ? 'Continue payment' : 'Continue to checkout'}</Text></TouchableOpacity>}
        {sessions[group] && <TouchableOpacity style={s.icon} disabled={!!busy} onPress={() => checkOrders(group)}><Text style={s.link}>Check order status</Text></TouchableOpacity>}
      </View>)}
      {!!(error || storageError) && <Text accessibilityRole="alert" style={s.error}>{error || storageError}</Text>}
    </ScrollView>}
  </SafeAreaView>;
}
const s = StyleSheet.create({ screen: { flex: 1, backgroundColor: '#090909' }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 }, title: { color: '#FFF', fontSize: 22, fontWeight: '700' }, heading: { color: '#FFF', fontSize: 17, fontWeight: '600' }, content: { padding: 18, paddingBottom: 50, gap: 18 }, panel: { backgroundColor: '#151515', borderRadius: 20, padding: 18, gap: 14 }, text: { color: '#FFF', fontSize: 15 }, muted: { color: '#AAA', fontSize: 13, lineHeight: 20 }, icon: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }, input: { color: '#FFF', fontSize: 16, minHeight: 48, borderWidth: 1, borderColor: '#444', borderRadius: 12, padding: 12 }, line: { paddingVertical: 10, gap: 8, borderBottomWidth: 1, borderColor: '#333' }, quantity: { flexDirection: 'row', alignItems: 'center', gap: 16 }, button: { minHeight: 50, backgroundColor: '#CDFF00', borderRadius: 25, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 }, buttonText: { color: '#050505', fontSize: 15, fontWeight: '700' }, link: { color: '#CDFF00', fontSize: 14 }, error: { color: '#FCA5A5', fontSize: 14, lineHeight: 21 } });
