import React, { useEffect, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from './Icon';
import { useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { Copy, Panel, fonts, usePalette } from './Kit';
import PremiumBadge from '../PremiumBadge';
import { mediaUrl } from '../../utils/media';
import { categoryLabel, cartKey, money } from '../../utils/marketplace';
import { followsApi } from '../../api/client';
import { discoveryCartItem } from '../../utils/discovery';
import { useCart } from '../../store/CartProvider';

export function ListingCard({ item, onOpen, style }) {
  const c = usePalette();
  const router = useRouter();
  const user = useSelector(s => s.auth.user);
  const { items, add, ready, isPending } = useCart();
  const cartItem = discoveryCartItem(item);
  const added = items.some(row => cartKey(row) === cartKey(cartItem));
  const own = user?.id === item.sellerId;
  const instant = ['GOODS', 'FASHION', 'FOOD'].includes(item.listingType);
  const unavailable = (!!item.status && item.status !== 'ACTIVE') || (item.stockQuantity != null && item.stockQuantity <= 0);
  const pending = isPending(cartItem);
  const photo = item.mediaUrls?.[0] || item.imageUrl;
  const addItem = () => { if (!user) { router.push('/login'); return; } if (!ready || unavailable || pending) return; if (added) router.push('/cart'); else add(cartItem); };
  // Straight from the grid to paying: add (if needed) and open checkout.
  const buyNow = async () => {
    if (!user) { router.push('/login'); return; }
    if (!ready || unavailable) return;
    try { if (!added && !pending) await add(cartItem); router.push('/checkout'); } catch { router.push('/cart'); }
  };
  return <Panel style={[{ padding: 0, borderRadius: 16, overflow: 'hidden', gap: 0 }, style]}>
    <Pressable accessibilityRole="button" accessibilityLabel={`View ${item.title}`} onPress={() => onOpen(item)} style={{ aspectRatio: 1.12, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center' }}>
      {photo ? <Image source={{ uri: mediaUrl(photo) }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : <Feather name="package" size={32} color={c.muted} />}
      <View style={{ position: 'absolute', top: 9, left: 9, backgroundColor: '#000B', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 12 }}><Copy style={{ color: '#FFF', fontSize: 12 }}>{item.listingType === 'EVENT' && item.eventStartsAt ? new Date(item.eventStartsAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : categoryLabel(item.listingType)}</Copy></View>
    </Pressable>
    <View style={{ padding: 10, gap: 7, flex: 1 }}>
      <Pressable onPress={() => onOpen(item)}><Copy numberOfLines={2} style={{ minHeight: 40, fontFamily: fonts.medium, fontSize: 14, lineHeight: 20 }}>{item.title}</Copy></Pressable>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 5 }}>
        <Copy heading style={{ flexShrink: 1, color: c.text, fontSize: 16, lineHeight: 21 }}>{money(item.price, item.currency)}{item.listingType === 'LUGGAGE' ? ' / kg' : item.listingType === 'RENTAL' ? ' / mo' : ''}</Copy>
        {own && <Copy muted style={{ fontSize: 12 }}>Your listing</Copy>}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><Copy muted numberOfLines={1} style={{ flexShrink: 1, fontSize: 12 }}>{item.sellerName || item.locationCity || 'Local seller'}</Copy><PremiumBadge active={item.sellerPremium} /></View>
      {!own && <View style={{ flexDirection: 'row', gap: 6, marginTop: 'auto' }}>
        {instant ? <>
          <Pressable accessibilityRole="button" accessibilityLabel={added ? 'Open cart' : 'Add to cart'} disabled={!ready || unavailable || pending} onPress={addItem}
            style={{ width: 38, height: 38, borderRadius: 12, borderWidth: 1, borderColor: added ? c.accent : c.line, alignItems: 'center', justifyContent: 'center', opacity: !ready || unavailable ? 0.5 : 1 }}>
            <Feather name={added ? 'check' : 'shopping-bag'} size={16} color={added ? c.accent : c.text} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`Buy ${item.title} now`} disabled={!ready || unavailable} onPress={buyNow}
            style={({ pressed }) => ({ flex: 1, height: 38, borderRadius: 12, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', opacity: !ready || unavailable ? 0.5 : pressed ? 0.85 : 1 })}>
            <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 13 }}>{unavailable ? 'Sold out' : pending ? 'Checkout' : 'Buy now'}</Text>
          </Pressable>
        </> : <Pressable accessibilityRole="button" onPress={() => onOpen(item)}
          style={{ flex: 1, height: 38, borderRadius: 12, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: c.text, fontWeight: '700', fontSize: 13 }}>{['HAIR_BEAUTY', 'SKILL'].includes(item.listingType) ? 'Book' : item.listingType === 'RENTAL' ? 'Book a viewing' : item.listingType === 'EVENT' ? 'Get tickets' : item.listingType === 'LUGGAGE' ? 'Book space' : 'View'}</Text>
        </Pressable>}
      </View>}
    </View>
  </Panel>;
}
export function ShopCard({ shop, onPress }) {
  const c = usePalette();
  return <Pressable accessibilityRole="button" onPress={onPress}><Panel style={{ padding: 0, overflow: 'hidden' }}>{shop.bannerUrl ? <Image source={{ uri: mediaUrl(shop.bannerUrl) }} style={{ width: '100%', aspectRatio: 1.6 }} /> : <View style={{ height: 110, backgroundColor: c.soft, justifyContent: 'center', alignItems: 'center' }}><Feather name="shopping-bag" size={32} color={c.accent} /></View>}<View style={{ padding: 16, gap: 6 }}><Copy heading style={{ fontSize: 19 }}>{shop.name} <PremiumBadge active={shop.ownerPremium} /></Copy><Copy muted>{shop.city || 'Local shop'} · {shop.productCount ?? shop.products?.length ?? 0} products</Copy><Copy numberOfLines={2}>{shop.tagline || shop.description}</Copy><Copy style={{ color: c.accent }}>Visit shop</Copy></View></Panel></Pressable>;
}

/** Wide card for the Home carousel: cover, logo, name, rating and what the shop offers. */
export function ShopCarouselCard({ shop, width, onPress }) {
  const c = usePalette();
  const cover = mediaUrl(shop.bannerUrl);
  const avatar = mediaUrl(shop.ownerAvatarUrl);
  const thumbs = (shop.products || []).map(p => mediaUrl(p.imageUrl || p.mediaUrls?.[0])).filter(Boolean).slice(0, 3);
  const accent = /^#[0-9a-f]{6}$/i.test(shop.accentColor || '') ? shop.accentColor : c.purple;
  const count = shop.productCount ?? shop.products?.length ?? 0;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${shop.name}, ${shop.city || 'local shop'}`}
      style={({ pressed }) => ({ width, borderRadius: 22, overflow: 'hidden', backgroundColor: c.card, borderWidth: 1, borderColor: c.line, opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] })}>
      <View style={{ height: width * 0.5, backgroundColor: accent + '22' }}>
        {cover ? <Image source={{ uri: cover }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          : <LinearGradient colors={[accent, accent + '99']} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Feather name="shopping-bag" size={30} color="#FFF" /></LinearGradient>}
        <LinearGradient colors={['transparent', '#00000070']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '55%' }} />
        <View style={{ position: 'absolute', top: 10, right: 10, flexDirection: 'row', gap: 6 }}>
          {shop.appointmentBased && <View style={{ paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10, backgroundColor: '#FFFFFFE6' }}><Text style={{ color: '#111', fontSize: 11, fontWeight: '800' }}>Bookable</Text></View>}
          {shop.rating > 0 && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10, backgroundColor: '#FFFFFFE6' }}><Feather name="star" size={11} color="#D97706" /><Text style={{ color: '#111', fontSize: 11, fontWeight: '800' }}>{Number(shop.rating).toFixed(1)}{shop.reviewCount ? ` (${shop.reviewCount})` : ''}</Text></View>}
        </View>
        {thumbs.length > 0 && <View style={{ position: 'absolute', right: 10, bottom: 10, flexDirection: 'row', gap: 5 }}>
          {thumbs.map((uri, i) => <Image key={uri + i} source={{ uri }} style={{ width: 34, height: 34, borderRadius: 9, borderWidth: 2, borderColor: '#FFF' }} />)}
        </View>}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12 }}>
        <View style={{ width: 52, height: 52, marginTop: -22, borderRadius: 16, borderWidth: 3, borderColor: c.card, backgroundColor: c.purpleSoft, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
          {avatar ? <Image source={{ uri: avatar }} style={{ width: '100%', height: '100%' }} /> : <Text style={{ color: c.purple, fontWeight: '900', fontSize: 20 }}>{(shop.name || '?')[0].toUpperCase()}</Text>}
        </View>
        <View style={{ flex: 1, paddingTop: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Text numberOfLines={1} style={{ color: c.text, fontSize: 15, fontWeight: '800', flexShrink: 1 }}>{shop.name}</Text>
            {shop.ownerVerified && <Feather name="check-circle" size={13} color={c.purple} />}
            <PremiumBadge active={shop.ownerPremium} />
          </View>
          <Text numberOfLines={1} style={{ color: c.muted, fontSize: 12 }}>{[shop.category, shop.city].filter(Boolean).join(' · ') || 'Local shop'}</Text>
        </View>
      </View>
      <View style={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: 12, gap: 8 }}>
        {!!(shop.tagline || shop.description) && <Text numberOfLines={1} style={{ color: c.text, fontSize: 13 }}>{shop.tagline || shop.description}</Text>}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ color: c.muted, fontSize: 12, flex: 1 }}>{count} {count === 1 ? 'item' : 'items'}</Text>
          <Text style={{ color: c.purple, fontSize: 13, fontWeight: '800' }}>Visit shop</Text>
        </View>
      </View>
    </Pressable>
  );
}

export function PersonCard({ person, onPress }) {
  const c = usePalette();
  const [followers, setFollowers] = useState(person.followers ?? person.followerCount ?? null);
  useEffect(() => {
    let active = true;
    const providedCount = person.followers ?? person.followerCount;
    if (providedCount != null) setFollowers(providedCount);
    else if (person.id) followsApi.getCounts(person.id)
      .then(response => { if (active) setFollowers(response.data?.followers ?? 0); })
      .catch(() => {});
    return () => { active = false; };
  }, [person.id, person.followers, person.followerCount]);
  const followerText = followers == null ? '—' : Number(followers).toLocaleString();
  return <Panel style={{ padding: 16, gap: 14 }}>
    <Pressable accessibilityRole="button" accessibilityLabel={`View ${person.fullName || person.username || 'person'} profile`} onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 13 }}>
      <View style={{ width: 66, height: 66, borderRadius: 23, backgroundColor: c.soft, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.line }}>
        {person.avatarUrl ? <Image source={{ uri: mediaUrl(person.avatarUrl) }} style={{ width: '100%', height: '100%' }} /> : <Feather name="user" size={26} color={c.muted} />}
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><Copy heading numberOfLines={1} style={{ flexShrink: 1, fontSize: 17 }}>{person.fullName || person.username || 'Community member'}</Copy><PremiumBadge active={person.premium} /></View>
        {!!person.username && !!person.fullName && <Copy muted numberOfLines={1} style={{ fontSize: 11 }}>@{person.username}</Copy>}
        {person.city && <Copy muted numberOfLines={1} style={{ fontSize: 11 }}>{person.city}</Copy>}
      </View>
      
    </Pressable>
    <Copy muted numberOfLines={3} style={{ fontSize: 12, lineHeight: 18 }}>{person.bio || 'A member of your local HustleSpace community.'}</Copy>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderColor: c.line, paddingTop: 11 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><Feather name="users" size={15} color={c.accent} /><Copy style={{ fontFamily: fonts.medium, fontSize: 12 }}>{followerText}</Copy><Copy muted style={{ fontSize: 11 }}>followers</Copy></View>
      <Pressable accessibilityRole="button" onPress={onPress} style={{ paddingHorizontal: 13, minHeight: 48, borderRadius: 12, backgroundColor: c.soft, justifyContent: 'center' }}><Copy style={{ fontSize: 11, fontFamily: fonts.medium, color: c.accent }}>View profile</Copy></Pressable>
    </View>
  </Panel>;
}
