import React, { useEffect, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { Copy, Panel, fonts, usePalette } from './Kit';
import PremiumBadge from '../PremiumBadge';
import { mediaUrl } from '../../utils/media';
import { categoryLabel, cartKey, cartGroup, money } from '../../utils/marketplace';
import { followsApi } from '../../api/client';
import { discoveryCartItem } from '../../utils/discovery';
import { useCart } from '../../store/CartProvider';

export function ListingCard({ item, onOpen, style }) {
  const c = usePalette();
  const router = useRouter();
  const user = useSelector(s => s.auth.user);
  const { items, add, ready, sessions } = useCart();
  const cartItem = discoveryCartItem(item);
  const added = items.some(row => cartKey(row) === cartKey(cartItem));
  const own = user?.id === item.sellerId;
  const instant = ['GOODS', 'FASHION', 'FOOD'].includes(item.listingType);
  const unavailable = (!!item.status && item.status !== 'ACTIVE') || (item.stockQuantity != null && item.stockQuantity <= 0);
  const pending = !!sessions[cartGroup(cartItem)];
  const photo = item.mediaUrls?.[0] || item.imageUrl;
  const addItem = () => { if (!user) { router.push('/login'); return; } if (!ready || unavailable || pending) return; if (added) router.push('/cart'); else add(cartItem); };
  return <Panel style={[{ padding: 0, borderRadius: 16, overflow: 'hidden', gap: 0 }, style]}>
    <Pressable accessibilityRole="button" accessibilityLabel={`View ${item.title}`} onPress={() => onOpen(item)} style={{ aspectRatio: 1.12, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center' }}>
      {photo ? <Image source={{ uri: mediaUrl(photo) }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : <Feather name="package" size={32} color={c.muted} />}
      <View style={{ position: 'absolute', top: 9, left: 9, backgroundColor: '#000B', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 12 }}><Copy style={{ color: '#FFF', fontSize: 10 }}>{item.listingType === 'EVENT' && item.eventStartsAt ? new Date(item.eventStartsAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : categoryLabel(item.listingType)}</Copy></View>
    </Pressable>
    <View style={{ padding: 10, gap: 7, flex: 1 }}>
      <Pressable onPress={() => onOpen(item)}><Copy numberOfLines={2} style={{ minHeight: 38, fontFamily: fonts.medium, fontSize: 13, lineHeight: 19 }}>{item.title}</Copy></Pressable>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 5 }}>
        <Copy heading numberOfLines={1} adjustsFontSizeToFit style={{ flexShrink: 1, color: c.accent, fontSize: 19, lineHeight: 24 }}>{money(item.price, item.currency)}</Copy>
        {own ? <Copy muted style={{ fontSize: 10 }}>Your listing</Copy> : <Pressable accessibilityRole="button" accessibilityLabel={instant ? (added ? 'Open cart' : 'Add to cart') : 'View listing details'} disabled={instant && (!ready || unavailable || pending)} onPress={instant ? addItem : () => onOpen(item)} style={{ minWidth: 36, height: 34, paddingHorizontal: instant && !added && !unavailable ? 10 : 0, borderRadius: 12, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5, opacity: instant && (!ready || unavailable || pending) ? 0.55 : 1 }}>
          <Feather name={instant ? added ? 'check' : 'shopping-bag' : 'arrow-right'} size={15} color={c.text} />
          {instant && <Copy style={{ fontSize: 10, fontFamily: fonts.medium }}>{unavailable ? 'Sold out' : pending ? 'Pending' : added ? 'In cart' : 'Add'}</Copy>}
        </Pressable>}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><Copy muted numberOfLines={1} style={{ flexShrink: 1, fontSize: 10 }}>{item.sellerName || item.locationCity || 'Local seller'}</Copy><PremiumBadge active={item.sellerPremium} />{item.sellerName && item.locationCity ? <Copy muted numberOfLines={1} style={{ flex: 1, textAlign: 'right', fontSize: 10 }}>{item.locationCity}</Copy> : null}</View>
    </View>
  </Panel>;
}
export function ShopCard({ shop, onPress }) {
  const c = usePalette();
  return <Pressable accessibilityRole="button" onPress={onPress}><Panel style={{ padding: 0, overflow: 'hidden' }}>{shop.bannerUrl ? <Image source={{ uri: mediaUrl(shop.bannerUrl) }} style={{ width: '100%', aspectRatio: 1.6 }} /> : <View style={{ height: 110, backgroundColor: c.soft, justifyContent: 'center', alignItems: 'center' }}><Feather name="shopping-bag" size={32} color={c.accent} /></View>}<View style={{ padding: 16, gap: 6 }}><Copy heading style={{ fontSize: 19 }}>{shop.name} <PremiumBadge active={shop.ownerPremium} /></Copy><Copy muted>{shop.city || 'Local shop'} · {shop.productCount ?? shop.products?.length ?? 0} products</Copy><Copy numberOfLines={2}>{shop.tagline || shop.description}</Copy><Copy style={{ color: c.accent }}>Visit shop →</Copy></View></Panel></Pressable>;
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
      <Feather name="chevron-right" size={19} color={c.muted} />
    </Pressable>
    <Copy muted numberOfLines={3} style={{ fontSize: 12, lineHeight: 18 }}>{person.bio || 'A member of your local HustleSpace community.'}</Copy>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderColor: c.line, paddingTop: 11 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><Feather name="users" size={15} color={c.accent} /><Copy style={{ fontFamily: fonts.medium, fontSize: 12 }}>{followerText}</Copy><Copy muted style={{ fontSize: 11 }}>followers</Copy></View>
      <Pressable accessibilityRole="button" onPress={onPress} style={{ paddingHorizontal: 13, minHeight: 34, borderRadius: 12, backgroundColor: c.soft, justifyContent: 'center' }}><Copy style={{ fontSize: 11, fontFamily: fonts.medium, color: c.accent }}>View profile</Copy></Pressable>
    </View>
  </Panel>;
}
