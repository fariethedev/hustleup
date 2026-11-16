import React, { useCallback, useRef, useState } from 'react';
import { Image, ScrollView, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { listingsApi, shopsApi, ticketsApi, followsApi } from '../../src/api/client';
import { useRemote } from '../../src/hooks/useRemote';
import { Notice, Screen, Copy, Panel, Button, usePalette } from '../../src/components/native/Kit';
import { storeListing, discoveryCartItem } from '../../src/utils/discovery';
import { canPurchaseListing, cartGroup, cartKey, categoryLabel, money } from '../../src/utils/marketplace';
import { mediaUrl } from '../../src/utils/media';
import { useCart } from '../../src/store/CartProvider';

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
  const item = listing ? discoveryCartItem(listing) : null;
  const inCart = item && cart.items.some(row => cartKey(row) === cartKey(item));
  const pending = item && !!cart.sessions[cartGroup(item)];
  const own = user?.id && listing?.sellerId === user.id;
  const event = listing?.listingType === 'EVENT';
  const unavailable = listing?.status && listing.status !== 'ACTIVE';
  const images = (listing?.mediaUrls || []).map(mediaUrl).filter(Boolean);
  const imageWidth = Math.max(1, width - 32);
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
    try { setCartError(''); await cart.add(item); if (event) router.push('/cart'); }
    catch { setCartError('Could not add this item. Please try again.'); }
  };
  return <Screen back title={event ? 'Event' : 'Listing'}>
    {loading ? <Notice loading message="Loading listing…" /> : error ? <Notice message={error} onRetry={reload} /> : listing && <>
      {images.length ? <View><ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>{images.map((uri, index) => <Image key={uri + index} source={{ uri }} accessibilityLabel={'Listing photo ' + (index + 1)} resizeMode="cover" style={{ width: imageWidth, height: Math.min(imageWidth, 420), backgroundColor: colors.soft, borderRadius: 20 }} />)}</ScrollView>{images.length > 1 && <Copy muted>Swipe to view all {images.length} photos</Copy>}</View> : <Panel><Copy muted>No photos added</Copy></Panel>}
      <Copy muted>{categoryLabel(listing.listingType)}{listing.locationCity ? ' · ' + listing.locationCity : ''}</Copy>
      <Copy heading style={{ fontSize: 28, lineHeight: 36 }}>{listing.title}</Copy>
      <Copy heading style={{ fontSize: 24, color: colors.accent }}>{Number(listing.price) === 0 ? 'Free' : money(listing.price, listing.currency)}{event ? ' / ticket' : ''}</Copy>
      {event && <Panel><Copy heading>Event details</Copy><Copy>{listing.eventStartsAt ? new Date(listing.eventStartsAt).toLocaleString() : 'Date to be announced'}</Copy><Copy>{listing.eventVenue || 'Venue to be announced'}</Copy>{listing.eventCapacity != null && <Copy muted>Capacity: {listing.eventCapacity}</Copy>}{!!listing.salesOpenAt && <Copy muted>Ticket sales open: {new Date(listing.salesOpenAt).toLocaleString()}</Copy>}{!!listing.salesCloseAt && <Copy muted>Ticket sales close: {new Date(listing.salesCloseAt).toLocaleString()}</Copy>}</Panel>}
      {!!listing.description && <Panel><Copy heading>{event ? 'About this event' : 'About this listing'}</Copy><Copy>{listing.description}</Copy></Panel>}
      {event && !!data.tickets?.length && <Panel><Copy heading>Your tickets</Copy><Copy>{data.tickets.length} ticket(s) for this event</Copy><Button onPress={() => router.push('/tickets')}>Open ticket wallet</Button></Panel>}
      {data.ticketError && <Notice message="Could not check your existing tickets." onRetry={reload} />}
      {!!listing.negotiable && <Copy muted>Open to offers. Message the seller to agree on a price.</Copy>}
      {listing.listingType === 'RENTAL' && <Copy muted>Agent fee: {money(listing.agentFeeAmount || 0, listing.currency)}</Copy>}
      {!!(cartError || cart.storageError) && <Notice message={cartError || cart.storageError} />}
      {own ? <Panel><Copy muted>This is your {event ? 'event' : 'listing'}.</Copy>{event && <Button onPress={() => router.push('/events/' + listing.id + '/door')}>Guest list & scanner</Button>}</Panel> : canPurchaseListing(listing) && <Panel>
        <Button disabled={!cart.ready || !!unavailable} onPress={add}>{unavailable ? 'Unavailable' : pending ? 'Continue checkout' : inCart ? 'View cart' : event ? 'Get tickets' : 'Add to cart'}</Button>
        {!event && inCart && <Copy muted>This item is in your cart.</Copy>}
        <Copy muted>{event ? 'Choose your ticket quantity and review the total in your cart. Paid tickets are issued after payment is confirmed.' : 'Review quantities, delivery and the total in your cart before paying.'}</Copy>
      </Panel>}
      {!!listing.sellerId && <Panel><Copy heading>{event ? 'Organiser' : 'Seller'}</Copy><Copy>{listing.sellerName || 'Community member'}</Copy><Button secondary onPress={() => router.push('/profile/' + listing.sellerId)}>View profile</Button>{!own && <Button busy={followingBusy} secondary onPress={follow}>{relationship?.isFollowing ? 'Following' : relationship?.followRequested ? 'Requested · Cancel' : 'Follow'}</Button>}{!own && <Button secondary onPress={() => user ? router.push({ pathname: '/(tabs)/messages', params: { partnerId: listing.sellerId, partnerName: listing.sellerName || 'Seller' } }) : router.push('/login')}>{event ? 'Contact organiser' : 'Message seller'}</Button>}</Panel>}
    </>}
  </Screen>;
}
