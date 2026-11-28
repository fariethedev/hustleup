import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, Share, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
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
  const [productFilter, setProductFilter] = useState('All');
  const [aboutOpen, setAboutOpen] = useState(false);
  const request = useRef(0);
  const owner = shop?.ownerId && shop.ownerId === user?.id;
  const bannerHeight = Math.round(Math.min(height * 0.32, width * 0.62));

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
  const categories = ['All', ...new Set(products.map(p => p.category).filter(Boolean))];
  const shown = productFilter === 'All' ? products : products.filter(p => p.category === productFilter);
  const bookable = appointmentTypes.includes(shop.businessType);
  const cardW = (width - 32 - 12) / 2;
  const message = () => (user ? router.push({ pathname: '/(tabs)/messages', params: { partnerId: shop.ownerId, partnerName: shop.ownerName || shop.name } }) : router.push('/login'));
  const facts = [
    shop.rating ? ['star', `${Number(shop.rating).toFixed(1)}`, `${shop.reviewCount || 0} review${shop.reviewCount === 1 ? '' : 's'}`] : null,
    ['package', `${shop.productCount ?? products.length}`, 'products'],
    shop.listingCount ? ['tag', `${shop.listingCount}`, 'listings'] : null,
  ].filter(Boolean);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
        {/* Cover */}
        <View style={{ width, height: bannerHeight, backgroundColor: c.purpleSoft }}>
          {shop.bannerUrl ? <Image source={{ uri: mediaUrl(shop.bannerUrl) }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            : <LinearGradient colors={[c.purple, '#4C1D95']} style={{ flex: 1 }} />}
          <LinearGradient colors={['rgba(0,0,0,0.45)', 'transparent']} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 110 }} />
          <View style={{ position: 'absolute', top: insets.top + 8, left: 14, right: 14, flexDirection: 'row', justifyContent: 'space-between' }}>
            <BackButton overlay />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {owner && <TouchableOpacity accessibilityLabel="Manage shop" onPress={() => router.push('/shop/manage')} style={roundBtn}><Feather name="pencil" size={18} color="#FFF" /></TouchableOpacity>}
              <TouchableOpacity accessibilityLabel="Share shop" onPress={() => Share.share({ message: `${shop.name} on HustleSpace${shop.tagline ? `: ${shop.tagline}` : ''}` })} style={roundBtn}><Feather name="share-2" size={18} color="#FFF" /></TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Shop card */}
        <View style={{ marginHorizontal: 16, marginTop: -40, padding: 16, borderRadius: 22, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, gap: 14,
          shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 3 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ width: 68, height: 68, borderRadius: 20, overflow: 'hidden', backgroundColor: c.purpleSoft, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.line }}>
              {shop.ownerAvatarUrl ? <Image source={{ uri: mediaUrl(shop.ownerAvatarUrl) }} style={{ width: '100%', height: '100%' }} />
                : <Text style={{ color: c.purple, fontSize: 28, fontWeight: '900' }}>{shop.name[0]}</Text>}
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text numberOfLines={2} style={{ color: c.text, fontSize: 20, fontWeight: '800', lineHeight: 25, flexShrink: 1 }}>{shop.name}</Text>
                {shop.ownerVerified && <MaterialCommunityIcons name="check-decagram" size={18} color={c.purple} accessibilityLabel="Verified" />}
              </View>
              <Text numberOfLines={1} style={{ color: c.muted, fontSize: 13 }}>{[shop.category, shop.city].filter(Boolean).join(' · ') || 'Local shop'}</Text>
              {!!shop.ownerName && <Text numberOfLines={1} style={{ color: c.muted, fontSize: 12 }}>by {shop.ownerName}</Text>}
            </View>
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {facts.map(([icon, value, label]) => (
              <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, height: 32, borderRadius: 16, backgroundColor: c.soft }}>
                <Feather name={icon} size={13} color={icon === 'star' ? '#D97706' : c.muted} />
                <Text style={{ color: c.text, fontSize: 13, fontWeight: '800' }}>{value}</Text>
                <Text style={{ color: c.muted, fontSize: 12 }}>{label}</Text>
              </View>
            ))}
            {bookable && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, height: 32, borderRadius: 16, backgroundColor: c.purpleSoft }}>
              <Feather name="calendar-check" size={13} color={c.purple} /><Text style={{ color: c.purple, fontSize: 12, fontWeight: '800' }}>Takes bookings</Text>
            </View>}
          </View>

          {!owner ? (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity onPress={toggleFollow} accessibilityRole="button" accessibilityState={{ selected: !!following }}
                style={{ flex: 1, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, backgroundColor: following ? c.card : c.lime, borderWidth: 1, borderColor: following ? c.line : c.lime }}>
                <Feather name={following ? 'check' : 'user-plus'} size={16} color={following ? c.text : c.onLime} />
                <Text style={{ color: following ? c.text : c.onLime, fontWeight: '800', fontSize: 15 }}>{following ? 'Following' : 'Follow'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={message} accessibilityRole="button"
                style={{ flex: 1, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, borderWidth: 1, borderColor: c.line, backgroundColor: c.card }}>
                <Feather name="message-circle" size={16} color={c.text} /><Text style={{ color: c.text, fontWeight: '800', fontSize: 15 }}>Message</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={() => router.push('/shop/manage')} accessibilityRole="button" style={{ height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, backgroundColor: c.lime }}>
              <Feather name="settings" size={16} color={c.onLime} /><Text style={{ color: c.onLime, fontWeight: '800', fontSize: 15 }}>Manage shop</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={{ paddingHorizontal: 16, paddingTop: 18, gap: 22 }}>
          {(!!shop.tagline || !!shop.description) && <View style={{ gap: 6 }}>
            <Text style={{ color: c.text, fontSize: 17, fontWeight: '800' }}>About</Text>
            {!!shop.tagline && <Text style={{ color: c.text, fontSize: 15, fontWeight: '600', lineHeight: 21 }}>{shop.tagline}</Text>}
            {!!shop.description && <>
              <Text numberOfLines={aboutOpen ? undefined : 3} style={{ color: c.muted, fontSize: 14, lineHeight: 21 }}>{shop.description}</Text>
              {shop.description.length > 140 && <TouchableOpacity onPress={() => setAboutOpen(v => !v)} hitSlop={8}><Text style={{ color: c.purple, fontSize: 14, fontWeight: '700' }}>{aboutOpen ? 'Show less' : 'Read more'}</Text></TouchableOpacity>}
            </>}
          </View>}

          <ShopHighlights key={shop.id} shop={shop} isOwner={owner} onSaved={setShop} onOpenProduct={openProduct} />

          {bookable && <View style={{ gap: 10 }}>
            <Text style={{ color: c.text, fontSize: 17, fontWeight: '800' }}>Book an appointment</Text>
            {!services.length && <Text style={{ color: c.muted, fontSize: 14 }}>This shop has not added services yet.</Text>}
            {services.filter(service => service.active !== false).map(service => {
              const on = selected?.id === service.id;
              return (
                <TouchableOpacity key={service.id} disabled={busy} onPress={() => chooseService(service)} accessibilityRole="button" accessibilityState={{ selected: on }}
                  style={{ padding: 14, backgroundColor: c.card, borderWidth: on ? 2 : 1, borderColor: on ? c.purple : c.line, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: c.purpleSoft, alignItems: 'center', justifyContent: 'center' }}><Feather name="scissors" size={17} color={c.purple} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: c.text, fontWeight: '800', fontSize: 15 }}>{service.name}</Text>
                    <Text style={{ color: c.muted, fontSize: 13 }}>{service.durationMinutes} min</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Text style={{ color: c.text, fontWeight: '900', fontSize: 15 }}>{money(service.price, service.currency)}</Text>
                    <Text style={{ color: c.purple, fontSize: 12, fontWeight: '800' }}>{on ? 'Selected' : 'Choose'}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
            {busy && <ActivityIndicator color={c.purple} />}
            {selected && !busy && !slots.length && <Text style={{ color: c.muted, fontSize: 14 }}>No upcoming times for this service.</Text>}
            {!!slots.length && <>
              <Text style={{ color: c.text, fontSize: 14, fontWeight: '700', marginTop: 4 }}>Pick a time</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {slots.map(slot => (
                  <TouchableOpacity key={slot.id} disabled={busy || owner} onPress={() => book(slot)} accessibilityRole="button"
                    style={{ paddingHorizontal: 14, height: 44, borderRadius: 22, justifyContent: 'center', backgroundColor: c.card, borderWidth: 1, borderColor: c.line }}>
                    <Text style={{ color: c.text, fontWeight: '700', fontSize: 13 }}>{new Date(slot.startTime).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>}
          </View>}

          {(products.length > 0 || !bookable) && <View style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
              <Text style={{ color: c.text, fontSize: 17, fontWeight: '800' }}>{bookable ? 'Products' : 'Shop'}</Text>
              <Text style={{ color: c.muted, fontSize: 13, fontWeight: '600' }}>{products.length} item{products.length === 1 ? '' : 's'}</Text>
            </View>
            {categories.length > 2 && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {categories.map(cat => {
                const on = productFilter === cat;
                return (
                  <TouchableOpacity key={cat} onPress={() => setProductFilter(cat)} accessibilityRole="button" accessibilityState={{ selected: on }}
                    style={{ paddingHorizontal: 14, height: 36, borderRadius: 18, justifyContent: 'center', backgroundColor: on ? c.text : c.card, borderWidth: 1, borderColor: on ? c.text : c.line }}>
                    <Text style={{ color: on ? c.bg : c.text, fontWeight: '700', fontSize: 13 }}>{cat}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>}
            {!products.length && <View style={{ alignItems: 'center', gap: 6, padding: 24, borderRadius: 18, backgroundColor: c.card, borderWidth: 1, borderColor: c.line }}>
              <Feather name="package" size={24} color={c.muted} />
              <Text style={{ color: c.text, fontWeight: '700' }}>Nothing on the shelf yet</Text>
            </View>}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {shown.map(product => <ListingCard key={product.id} item={storeListing(shop, product)} onOpen={() => openProduct(product)} style={{ width: cardW }} />)}
            </View>
          </View>}
          {!!error && <Text accessibilityRole="alert" style={{ color: c.danger, fontSize: 14 }}>{error}</Text>}
        </View>
      </ScrollView>
      <FloatingCart bottom={24} />
    </View>
  );
}

const roundBtn = { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' };
