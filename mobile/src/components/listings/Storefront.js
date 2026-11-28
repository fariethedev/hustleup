import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, ImageBackground, ScrollView, Share, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Feather } from '../native/Icon';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { followsApi, shopsApi } from '../../api/client';
import { errorMessage, money } from '../../utils/marketplace';
import { mediaUrl } from '../../utils/media';
import { storeListing } from '../../utils/discovery';
import { ListingCard } from '../native/DiscoveryCards';
import ShopHighlights from '../native/ShopHighlights';
import FloatingCart from '../native/FloatingCart';
import { usePalette, BackButton } from '../native/Kit';

const appointmentTypes = ['HAIR_SALON', 'BARBERSHOP', 'NAIL_STUDIO', 'SPA_MASSAGE', 'TATTOO_PIERCING', 'FITNESS_TRAINING', 'TUTORING_LESSONS', 'REPAIR_SERVICES'];

function Stat({ value, label, c }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <Text style={{ color: c.text, fontSize: 17, fontWeight: '900' }}>{value}</Text>
      <Text style={{ color: c.muted, fontSize: 11 }}>{label}</Text>
    </View>
  );
}

export default function Storefront({ shopId }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const user = useSelector(state => state.auth.user);
  const c = usePalette();
  const [shop, setShop] = useState(null);
  const [services, setServices] = useState([]);
  const [selected, setSelected] = useState(null);
  const [slots, setSlots] = useState([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [following, setFollowing] = useState(null);
  const request = useRef(0);
  const owner = shop?.ownerId && shop.ownerId === user?.id;
  const bannerHeight = Math.round(Math.min(height * 0.42, width * 0.95));

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const { data } = await shopsApi.get(shopId); setShop(data);
      if (appointmentTypes.includes(data.businessType)) { const response = await shopsApi.services(shopId); setServices(response.data || []); }
      if (user && data.ownerId && data.ownerId !== user.id) followsApi.relationship(data.ownerId).then(r => setFollowing(!!(r.data?.isFollowing || r.data?.followRequested))).catch(() => {});
    } catch (failure) { setError(errorMessage(failure, 'Could not load this shop.')); }
    finally { setLoading(false); }
  }, [shopId, user]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

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
  const toggleFollow = async () => {
    if (!user) { router.push('/login'); return; }
    const next = !following; setFollowing(next);
    try { if (next) await followsApi.follow(shop.ownerId); else await followsApi.unfollow(shop.ownerId); }
    catch (e) { setFollowing(!next); Alert.alert('Could not update', errorMessage(e)); }
  };
  const openProduct = product => router.push({ pathname: '/listing/[id]', params: { id: storeListing(shop, product).id } });

  if (loading && !shop) return <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={c.purple} size="large" /></View>;
  if (!shop) return (
    <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 30 }}>
      <Text style={{ color: c.text, fontWeight: '800' }}>{error || 'Shop unavailable'}</Text>
      <TouchableOpacity onPress={load} style={{ paddingHorizontal: 20, minHeight: 44, justifyContent: 'center', borderRadius: 22, backgroundColor: c.lime }}><Text style={{ color: '#151A00', fontWeight: '800' }}>Try again</Text></TouchableOpacity>
    </View>
  );

  const products = shop.products || [];
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
        {/* Full-width banner */}
        <ImageBackground source={shop.bannerUrl ? { uri: mediaUrl(shop.bannerUrl) } : undefined} style={{ width, height: bannerHeight, backgroundColor: c.purpleSoft }} resizeMode="cover">
          <LinearGradient colors={['rgba(0,0,0,0.45)', 'transparent', 'rgba(0,0,0,0.55)']} style={{ flex: 1, paddingTop: insets.top + 8, paddingHorizontal: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <BackButton overlay />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {owner && <TouchableOpacity accessibilityLabel="Manage shop" onPress={() => router.push('/shop/manage')} style={roundBtn}><Feather name="edit-2" size={18} color="#FFF" /></TouchableOpacity>}
                <TouchableOpacity accessibilityLabel="Share shop" onPress={() => Share.share({ message: `${shop.name} on HustleSpace${shop.tagline ? ` — ${shop.tagline}` : ''}` })} style={roundBtn}><Feather name="share-2" size={18} color="#FFF" /></TouchableOpacity>
              </View>
            </View>
          </LinearGradient>
        </ImageBackground>

        {/* Profile-style header: logo, name, stats, actions */}
        <View style={{ paddingHorizontal: 18, marginTop: -46, gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12 }}>
            <View style={{ width: 96, height: 96, borderRadius: 48, padding: 3, backgroundColor: c.bg }}>
              <LinearGradient colors={['#CDFF00', '#7D39EB']} style={{ flex: 1, borderRadius: 45, padding: 3 }}>
                {shop.ownerAvatarUrl
                  ? <Image source={{ uri: mediaUrl(shop.ownerAvatarUrl) }} style={{ flex: 1, borderRadius: 42 }} />
                  : <View style={{ flex: 1, borderRadius: 42, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: c.purple, fontSize: 32, fontWeight: '900' }}>{shop.name[0]}</Text></View>}
              </LinearGradient>
            </View>
          </View>
          <View style={{ gap: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ color: c.text, fontSize: 22, fontWeight: '900', lineHeight: 28, flexShrink: 1 }}>{shop.name}</Text>
              {shop.ownerVerified && <MaterialCommunityIcons name="check-decagram" size={18} color={c.purple} />}
            </View>
            <Text style={{ color: c.muted, fontSize: 13 }}>{[shop.category, shop.city].filter(Boolean).join(' · ')}{shop.ownerName ? ` · by ${shop.ownerName}` : ''}</Text>
          </View>
          <View style={{ flexDirection: 'row', paddingVertical: 12, borderRadius: 18, backgroundColor: c.card, borderWidth: 1, borderColor: c.line }}>
            <Stat value={shop.productCount ?? products.length} label="Products" c={c} />
            <Stat value={shop.rating ? `★ ${Number(shop.rating).toFixed(1)}` : '—'} label="Rating" c={c} />
            <Stat value={shop.reviewCount ?? 0} label="Reviews" c={c} />
            <Stat value={shop.listingCount ?? 0} label="Listings" c={c} />
          </View>
          {!owner ? (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity onPress={toggleFollow} style={{ flex: 1, minHeight: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: following ? c.card : c.accent, borderWidth: 1, borderColor: following ? c.line : c.accent }}>
                <Text style={{ color: following ? c.text : (c.light ? '#FFF' : '#111'), fontWeight: '800' }}>{following ? 'Following' : 'Follow'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => (user ? router.push({ pathname: '/(tabs)/messages', params: { partnerId: shop.ownerId, partnerName: shop.ownerName || shop.name } }) : router.push('/login'))}
                style={{ flex: 1, minHeight: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, borderWidth: 1, borderColor: c.purple }}>
                <Feather name="message-circle" size={16} color={c.purple} /><Text style={{ color: c.purple, fontWeight: '800' }}>Message</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={() => router.push('/shop/manage')} style={{ minHeight: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, backgroundColor: c.lime }}>
              <Feather name="settings" size={16} color="#151A00" /><Text style={{ color: '#151A00', fontWeight: '800' }}>Manage shop</Text>
            </TouchableOpacity>
          )}
          {!!shop.tagline && <Text style={{ color: c.text, fontWeight: '700' }}>{shop.tagline}</Text>}
          {!!shop.description && <Text style={{ color: c.muted, fontSize: 13, lineHeight: 20 }}>{shop.description}</Text>}

          <ShopHighlights key={shop.id} shop={shop} isOwner={owner} onSaved={setShop} onOpenProduct={openProduct} />

          {appointmentTypes.includes(shop.businessType) && <View style={{ gap: 10 }}>
            <Text style={{ color: c.text, fontSize: 18, fontWeight: '800' }}>Book an appointment</Text>
            {!services.length && <Text style={{ color: c.muted }}>The shop has not added services yet.</Text>}
            {services.filter(service => service.active !== false).map(service => (
              <TouchableOpacity key={service.id} disabled={busy} onPress={() => chooseService(service)} style={{ padding: 14, backgroundColor: c.card, borderWidth: 1.5, borderColor: selected?.id === service.id ? c.purple : c.line, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ flex: 1 }}><Text style={{ color: c.text, fontWeight: '800' }}>{service.name}</Text><Text style={{ color: c.muted, fontSize: 12 }}>{service.durationMinutes} min</Text></View>
                <Text style={{ color: c.accent, fontWeight: '900' }}>{money(service.price, service.currency)}</Text>
                
              </TouchableOpacity>
            ))}
            {busy && <ActivityIndicator color={c.purple} />}
            {selected && !busy && !slots.length && <Text style={{ color: c.muted }}>No upcoming times for this service.</Text>}
            {!!slots.length && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {slots.map(slot => (
                <TouchableOpacity key={slot.id} disabled={busy || owner} onPress={() => book(slot)} style={{ paddingHorizontal: 14, minHeight: 40, borderRadius: 20, justifyContent: 'center', backgroundColor: c.purpleSoft, borderWidth: 1, borderColor: c.purple }}>
                  <Text style={{ color: c.purple, fontWeight: '800', fontSize: 13 }}>{new Date(slot.startTime).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</Text>
                </TouchableOpacity>
              ))}
            </View>}
          </View>}

          {(products.length > 0 || !appointmentTypes.includes(shop.businessType)) && <View style={{ gap: 10 }}>
            <Text style={{ color: c.text, fontSize: 18, fontWeight: '800' }}>Products <Text style={{ color: c.muted, fontSize: 14, fontWeight: '600' }}>{products.length}</Text></Text>
            {!products.length && <Text style={{ color: c.muted }}>No products yet.</Text>}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {products.map(product => <ListingCard key={product.id} item={storeListing(shop, product)} onOpen={() => openProduct(product)} style={{ width: (width - 36 - 12) / 2 }} />)}
            </View>
          </View>}
          {!!error && <Text accessibilityRole="alert" style={{ color: '#FCA5A5' }}>{error}</Text>}
        </View>
      </ScrollView>
      <FloatingCart bottom={24} />
    </View>
  );
}

const roundBtn = { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' };
