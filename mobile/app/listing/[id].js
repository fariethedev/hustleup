import React, { useCallback, useRef, useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, Share, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import FloatingCart from '../../src/components/native/FloatingCart';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { bookingsApi, directMessagesApi, listingsApi, shopsApi, ticketsApi, followsApi } from '../../src/api/client';
import { useRemote } from '../../src/hooks/useRemote';
import { Notice, Copy, Button, usePalette } from '../../src/components/native/Kit';
import { storeListing, discoveryCartItem } from '../../src/utils/discovery';
import { canPurchaseListing, cartKey, categoryLabel, errorMessage, money, ticketTiers } from '../../src/utils/marketplace';
import { mediaUrl } from '../../src/utils/media';
import { useCart } from '../../src/store/CartProvider';
import SwapOfferSheet from '../../src/components/listings/SwapOfferSheet';
import { ReportButton, TraderNotice } from '../../src/components/trust/TrustWidgets';

export default function Listing() {
  const { id } = useLocalSearchParams();
  const router = useRouter(), colors = usePalette();
  const { width } = useWindowDimensions();
  const user = useSelector(s => s.auth.user);
  const cart = useCart();
  const [cartError, setCartError] = useState('');
  const [followingBusy, setFollowingBusy] = useState(false);
  const followLock = useRef(false);
  const [followOverride, setFollowOverride] = useState(null);
  const [offerOpen, setOfferOpen] = useState(false);
  const [offerPrice, setOfferPrice] = useState('');
  const [offerNote, setOfferNote] = useState('');
  const [offerBusy, setOfferBusy] = useState(false);
  const [tierId, setTierId] = useState(null);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [swapOpen, setSwapOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const gallery = useRef(null);
  const showPhoto = i => { setPhotoIndex(i); gallery.current?.scrollTo({ x: i * imageWidth, animated: true }); };
  const fetcher = useCallback(async () => {
    let listing;
    if (String(id).startsWith('shop:')) {
      const [, shopId, productId] = String(id).split(':');
      const shop = (await shopsApi.get(shopId)).data;
      const product = shop.products?.find(p => String(p.id) === productId);
      if (!product) throw new Error('Product unavailable');
      listing = storeListing(shop, product);
    } else listing = (await listingsApi.getById(id)).data;
    let tickets = [], ticketError = false;
    if (user?.id && listing.listingType === 'EVENT') {
      try { tickets = (await ticketsApi.forEventMine(id)).data; }
      catch { ticketError = true; }
    }
    let relationship = null;
    if (user?.id && listing.sellerId && listing.sellerId !== user.id) {
      try { relationship = (await followsApi.relationship(listing.sellerId)).data; } catch { /* Show retryable follow feedback without hiding the listing. */ }
    }
    return { listing, tickets, ticketError, relationship };
  }, [id, user]);
  const { data, loading, error, reload } = useRemote(fetcher);
  const listing = data?.listing;
  const tiers = ticketTiers(listing);
  const tier = tiers.find(t => t.id === tierId) || null;
  const baseItem = listing ? discoveryCartItem(listing) : null;
  // A tiered ticket is its own cart line, priced at that tier (the server re-prices it anyway).
  const item = baseItem && tier ? { ...baseItem, ticketTier: tier.id, price: tier.price, title: `${listing.title} — ${tier.name}` } : baseItem;
  const inCart = item && cart.items.some(row => cartKey(row) === cartKey(item));
  const pending = item && cart.isPending(item);
  const own = user?.id && listing?.sellerId === user.id;
  const event = listing?.listingType === 'EVENT';
  const unavailable = listing?.status && listing.status !== 'ACTIVE';
  const images = (listing?.mediaUrls || []).map(mediaUrl).filter(Boolean);
  // Full-bleed gallery: the photos lead the page, the details below stay compact.
  const imageWidth = width;
  const relationship = followOverride?.id === id ? followOverride.value : data?.relationship;
  const follow = async () => {
    if (!user) { router.push('/login'); return; }
    if (followLock.current || own) return;
    followLock.current = true; setFollowingBusy(true); setCartError('');
    try {
      const current = relationship || (await followsApi.relationship(listing.sellerId)).data;
      if (current.blocked || current.blockedBy) throw new Error('This follow is unavailable.');
      if (current.isFollowing || current.followRequested) await followsApi.unfollow(listing.sellerId);
      else await followsApi.follow(listing.sellerId);
      const updated = (await followsApi.relationship(listing.sellerId)).data;
      setFollowOverride({ id, value: updated });
    } catch (e) { setCartError(e.response?.data?.error || e.message || 'Could not update follow status.'); }
    finally { followLock.current = false; setFollowingBusy(false); }
  };
  const add = async () => {
    if (!user) { router.push('/login'); return; }
    if (inCart || pending) { router.push('/cart'); return; }
    if (!cart.ready || unavailable || own) return;
    if (tiers.length && !tier) { setCartError('Choose a ticket type first.'); return; }
    try { setCartError(''); await cart.add(item); if (event) router.push('/cart'); }
    catch { setCartError('Could not add this item. Please try again.'); }
  };
  // One tap from "I want this" to the payment screen: no detour through browsing the cart.
  const buyNow = async () => {
    if (!user) { router.push('/login'); return; }
    if (!cart.ready || unavailable || own) return;
    try { if (!inCart && !pending) await cart.add(item); router.push('/checkout'); }
    catch { setCartError('Could not start checkout. Please try again.'); }
  };
  // Negotiated checkout, as on the web: an offer becomes a booking the seller can accept or
  // counter, and a live offer card lands in the chat so the conversation carries the deal.
  const sendOffer = async () => {
    const price = Number(String(offerPrice).replace(',', '.'));
    if (!(price > 0)) { Alert.alert('Enter an amount', 'Your offer must be more than zero.'); return; }
    setOfferBusy(true);
    try {
      const { data: booking } = await bookingsApi.create({ listingId: listing.id, offeredPrice: price });
      await directMessagesApi.sendMessage(listing.sellerId, offerNote.trim() || `Offer: ${money(price, listing.currency)} for ${listing.title}`, { type: 'OFFER', bookingId: booking.id });
      setOfferOpen(false); setOfferPrice(''); setOfferNote('');
      router.push({ pathname: '/(tabs)/messages', params: { partnerId: listing.sellerId, partnerName: listing.sellerName || 'Seller' } });
    } catch (e) { Alert.alert('Offer not sent', errorMessage(e, 'Please try again.')); }
    finally { setOfferBusy(false); }
  };
  const purchasable = listing && !own && canPurchaseListing(listing);
  const sellerCard = listing?.sellerId && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line }}>
    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.purpleSoft, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.purple, fontWeight: '900', fontSize: 18 }}>{(listing.sellerName || '?')[0]}</Text></View>
    <View style={{ flex: 1 }}>
      <Text style={{ color: colors.muted, fontSize: 11 }}>{event ? 'Organiser' : 'Sold by'}</Text>
      <Text style={{ color: colors.text, fontWeight: '800' }} numberOfLines={1}>{listing.sellerName || 'Community member'}</Text>
      <View style={{ flexDirection: 'row', gap: 14, marginTop: 6 }}>
        <Pressable onPress={() => router.push('/profile/' + listing.sellerId)} hitSlop={6}><Text style={{ color: colors.purple, fontSize: 12, fontWeight: '800' }}>Profile</Text></Pressable>
        {!own && <Pressable onPress={follow} disabled={followingBusy} hitSlop={6}><Text style={{ color: colors.purple, fontSize: 12, fontWeight: '800' }}>{relationship?.isFollowing ? 'Following' : relationship?.followRequested ? 'Requested' : 'Follow'}</Text></Pressable>}
        {!own && <Pressable onPress={() => user ? router.push({ pathname: '/(tabs)/messages', params: { partnerId: listing.sellerId, partnerName: listing.sellerName || 'Seller' } }) : router.push('/login')} hitSlop={6}><Text style={{ color: colors.purple, fontSize: 12, fontWeight: '800' }}>Message</Text></Pressable>}
      </View>
    </View>
  </View>;

  return <View style={{ flex: 1, backgroundColor: colors.bg }}>
    {loading ? <View style={{ flex: 1, paddingTop: insets.top + 60, padding: 20 }}><Notice loading message="Loading listing…" /></View>
      : error ? <View style={{ flex: 1, paddingTop: insets.top + 60, padding: 20 }}><Notice message={error} onRetry={reload} /></View>
      : listing && <ScrollView contentContainerStyle={{ paddingBottom: purchasable ? 120 : 40 }} showsVerticalScrollIndicator={false}>
      {/* Main photo, swipeable; thumbnails underneath show which one you're viewing */}
      <View>
        {images.length ? <ScrollView ref={gallery} horizontal pagingEnabled showsHorizontalScrollIndicator={false} scrollEventThrottle={16}
          onScroll={e => setPhotoIndex(Math.round(e.nativeEvent.contentOffset.x / imageWidth))}>
          {images.map((uri, index) => <Image key={uri + index} source={{ uri }} accessibilityLabel={'Listing photo ' + (index + 1)} resizeMode="cover" style={{ width: imageWidth, height: Math.round(imageWidth * 1.05), backgroundColor: colors.soft }} />)}
        </ScrollView> : <View style={{ width: imageWidth, height: Math.round(imageWidth * 0.7), backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' }}><Feather name="image" size={36} color={colors.muted} /></View>}
        <View style={{ position: 'absolute', top: insets.top + 8, left: 14, right: 14, flexDirection: 'row', justifyContent: 'space-between' }}>
          <TouchableOpacity accessibilityLabel="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} style={overlayBtn}><Feather name="arrow-left" size={20} color="#FFF" /></TouchableOpacity>
          <TouchableOpacity accessibilityLabel="Share" onPress={() => Share.share({ message: `${listing.title} — ${money(listing.price, listing.currency)} on HustleSpace` })} style={overlayBtn}><Feather name="share-2" size={18} color="#FFF" /></TouchableOpacity>
        </View>
      </View>
      {images.length > 1 && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 18, paddingTop: 12 }}>
        {images.map((uri, i) => <Pressable key={uri + i} accessibilityLabel={`Show photo ${i + 1}`} onPress={() => showPhoto(i)}
          style={{ width: 58, height: 58, borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: i === photoIndex ? colors.purple : 'transparent', opacity: i === photoIndex ? 1 : 0.6 }}>
          <Image source={{ uri }} style={{ width: '100%', height: '100%' }} />
        </Pressable>)}
      </ScrollView>}

      <View style={{ padding: 18, gap: 12 }}>
        <View style={{ gap: 4 }}>
          <Text style={{ color: colors.muted, fontSize: 12 }}>{categoryLabel(listing.listingType)}{listing.locationCity ? ' · ' + listing.locationCity : ''}</Text>
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800', lineHeight: 26 }}>{listing.title}</Text>
          <Text style={{ color: colors.accent, fontSize: 18, fontWeight: '900' }}>{Number(listing.price) === 0 ? 'Free' : (tiers.length ? 'From ' : '') + money(listing.price, listing.currency)}{event && !tiers.length ? ' / ticket' : ''}</Text>
          {!!listing.swapEnabled && <View style={{ alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: colors.purpleSoft, marginTop: 4 }}><Text style={{ color: colors.purple, fontSize: 12, fontWeight: '800' }}>⇄ Open to swaps · cash top-ups welcome</Text></View>}
        </View>

        {event && <View style={{ gap: 6, padding: 14, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line }}>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}><Feather name="calendar" size={15} color={colors.purple} /><Text style={{ color: colors.text, fontWeight: '700' }}>{listing.eventStartsAt ? new Date(listing.eventStartsAt).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Date to be announced'}</Text></View>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}><Feather name="map-pin" size={15} color={colors.purple} /><Text style={{ color: colors.text }}>{listing.eventVenue || 'Venue to be announced'}</Text></View>
          {listing.eventCapacity != null && <Text style={{ color: colors.muted, fontSize: 12 }}>Capacity {listing.eventCapacity}</Text>}
        </View>}

        {event && tiers.length > 0 && <View style={{ gap: 8 }}>
          <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>Choose your ticket</Text>
          {tiers.map(t => {
            const on = tierId === t.id;
            return <Pressable key={t.id} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => setTierId(t.id)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, borderWidth: 1.5, borderColor: on ? colors.purple : colors.line, backgroundColor: on ? colors.purpleSoft : 'transparent' }}>
              <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: on ? colors.purple : colors.muted, alignItems: 'center', justifyContent: 'center' }}>{on && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.purple }} />}</View>
              <View style={{ flex: 1 }}><Text style={{ color: colors.text, fontWeight: '800' }}>{t.name}</Text>{!!t.quantity && <Text style={{ color: colors.muted, fontSize: 11 }}>{t.quantity} available</Text>}</View>
              <Text style={{ color: colors.accent, fontWeight: '900' }}>{Number(t.price) === 0 ? 'Free' : money(t.price, listing.currency)}</Text>
            </Pressable>;
          })}
        </View>}

        {!!listing.description && <View style={{ gap: 4 }}>
          <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>{event ? 'About this event' : 'Description'}</Text>
          <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 21 }}>{listing.description}</Text>
        </View>}
        {listing.listingType === 'RENTAL' && <Text style={{ color: colors.muted, fontSize: 13 }}>Agent fee: {money(listing.agentFeeAmount || 0, listing.currency)}</Text>}
        {!!listing.sellerId && <TraderNotice sellerId={listing.sellerId} />}
        {!own && !!user && <ReportButton targetType="LISTING" targetId={listing.id} />}

        {event && !!data.tickets?.length && <TouchableOpacity onPress={() => router.push('/tickets')} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 16, backgroundColor: colors.purpleSoft }}><Feather name="credit-card" size={18} color={colors.purple} /><Text style={{ color: colors.purple, fontWeight: '800', flex: 1 }}>You have {data.tickets.length} ticket(s) — open wallet</Text><Feather name="chevron-right" size={18} color={colors.purple} /></TouchableOpacity>}
        {data.ticketError && <Notice message="Could not check your existing tickets." onRetry={reload} />}

        {!own && !unavailable && !event && (listing.negotiable || listing.swapEnabled) && <View style={{ flexDirection: 'row', gap: 10 }}>
          {!!listing.negotiable && <TouchableOpacity onPress={() => (user ? setOfferOpen(true) : router.push('/login'))} style={{ flex: 1, minHeight: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}><Feather name="tag" size={15} color={colors.text} /><Text style={{ color: colors.text, fontWeight: '700' }}>Make an offer</Text></TouchableOpacity>}
          {!!listing.swapEnabled && <TouchableOpacity onPress={() => (user ? setSwapOpen(true) : router.push('/login'))} style={{ flex: 1, minHeight: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.purple, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}><Feather name="repeat" size={15} color={colors.purple} /><Text style={{ color: colors.purple, fontWeight: '800' }}>Offer a swap</Text></TouchableOpacity>}
        </View>}

        {own && <View style={{ padding: 14, borderRadius: 16, backgroundColor: colors.card, gap: 8 }}><Text style={{ color: colors.muted }}>This is your {event ? 'event' : 'listing'}.</Text>{event && <Button onPress={() => router.push('/events/' + listing.id + '/door')}>Guest list & scanner</Button>}</View>}
        {!!(cartError || cart.storageError) && <Notice message={cartError || cart.storageError} />}

        {sellerCard}
        {purchasable && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', marginTop: 2 }}>
          <Feather name="shield" size={11} color={colors.muted} />
          <Text style={{ color: colors.muted, fontSize: 10 }}>Buyer protection — payment held until you confirm receipt.</Text>
        </View>}
      </View>
    </ScrollView>}

    {/* Sticky purchase bar */}
    {purchasable && <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 12), backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.line }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.muted, fontSize: 11 }}>{tier ? tier.name : event ? 'Tickets from' : 'Price'}</Text>
        <Text style={{ color: colors.text, fontSize: 17, fontWeight: '900' }} numberOfLines={1}>{Number(item?.price ?? listing.price) === 0 ? 'Free' : money(item?.price ?? listing.price, listing.currency)}</Text>
      </View>
      {unavailable ? <View style={{ minHeight: 48, paddingHorizontal: 22, borderRadius: 24, backgroundColor: colors.soft, justifyContent: 'center' }}><Text style={{ color: colors.muted, fontWeight: '800' }}>Unavailable</Text></View> : event ? (
        <TouchableOpacity onPress={add} disabled={!cart.ready} style={{ minHeight: 48, paddingHorizontal: 26, borderRadius: 24, backgroundColor: colors.accent, justifyContent: 'center' }}>
          <Text style={{ color: colors.light ? '#FFF' : '#111', fontWeight: '900', fontSize: 15 }}>{pending ? 'Continue checkout' : 'Get tickets'}</Text>
        </TouchableOpacity>
      ) : <>
        <TouchableOpacity accessibilityLabel={inCart ? 'View cart' : 'Add to cart'} onPress={add} disabled={!cart.ready}
          style={{ width: 48, height: 48, borderRadius: 24, borderWidth: 1.5, borderColor: colors.purple, alignItems: 'center', justifyContent: 'center', backgroundColor: inCart ? colors.purpleSoft : 'transparent' }}>
          <Feather name={inCart ? 'check' : 'shopping-bag'} size={20} color={colors.purple} />
        </TouchableOpacity>
        <TouchableOpacity onPress={buyNow} disabled={!cart.ready} style={{ minHeight: 48, paddingHorizontal: 26, borderRadius: 24, backgroundColor: colors.accent, justifyContent: 'center' }}>
          <Text style={{ color: colors.light ? '#FFF' : '#111', fontWeight: '900', fontSize: 15 }}>{pending ? 'Continue checkout' : 'Buy now'}</Text>
        </TouchableOpacity>
      </>}
    </View>}
    {listing && !own && <FloatingCart bottom={purchasable ? 92 : 24} />}

    <SwapOfferSheet visible={swapOpen} target={listing} onClose={() => setSwapOpen(false)} />
    <Modal visible={offerOpen} transparent animationType="slide" onRequestClose={() => setOfferOpen(false)}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <View style={{ backgroundColor: colors.bg, padding: 20, gap: 12, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
          <Copy heading style={{ fontSize: 20 }}>Make an offer</Copy>
          {!!listing && <Copy muted>Asking price {money(listing.price, listing.currency)}. The seller can accept or counter; you only pay once you agree.</Copy>}
          <TextInput accessibilityLabel="Offer amount" keyboardType="decimal-pad" placeholder={`Your offer (${listing?.currency || 'PLN'})`} placeholderTextColor={colors.muted} value={offerPrice} onChangeText={setOfferPrice} style={{ color: colors.text, borderWidth: 1, borderColor: colors.line, borderRadius: 14, padding: 14, fontSize: 18 }} />
          <TextInput accessibilityLabel="Message to seller" placeholder="Add a message (optional)" placeholderTextColor={colors.muted} value={offerNote} onChangeText={setOfferNote} multiline maxLength={500} style={{ color: colors.text, borderWidth: 1, borderColor: colors.line, borderRadius: 14, padding: 14, minHeight: 70 }} />
          <Button busy={offerBusy} onPress={sendOffer}>Send offer</Button>
          <Button secondary onPress={() => setOfferOpen(false)}>Cancel</Button>
        </View>
      </View>
    </Modal>
  </View>;
}

const overlayBtn = { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' };
