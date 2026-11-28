import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, LayoutAnimation, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Feather } from '../src/components/native/Icon';
import * as Haptics from 'expo-haptics';
import { useCart } from '../src/store/CartProvider';
import { listingsApi } from '../src/api/client';
import { cartKey, money } from '../src/utils/marketplace';
import { discoveryCartItem } from '../src/utils/discovery';
import { mediaUrl } from '../src/utils/media';
import { usePalette, BackButton } from '../src/components/native/Kit';

/** Who an item is bought from: one group per shop, one per marketplace seller. */
const sellerOf = (item) => item.kind === 'product'
  ? { key: `shop:${item.shopId}`, name: item.shopName || 'Shop', icon: 'store', route: item.sellerId ? { pathname: '/shop/[userId]', params: { userId: item.sellerId, shopId: item.shopId } } : null }
  : { key: `seller:${item.sellerId || 'market'}`, name: item.sellerName || item.seller?.fullName || 'Marketplace seller', icon: 'user', route: item.sellerId ? `/profile/${item.sellerId}` : null };
const tap = () => { try { Haptics.selectionAsync(); } catch { /* optional */ } };
const QUICK_BUY = ['GOODS', 'FASHION', 'FOOD'];

function Stepper({ value, min = 1, max = 99, onChange, label, c }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Pressable disabled={value <= min} onPress={() => { tap(); onChange(value - 1); }} accessibilityLabel={`One fewer ${label}`} hitSlop={6}
        style={{ width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center', opacity: value <= min ? 0.35 : 1 }}>
        <Feather name="minus" size={14} color={c.text} />
      </Pressable>
      <Text style={{ color: c.text, fontWeight: '800', fontSize: 15, minWidth: 26, textAlign: 'center' }} accessibilityLabel={`Quantity ${value}`}>{value}</Text>
      <Pressable disabled={value >= max} onPress={() => { tap(); onChange(value + 1); }} accessibilityLabel={`One more ${label}`} hitSlop={6}
        style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c.lime, alignItems: 'center', justifyContent: 'center', opacity: value >= max ? 0.35 : 1 }}>
        <Feather name="plus" size={14} color={c.onLime} />
      </Pressable>
    </View>
  );
}

/**
 * The cart: each item on its own card under its seller, a summary of what you will pay,
 * a few suggestions, and one way forward. Paying happens on the checkout screen.
 */
export default function CartScreen() {
  const router = useRouter();
  const c = usePalette();
  const insets = useSafeAreaInsets();
  const { items, add, quantity, ready, sessions, isPending, storageError } = useCart();
  const [suggestions, setSuggestions] = useState([]);

  useFocusEffect(useCallback(() => {
    let alive = true;
    listingsApi.getRecommended().then(({ data }) => {
      if (!alive) return;
      const list = Array.isArray(data) ? data : data?.content || [];
      setSuggestions(list.filter(l => QUICK_BUY.includes(l.listingType) && (!l.status || l.status === 'ACTIVE')).slice(0, 10));
    }).catch(() => {});
    return () => { alive = false; };
  }, []));

  const sellers = [];
  items.forEach(item => {
    const seller = sellerOf(item);
    let group = sellers.find(g => g.key === seller.key);
    if (!group) { group = { ...seller, rows: [] }; sellers.push(group); }
    group.rows.push(item);
  });
  const count = items.reduce((n, item) => n + item.quantity, 0);
  const currencies = [...new Set(items.map(item => item.currency || 'PLN'))];
  const single = currencies.length === 1 ? currencies[0] : null;
  const subtotal = items.reduce((t, item) => t + Number(item.price) * item.quantity, 0);
  const delivery = items.reduce((t, item) => t + Number(item.shippingPrice || 0), 0);
  const inProgress = Object.keys(sessions).length > 0;
  const inCartKeys = new Set(items.map(cartKey));
  const ideas = suggestions.filter(l => !inCartKeys.has(cartKey(discoveryCartItem(l))));

  const remove = item => { tap(); LayoutAnimation.easeInEaseOut(); quantity(item, 0); };
  const clearAll = () => Alert.alert('Empty your cart?', 'Everything in it will be removed.', [
    { text: 'Keep', style: 'cancel' },
    { text: 'Empty cart', style: 'destructive', onPress: () => { LayoutAnimation.easeInEaseOut(); items.filter(i => !isPending(i)).forEach(i => quantity(i, 0)); } },
  ]);

  const Suggestions = ideas.length > 0 && (
    <View style={{ gap: 10 }}>
      <Text style={{ color: c.text, fontSize: 16, fontWeight: '800', paddingHorizontal: 16 }}>{items.length ? 'You might also like' : 'Popular right now'}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 16 }}>
        {ideas.map(l => {
          const photo = l.mediaUrls?.[0] || l.imageUrl;
          return (
            <View key={l.id} style={{ width: 148, borderRadius: 16, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, overflow: 'hidden' }}>
              <Pressable onPress={() => router.push({ pathname: '/listing/[id]', params: { id: l.id } })} accessibilityRole="button" accessibilityLabel={`View ${l.title}`}>
                {photo ? <Image source={{ uri: mediaUrl(photo) }} style={{ width: '100%', height: 120, backgroundColor: c.soft }} contentFit="cover" />
                  : <View style={{ height: 120, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center' }}><Feather name="image" size={22} color={c.muted} /></View>}
              </Pressable>
              <View style={{ padding: 10, gap: 6 }}>
                <Text numberOfLines={2} style={{ color: c.text, fontSize: 13, fontWeight: '600', lineHeight: 17, minHeight: 34 }}>{l.title}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ color: c.text, fontSize: 14, fontWeight: '800' }}>{money(l.price, l.currency)}</Text>
                  <Pressable onPress={() => { tap(); add(discoveryCartItem(l)); }} accessibilityRole="button" accessibilityLabel={`Add ${l.title} to cart`} hitSlop={6}
                    style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c.lime, alignItems: 'center', justifyContent: 'center' }}>
                    <Feather name="plus" size={16} color={c.onLime} />
                  </Pressable>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 8 }}>
        <BackButton />
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ color: c.text, fontSize: 20, fontWeight: '800' }}>Cart</Text>
          {count > 0 && <View style={{ paddingHorizontal: 9, height: 24, borderRadius: 12, backgroundColor: c.soft, justifyContent: 'center' }}><Text style={{ color: c.text, fontSize: 12, fontWeight: '800' }}>{count} item{count === 1 ? '' : 's'}</Text></View>}
        </View>
        {items.length > 0 && <Pressable onPress={clearAll} hitSlop={10} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: c.muted, fontSize: 13, fontWeight: '700' }}>Clear all</Text></Pressable>}
      </View>

      {!ready ? <ActivityIndicator color={c.purple} style={{ marginTop: 40 }} /> : !items.length ? (
        <ScrollView contentContainerStyle={{ paddingTop: 40, paddingBottom: 40 + insets.bottom, gap: 28 }}>
          <View style={{ alignItems: 'center', paddingHorizontal: 32, gap: 10 }}>
            <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: c.purpleSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
              <Feather name="shopping-bag" size={40} color={c.purple} />
            </View>
            <Text style={{ color: c.text, fontSize: 18, fontWeight: '800' }}>Your cart is empty</Text>
            <Text style={{ color: c.muted, fontSize: 14, textAlign: 'center', lineHeight: 20 }}>Add things from any seller and pay for them all at once.</Text>
            <Pressable onPress={() => router.push('/(tabs)/explore')} style={({ pressed }) => ({ marginTop: 10, height: 48, paddingHorizontal: 26, borderRadius: 24, backgroundColor: c.lime, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.85 : 1 })}>
              <Text style={{ color: c.onLime, fontWeight: '800', fontSize: 15 }}>Start shopping</Text>
            </Pressable>
          </View>
          {Suggestions}
        </ScrollView>
      ) : (
        <>
          <ScrollView contentContainerStyle={{ paddingTop: 4, gap: 16, paddingBottom: 130 + insets.bottom }} showsVerticalScrollIndicator={false}>
            <View style={{ marginHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, backgroundColor: c.purpleSoft }}>
              <Feather name="shield-check" size={18} color={c.purple} />
              <Text style={{ flex: 1, color: c.text, fontSize: 13 }}><Text style={{ fontWeight: '800' }}>Buyer protection.</Text> Sellers are paid only after you confirm your order arrived.</Text>
            </View>

            {inProgress && (
              <Pressable onPress={() => router.push('/checkout')} style={{ marginHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, backgroundColor: c.card, borderWidth: 1, borderColor: c.purple }}>
                <Feather name="clock" size={18} color={c.purple} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.text, fontWeight: '800', fontSize: 14 }}>Payment in progress</Text>
                  <Text style={{ color: c.muted, fontSize: 12 }}>Some items are held until you finish or cancel it.</Text>
                </View>
                <Text style={{ color: c.purple, fontWeight: '800', fontSize: 13 }}>Finish</Text>
              </Pressable>
            )}

            {sellers.map(group => (
              <View key={group.key} style={{ gap: 8, paddingHorizontal: 16 }}>
                <Pressable disabled={!group.route} onPress={() => router.push(group.route)} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 32 }}>
                  <Feather name={group.icon} size={15} color={c.muted} />
                  <Text style={{ color: c.text, fontWeight: '800', fontSize: 14, flex: 1 }} numberOfLines={1}>{group.name}</Text>
                  {!!group.route && <Text style={{ color: c.purple, fontSize: 12, fontWeight: '700' }}>Visit</Text>}
                </Pressable>
                {group.rows.map(item => {
                  const locked = isPending(item);
                  const max = item.stockQuantity != null ? item.stockQuantity : 99;
                  const photo = item.mediaUrls?.[0] || item.imageUrl;
                  const name = item.title || item.name;
                  return (
                    <View key={cartKey(item)} style={{ flexDirection: 'row', gap: 12, padding: 12, borderRadius: 18, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, opacity: locked ? 0.6 : 1,
                      shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 }}>
                      <Pressable onPress={() => item.kind !== 'product' && router.push({ pathname: '/listing/[id]', params: { id: item.id } })} accessibilityLabel={`View ${name}`}>
                        {photo ? <Image source={{ uri: mediaUrl(photo) }} style={{ width: 92, height: 92, borderRadius: 14, backgroundColor: c.soft }} contentFit="cover" />
                          : <View style={{ width: 92, height: 92, borderRadius: 14, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center' }}><Feather name="image" size={22} color={c.muted} /></View>}
                      </Pressable>
                      <View style={{ flex: 1, justifyContent: 'space-between' }}>
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                          <Text style={{ flex: 1, color: c.text, fontWeight: '700', fontSize: 14, lineHeight: 19 }} numberOfLines={2}>{name}</Text>
                          {!locked && <Pressable onPress={() => remove(item)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Remove ${name}`} style={{ width: 30, height: 30, alignItems: 'center', justifyContent: 'center', marginTop: -4, marginRight: -4 }}>
                            <Feather name="trash-2" size={16} color={c.muted} />
                          </Pressable>}
                        </View>
                        <Text style={{ color: c.muted, fontSize: 12 }} numberOfLines={1}>{Number(item.shippingPrice) > 0 ? `+ ${money(item.shippingPrice, item.currency)} delivery` : 'Free delivery'}{max < 99 ? ` · ${max} left` : ''}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                          <View>
                            <Text style={{ color: c.text, fontWeight: '900', fontSize: 16 }}>{money(Number(item.price) * item.quantity, item.currency)}</Text>
                            {item.quantity > 1 && <Text style={{ color: c.muted, fontSize: 11 }}>{money(item.price, item.currency)} each</Text>}
                          </View>
                          {locked ? <View style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: c.purpleSoft }}><Text style={{ color: c.purple, fontSize: 12, fontWeight: '700' }}>In checkout</Text></View>
                            : <Stepper value={item.quantity} max={max} label={name} c={c} onChange={v => quantity(item, v)} />}
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            ))}

            {single && (
              <View style={{ marginHorizontal: 16, padding: 16, borderRadius: 18, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, gap: 8 }}>
                <Text style={{ color: c.text, fontSize: 15, fontWeight: '800', marginBottom: 2 }}>Order summary</Text>
                <Row c={c} label={`Items (${count})`} value={money(subtotal, single)} />
                <Row c={c} label="Delivery" value={delivery ? money(delivery, single) : 'Free'} />
                <View style={{ height: 1, backgroundColor: c.line, marginVertical: 4 }} />
                <Row c={c} label="Total" value={money(subtotal + delivery, single)} strong />
              </View>
            )}
            {!single && <Text style={{ marginHorizontal: 16, color: c.muted, fontSize: 13 }}>Prices are in {currencies.join(' and ')}, so you pay once per currency at checkout.</Text>}

            {Suggestions}
            {!!storageError && <Text style={{ marginHorizontal: 16, color: c.danger, fontSize: 13 }}>{storageError}</Text>}
          </ScrollView>

          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingTop: 12, paddingBottom: insets.bottom + 12, backgroundColor: c.card, borderTopWidth: 1, borderTopColor: c.line }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.muted, fontSize: 12 }}>{single ? (delivery ? 'Total incl. delivery' : 'Total · free delivery') : 'Multiple currencies'}</Text>
              <Text style={{ color: c.text, fontSize: 20, fontWeight: '900' }} numberOfLines={1}>{single ? money(subtotal + delivery, single) : `${count} items`}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={`Checkout, ${count} items`} onPress={() => router.push('/checkout')}
              style={({ pressed }) => ({ height: 52, paddingHorizontal: 26, borderRadius: 26, backgroundColor: c.lime, flexDirection: 'row', alignItems: 'center', gap: 8, opacity: pressed ? 0.88 : 1 })}>
              <Feather name="lock" size={16} color={c.onLime} />
              <Text style={{ color: c.onLime, fontWeight: '800', fontSize: 16 }}>Checkout</Text>
            </Pressable>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

function Row({ c, label, value, strong }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={{ color: strong ? c.text : c.muted, fontSize: strong ? 16 : 14, fontWeight: strong ? '800' : '500' }}>{label}</Text>
      <Text style={{ color: c.text, fontSize: strong ? 16 : 14, fontWeight: strong ? '900' : '600' }}>{value}</Text>
    </View>
  );
}
