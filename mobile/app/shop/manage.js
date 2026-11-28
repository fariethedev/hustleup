import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '../../src/components/native/Icon';
import { shopsApi } from '../../src/api/client';
import { usePalette, BackButton } from '../../src/components/native/Kit';
import { errorMessage, money } from '../../src/utils/marketplace';
import { mediaUrl, pickCroppedPhoto, uploadAsset } from '../../src/utils/media';

/** Tomorrow at the next whole hour, as 'YYYY-MM-DD HH:MM' — a sensible default for a new slot. */
const nextSlotText = () => { const d = new Date(Date.now() + 86400000); d.setMinutes(0, 0, 0); const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:00`; };

const DELIVERY = [['COURIER', 'Courier'], ['PARCEL_LOCKER', 'Locker'], ['PICKUP', 'Pickup'], ['DIGITAL', 'Digital']];

/** Everything a shop owner needs on mobile: details, banner, visibility, products or services. */
export default function ManageShop() {
  const router = useRouter();
  const c = usePalette();
  const [shop, setShop] = useState(null);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [details, setDetails] = useState(null);
  const [product, setProduct] = useState({ name: '', price: '', stock: '10', shippingMethod: 'COURIER', shippingPrice: '' });
  const [productPhoto, setProductPhoto] = useState(null);
  const [service, setService] = useState({ name: '', minutes: '60', price: '' });

  const load = useCallback(async () => {
    try {
      const { data, status } = await shopsApi.mine();
      if (status === 204 || !data?.id) { router.replace('/shop/create'); return; }
      setShop(data);
      setDetails({ name: data.name || '', tagline: data.tagline || '', city: data.city || '', description: data.description || '' });
      if (data.appointmentBased) setServices((await shopsApi.services(data.id)).data || []);
    } catch (e) { Alert.alert('Could not load your shop', errorMessage(e)); }
    finally { setLoading(false); }
  }, [router]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const run = async (key, fn, done) => {
    setBusy(key);
    try { await fn(); await load(); if (done) Alert.alert(done); }
    catch (e) { Alert.alert('Something went wrong', errorMessage(e)); }
    finally { setBusy(''); }
  };
  const uploadPhoto = async (asset) => {
    const fd = new FormData(); fd.append('file', uploadAsset(asset));
    return (await shopsApi.uploadMedia(shop.id, fd)).data.url;
  };
  const changeBanner = async () => {
    try { const a = await pickCroppedPhoto([16, 9]); if (a) run('banner', async () => shopsApi.update(shop.id, { bannerUrl: await uploadPhoto(a) })); }
    catch (e) { Alert.alert('Photo access', e.message); }
  };
  const addProduct = () => {
    const price = product.price.replace(',', '.');
    if (!product.name.trim()) return Alert.alert('Name the product');
    if (!/^\d+(\.\d{1,2})?$/.test(price)) return Alert.alert('Check the price');
    if (!productPhoto) return Alert.alert('Add a photo', 'Products with photos sell far better.');
    run('product', async () => {
      await shopsApi.addProduct(shop.id, { name: product.name.trim(), price: Number(price), currency: 'PLN', imageUrl: await uploadPhoto(productPhoto), stockTracked: true,
        stockQuantity: Number(product.stock) || 0, shippingMethod: product.shippingMethod, shippingPrice: product.shippingMethod === 'PICKUP' || product.shippingMethod === 'DIGITAL' ? 0 : Number(product.shippingPrice.replace(',', '.')) || 0 });
      setProduct({ name: '', price: '', stock: '10', shippingMethod: 'COURIER', shippingPrice: '' }); setProductPhoto(null);
    }, 'Product added');
  };
  const addService = () => {
    const price = service.price.replace(',', '.');
    if (!service.name.trim() || !/^\d+(\.\d{1,2})?$/.test(price)) return Alert.alert('Add a name and price');
    run('service', async () => {
      await shopsApi.addService(shop.id, { name: service.name.trim(), durationMinutes: Number(service.minutes) || 60, price: Number(price), currency: 'PLN', active: true });
      setService({ name: '', minutes: '60', price: '' });
    }, 'Service added');
  };
  const addSlot = (svc) => Alert.prompt
    ? Alert.prompt('Add a time', 'Format: YYYY-MM-DD HH:MM', text => text && saveSlot(svc, text), 'plain-text', nextSlotText())
    : saveSlot(svc, nextSlotText());
  const saveSlot = (svc, text) => {
    if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(text.trim())) return Alert.alert('Use the format YYYY-MM-DD HH:MM');
    const start = text.trim().replace(' ', 'T');
    const end = new Date(new Date(start).getTime() + (svc.durationMinutes || 60) * 60000);
    const pad = n => String(n).padStart(2, '0');
    const endText = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}T${pad(end.getHours())}:${pad(end.getMinutes())}`;
    run('slot-' + svc.id, () => shopsApi.addSlot(shop.id, svc.id, start, endText), `Time added: ${text.trim()}`);
  };

  const input = { color: c.text, borderWidth: 1, borderColor: c.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, backgroundColor: c.bg };
  const card = { backgroundColor: c.card, borderRadius: 18, borderWidth: 1, borderColor: c.line, padding: 14, gap: 10 };
  if (loading || !shop) return <SafeAreaView style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={c.purple} /></SafeAreaView>;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16 }}>
          <BackButton fallback="/dashboard" />
          <Text style={{ color: c.text, fontSize: 18, fontWeight: '900', flex: 1 }}>Manage shop</Text>
          <TouchableOpacity onPress={() => router.push({ pathname: '/shop/[userId]', params: { userId: shop.ownerId, shopId: shop.id } })} style={{ paddingHorizontal: 14, minHeight: 36, borderRadius: 18, justifyContent: 'center', backgroundColor: c.purpleSoft }}>
            <Text style={{ color: c.purple, fontWeight: '800', fontSize: 13 }}>View shop</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 0, gap: 14, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={changeBanner} style={{ height: 150, borderRadius: 18, overflow: 'hidden', backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' }}>
            {!!shop.bannerUrl && <Image source={{ uri: mediaUrl(shop.bannerUrl) }} style={{ position: 'absolute', width: '100%', height: '100%' }} />}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.55)' }}>
              {busy === 'banner' ? <ActivityIndicator color="#FFF" size="small" /> : <Feather name="camera" size={14} color="#FFF" />}
              <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 12 }}>Change banner</Text>
            </View>
          </TouchableOpacity>

          <View style={card}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ color: c.text, fontWeight: '900', fontSize: 16, flex: 1 }}>Shop details</Text>
              <Text style={{ color: c.muted, fontSize: 12, marginRight: 6 }}>{shop.published ? 'Visible' : 'Hidden'}</Text>
              <Switch value={!!shop.published} onValueChange={v => run('publish', () => shopsApi.update(shop.id, { published: v }))} trackColor={{ true: c.purple }} />
            </View>
            {[['name', 'Shop name'], ['tagline', 'Tagline'], ['city', 'City']].map(([k, ph]) => (
              <TextInput key={k} value={details[k]} onChangeText={v => setDetails(d => ({ ...d, [k]: v }))} placeholder={ph} placeholderTextColor={c.muted} style={input} />
            ))}
            <TextInput value={details.description} onChangeText={v => setDetails(d => ({ ...d, description: v }))} placeholder="Description" placeholderTextColor={c.muted} multiline style={[input, { minHeight: 80, textAlignVertical: 'top' }]} />
            <TouchableOpacity onPress={() => run('details', () => shopsApi.update(shop.id, details), 'Shop updated')} style={{ minHeight: 42, borderRadius: 21, backgroundColor: c.purple, alignItems: 'center', justifyContent: 'center' }}>
              {busy === 'details' ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: '#FFF', fontWeight: '800' }}>Save details</Text>}
            </TouchableOpacity>
          </View>

          {shop.appointmentBased ? <>
            <View style={card}>
              <Text style={{ color: c.text, fontWeight: '900', fontSize: 16 }}>Services <Text style={{ color: c.muted, fontWeight: '600' }}>{services.length}</Text></Text>
              {!services.length && <Text style={{ color: c.muted, fontSize: 13 }}>Add a service, then add times customers can book.</Text>}
              {services.map(svc => (
                <View key={svc.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}>
                  <View style={{ flex: 1 }}><Text style={{ color: c.text, fontWeight: '700' }}>{svc.name}</Text><Text style={{ color: c.muted, fontSize: 12 }}>{svc.durationMinutes} min · {money(svc.price, svc.currency)}</Text></View>
                  <TouchableOpacity onPress={() => addSlot(svc)} style={{ paddingHorizontal: 12, minHeight: 32, borderRadius: 16, justifyContent: 'center', backgroundColor: c.purpleSoft }}>
                    {busy === 'slot-' + svc.id ? <ActivityIndicator size="small" color={c.purple} /> : <Text style={{ color: c.purple, fontWeight: '800', fontSize: 12 }}>+ Add time</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity accessibilityLabel={`Delete ${svc.name}`} onPress={() => Alert.alert('Delete service?', svc.name, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => run('del', () => shopsApi.deleteService(shop.id, svc.id)) }])}><Feather name="trash-2" size={17} color="#F87171" /></TouchableOpacity>
                </View>
              ))}
            </View>
            <View style={card}>
              <Text style={{ color: c.text, fontWeight: '900', fontSize: 16 }}>Add a service</Text>
              <TextInput value={service.name} onChangeText={v => setService(s => ({ ...s, name: v }))} placeholder="Service name (e.g. Skin fade)" placeholderTextColor={c.muted} style={input} />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput value={service.minutes} onChangeText={v => setService(s => ({ ...s, minutes: v }))} placeholder="Minutes" keyboardType="number-pad" placeholderTextColor={c.muted} style={[input, { flex: 1 }]} />
                <TextInput value={service.price} onChangeText={v => setService(s => ({ ...s, price: v }))} placeholder="Price (PLN)" keyboardType="decimal-pad" placeholderTextColor={c.muted} style={[input, { flex: 1 }]} />
              </View>
              <TouchableOpacity onPress={addService} style={{ minHeight: 42, borderRadius: 21, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
                {busy === 'service' ? <ActivityIndicator color="#111" /> : <Text style={{ color: '#111', fontWeight: '900' }}>Add service</Text>}
              </TouchableOpacity>
            </View>
          </> : <>
            <View style={card}>
              <Text style={{ color: c.text, fontWeight: '900', fontSize: 16 }}>Products <Text style={{ color: c.muted, fontWeight: '600' }}>{(shop.products || []).length}</Text></Text>
              {!(shop.products || []).length && <Text style={{ color: c.muted, fontSize: 13 }}>Your shop is empty — add your first product below.</Text>}
              {(shop.products || []).map(p => (
                <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  {p.imageUrl ? <Image source={{ uri: mediaUrl(p.imageUrl) }} style={{ width: 46, height: 46, borderRadius: 10 }} /> : <View style={{ width: 46, height: 46, borderRadius: 10, backgroundColor: c.soft }} />}
                  <View style={{ flex: 1 }}><Text style={{ color: c.text, fontWeight: '700' }} numberOfLines={1}>{p.name}</Text><Text style={{ color: c.muted, fontSize: 12 }}>{money(p.price, p.currency)}{p.stockTracked ? ` · ${p.stockQuantity} in stock` : ''}</Text></View>
                  <TouchableOpacity accessibilityLabel={`Delete ${p.name}`} onPress={() => Alert.alert('Delete product?', p.name, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => run('del', () => shopsApi.deleteProduct(shop.id, p.id)) }])}><Feather name="trash-2" size={17} color="#F87171" /></TouchableOpacity>
                </View>
              ))}
            </View>
            <View style={card}>
              <Text style={{ color: c.text, fontWeight: '900', fontSize: 16 }}>Add a product</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity onPress={async () => { try { const a = await pickCroppedPhoto([1, 1]); if (a) setProductPhoto(a); } catch (e) { Alert.alert('Photo access', e.message); } }}
                  style={{ width: 84, height: 84, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.purple, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {productPhoto ? <Image source={{ uri: productPhoto.uri }} style={{ width: '100%', height: '100%' }} /> : <Feather name="camera" size={22} color={c.purple} />}
                </TouchableOpacity>
                <View style={{ flex: 1, gap: 8 }}>
                  <TextInput value={product.name} onChangeText={v => setProduct(s => ({ ...s, name: v }))} placeholder="Product name" placeholderTextColor={c.muted} style={input} />
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TextInput value={product.price} onChangeText={v => setProduct(s => ({ ...s, price: v }))} placeholder="Price" keyboardType="decimal-pad" placeholderTextColor={c.muted} style={[input, { flex: 1 }]} />
                    <TextInput value={product.stock} onChangeText={v => setProduct(s => ({ ...s, stock: v }))} placeholder="Stock" keyboardType="number-pad" placeholderTextColor={c.muted} style={[input, { flex: 1 }]} />
                  </View>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                {DELIVERY.map(([k, l]) => <Pressable key={k} onPress={() => setProduct(s => ({ ...s, shippingMethod: k }))} style={{ paddingHorizontal: 12, minHeight: 32, borderRadius: 16, justifyContent: 'center', borderWidth: 1, borderColor: product.shippingMethod === k ? c.purple : c.line, backgroundColor: product.shippingMethod === k ? c.purpleSoft : 'transparent' }}><Text style={{ color: product.shippingMethod === k ? c.purple : c.text, fontSize: 12, fontWeight: '700' }}>{l}</Text></Pressable>)}
              </View>
              {!['PICKUP', 'DIGITAL'].includes(product.shippingMethod) && <TextInput value={product.shippingPrice} onChangeText={v => setProduct(s => ({ ...s, shippingPrice: v }))} placeholder="Delivery price (PLN)" keyboardType="decimal-pad" placeholderTextColor={c.muted} style={input} />}
              <TouchableOpacity onPress={addProduct} style={{ minHeight: 42, borderRadius: 21, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
                {busy === 'product' ? <ActivityIndicator color="#111" /> : <Text style={{ color: '#111', fontWeight: '900' }}>Add product</Text>}
              </TouchableOpacity>
            </View>
          </>}
          <Text style={{ color: c.muted, fontSize: 11, textAlign: 'center' }}>Highlights are edited on your shop page — tap View shop, then “New” under Highlights.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
