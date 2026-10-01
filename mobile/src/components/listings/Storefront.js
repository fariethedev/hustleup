import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { shopsApi } from '../../api/client';
import { useCart } from '../../store/CartProvider';
import { cartKey, errorMessage, money } from '../../utils/marketplace';
import { mediaUrl } from '../../utils/media';

const appointmentTypes = ['HAIR_SALON', 'BARBERSHOP', 'NAIL_STUDIO', 'SPA_MASSAGE', 'TATTOO_PIERCING', 'FITNESS_TRAINING', 'TUTORING_LESSONS', 'REPAIR_SERVICES'];
const text = { color: '#FFF', fontSize: 16, lineHeight: 23 };
const muted = { color: '#AAA', fontSize: 13, lineHeight: 21 };
const button = { minHeight: 48, borderRadius: 14, padding: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#CDFF00' };

export default function Storefront({ shopId }) {
  const router = useRouter();
  const user = useSelector(state => state.auth.user);
  const { add, items, ready } = useCart();
  const [shop, setShop] = useState(null);
  const [services, setServices] = useState([]);
  const [selected, setSelected] = useState(null);
  const [slots, setSlots] = useState([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const request = useRef(0);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const { data } = await shopsApi.get(shopId); setShop(data);
      if (appointmentTypes.includes(data.businessType)) { const response = await shopsApi.services(shopId); setServices(response.data || []); }
    } catch (failure) { setError(errorMessage(failure, 'Could not load this shop.')); }
    finally { setLoading(false); }
  }, [shopId]);
  useEffect(() => { load(); }, [load]);
  const chooseService = async (service) => {
    const id = ++request.current; setSelected(service); setSlots([]); setBusy(true); setError('');
    try { const { data } = await shopsApi.slots(shopId, service.id); if (id === request.current) setSlots((data || []).filter(slot => !slot.booked && new Date(slot.startTime) > new Date())); }
    catch (failure) { if (id === request.current) setError(errorMessage(failure, 'Could not load available appointments.')); }
    finally { if (id === request.current) setBusy(false); }
  };
  const book = (slot) => Alert.alert('Confirm appointment', `${selected.name}\n${new Date(slot.startTime).toLocaleString()}\n${money(selected.price, selected.currency)}\nPayment is arranged with the shop. No payment is taken here.`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Book appointment', onPress: async () => {
    if (busy) return;
    setBusy(true); setError('');
    try { await shopsApi.book(shopId, { slotId: slot.id, customer: { fullName: user?.fullName, email: user?.email } }); setSlots(previous => previous.filter(value => value.id !== slot.id)); Alert.alert('Appointment booked', 'Your time is reserved. Contact the shop if you need to make changes.'); }
    catch (failure) { setError(errorMessage(failure, 'Could not reserve that appointment. Please choose another time.')); }
    finally { setBusy(false); }
  } }]);
  return <SafeAreaView style={{ flex: 1, backgroundColor: '#090909' }}><ScrollView contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: 50 }}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><TouchableOpacity style={{ minHeight: 44 }} onPress={() => router.back()}><Text style={text}>← Back</Text></TouchableOpacity><TouchableOpacity style={{ minHeight: 44 }} onPress={() => router.push('/cart')}><Text style={{ ...text, color: '#CDFF00' }}>Cart ({items.length})</Text></TouchableOpacity></View>
    {loading ? <ActivityIndicator color="#CDFF00" /> : shop && <>
      {!!shop.bannerUrl && <Image source={{ uri: mediaUrl(shop.bannerUrl) }} style={{ width: '100%', height: 180, borderRadius: 20 }} />}
      <Text style={{ ...text, fontSize: 28, fontWeight: '700' }}>{shop.name}</Text><Text style={muted}>{shop.category}{shop.city ? ` · ${shop.city}` : ''}</Text>
      {!!shop.description && <Text style={text}>{shop.description}</Text>}
      {appointmentTypes.includes(shop.businessType) && <>
        <Text style={{ ...text, fontSize: 20, fontWeight: '700' }}>Services & appointments</Text>
        {!services.length && <Text style={muted}>The shop has not added services yet.</Text>}
        {services.filter(service => service.active !== false).map(service => <TouchableOpacity key={service.id} disabled={busy} onPress={() => chooseService(service)} style={{ padding: 16, backgroundColor: selected?.id === service.id ? '#303719' : '#191919', borderRadius: 16, gap: 5 }}><Text style={text}>{service.name}</Text><Text style={muted}>{service.durationMinutes} minutes · {money(service.price, service.currency)}</Text><Text style={{ color: '#CDFF00' }}>Choose a time</Text></TouchableOpacity>)}
        {busy && <ActivityIndicator color="#CDFF00" />}
        {selected && !busy && !slots.length && <Text style={muted}>No upcoming appointments are available for this service.</Text>}
        {slots.map(slot => <TouchableOpacity key={slot.id} disabled={busy || shop.ownerId === user?.id} style={button} onPress={() => book(slot)}><Text style={{ color: '#050505', fontWeight: '700' }}>{new Date(slot.startTime).toLocaleString()}</Text></TouchableOpacity>)}
      </>}
      <Text style={{ ...text, fontSize: 20, fontWeight: '700' }}>Products</Text>
      {!(shop.products || []).length && <Text style={muted}>The shop has not added products yet.</Text>}
      {(shop.products || []).map(product => {
        const item = { ...product, title: product.name, kind: 'product', shopId: shop.id, shopName: shop.name };
        const inCart = items.some(row => cartKey(row) === cartKey(item));
        const soldOut = product.stockQuantity != null && product.stockQuantity <= 0;
        return <View key={product.id} style={{ backgroundColor: '#191919', borderRadius: 20, padding: 16, gap: 12 }}>
          {!!product.imageUrl && <Image source={{ uri: mediaUrl(product.imageUrl) }} style={{ width: '100%', height: 210, borderRadius: 12 }} resizeMode="contain" />}
          <Text style={text}>{product.name}</Text><Text style={muted}>{product.category}</Text><Text style={{ ...text, fontWeight: '700' }}>{money(product.price, product.currency)}</Text>
          {product.stockQuantity != null && <Text style={muted}>{soldOut ? 'Out of stock' : `${product.stockQuantity} available`}</Text>}
          <TouchableOpacity disabled={!ready || soldOut || shop.ownerId === user?.id} style={[button, (soldOut || shop.ownerId === user?.id) && { opacity: .4 }]} onPress={() => inCart ? router.push('/cart') : add(item)}><Text style={{ color: '#050505', fontWeight: '700' }}>{soldOut ? 'Out of stock' : inCart ? 'View in cart' : 'Add to cart'}</Text></TouchableOpacity>
        </View>;
      })}
    </>}
    {!!error && <View><Text accessibilityRole="alert" style={{ color: '#FCA5A5' }}>{error}</Text><TouchableOpacity onPress={load} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: '#CDFF00' }}>Try again</Text></TouchableOpacity></View>}
  </ScrollView></SafeAreaView>;
}
