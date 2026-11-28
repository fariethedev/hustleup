import React, { useState } from 'react';
import { ActivityIndicator, Alert, LayoutAnimation, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Feather } from '../src/components/native/Icon';
import * as Haptics from 'expo-haptics';
import { useCart } from '../src/store/CartProvider';
import { cartKey, money } from '../src/utils/marketplace';
import { mediaUrl } from '../src/utils/media';
import { usePalette, BackButton } from '../src/components/native/Kit';

/** Who an item is bought from: one group per shop, one per marketplace seller. */
const sellerOf = (item) => item.kind === 'product'
  ? { key: `shop:${item.shopId}`, name: item.shopName || 'Shop', icon: 'store', route: item.sellerId ? { pathname: '/shop/[userId]', params: { userId: item.sellerId, shopId: item.shopId } } : null }
  : { key: `seller:${item.sellerId || 'market'}`, name: item.sellerName || item.seller?.fullName || 'Marketplace seller', icon: 'user', route: item.sellerId ? `/profile/${item.sellerId}` : null };
const tap = () => { try { Haptics.selectionAsync(); } catch { /* optional */ } };

/**
 * The cart: what you picked, grouped by seller, with quantities and a running total.
 * Paying happens on the checkout screen, so nothing here asks for details or money.
 */
export default function CartScreen() {
  const router = useRouter();
  const c = usePalette();
  const insets = useSafeAreaInsets();
  const { items, quantity, ready, sessions, isPending, storageError } = useCart();
  const [details, setDetails] = useState(false);

  const sellers = [];
  items.forEach(item => {
    const seller = sellerOf(item);
    let group = sellers.find(g => g.key === seller.key);
    if (!group) { group = { ...seller, rows: [] }; sellers.push(group); }
    group.rows.push(item);
  });
  const count = items.reduce((n, item) => n + item.quantity, 0);
  const currencies = [...new Set(items.map(item => item.currency || 'PLN'))];
  const subtotal = items.reduce((t, item) => t + Number(item.price) * item.quantity, 0);
  const delivery = items.reduce((t, item) => t + Number(item.shippingPrice || 0), 0);
  const inProgress = Object.keys(sessions).length > 0;
  const single = currencies.length === 1 ? currencies[0] : null;

  const clearAll = () => Alert.alert('Empty your cart?', 'Everything in it will be removed.', [
    { text: 'Keep', style: 'cancel' },
    { text: 'Empty cart', style: 'destructive', onPress: () => { LayoutAnimation.easeInEaseOut(); items.filter(i => !isPending(i)).forEach(i => quantity(i, 0)); } },
  ]);
  const remove = item => { tap(); LayoutAnimation.easeInEaseOut(); quantity(item, 0); };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 8 }}>
        <BackButton />
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.text, fontSize: 20, fontWeight: '800' }}>Cart</Text>
          <Text style={{ color: c.muted, fontSize: 12 }}>{count ? `${count} item${count === 1 ? '' : 's'} · ${sellers.length} seller${sellers.length === 1 ? '' : 's'}` : 'Nothing added yet'}</Text>
        </View>
        {items.length > 0 && <Pressable onPress={clearAll} hitSlop={8} accessibilityRole="button"><Text style={{ color: c.muted, fontSize: 13, fontWeight: '700' }}>Clear</Text></Pressable>}
      </View>

      {!ready ? <ActivityIndicator color={c.accent} style={{ marginTop: 40 }} /> : !items.length ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 }}>
          <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: c.purpleSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
            <Feather name="shopping-bag" size={40} color={c.purple} />
          </View>
          <Text style={{ color: c.text, fontSize: 18, fontWeight: '800' }}>Your cart is empty</Text>
          <Text style={{ color: c.muted, fontSize: 14, textAlign: 'center', lineHeight: 20 }}>Add things from any seller and pay for them all at once.</Text>
          <Pressable onPress={() => router.push('/(tabs)/explore')} style={({ pressed }) => ({ marginTop: 10, height: 48, paddingHorizontal: 26, borderRadius: 24, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.85 : 1 })}>
            <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 15 }}>Start shopping</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/profile/orders')} hitSlop={8} style={{ marginTop: 6 }}>
            <Text style={{ color: c.purple, fontWeight: '700', fontSize: 14 }}>View your orders</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 6, gap: 14, paddingBottom: 170 + insets.bottom }} showsVerticalScrollIndicator={false}>
            {inProgress && (
              <Pressable onPress={() => router.push('/checkout')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, backgroundColor: c.purpleSoft }}>
                <Feather name="clock" size={18} color={c.purple} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.text, fontWeight: '800', fontSize: 14 }}>Payment in progress</Text>
                  <Text style={{ color: c.muted, fontSize: 12 }}>Some items are held until you finish or cancel it.</Text>
                </View>
                <Text style={{ color: c.purple, fontWeight: '800', fontSize: 13 }}>Finish</Text>
              </Pressable>
            )}

            {sellers.map(group => {
              const groupTotal = group.rows.reduce((t, i) => t + Number(i.price) * i.quantity + Number(i.shippingPrice || 0), 0);
              return (
                <View key={group.key} style={{ backgroundColor: c.card, borderRadius: 20, borderWidth: 1, borderColor: c.line, overflow: 'hidden' }}>
                  <Pressable disabled={!group.route} onPress={() => router.push(group.route)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4 }}>
                    <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: c.purpleSoft, alignItems: 'center', justifyContent: 'center' }}><Feather name={group.icon} size={14} color={c.purple} /></View>
                    <Text style={{ color: c.text, fontWeight: '800', fontSize: 14, flex: 1 }} numberOfLines={1}>{group.name}</Text>
                    {single && <Text style={{ color: c.muted, fontSize: 12, fontWeight: '600' }}>{money(groupTotal, single)}</Text>}
                  </Pressable>

                  {group.rows.map(item => {
                    const locked = isPending(item);
                    const max = item.stockQuantity != null ? item.stockQuantity : 99;
                    const photo = item.mediaUrls?.[0] || item.imageUrl;
                    const name = item.title || item.name;
                    return (
                      <View key={cartKey(item)} style={{ flexDirection: 'row', gap: 12, padding: 14, opacity: locked ? 0.6 : 1 }}>
                        <Pressable onPress={() => item.kind !== 'product' && router.push({ pathname: '/listing/[id]', params: { id: item.id } })}>
                          {photo ? <Image source={{ uri: mediaUrl(photo) }} style={{ width: 80, height: 80, borderRadius: 14, backgroundColor: c.soft }} contentFit="cover" />
                            : <View style={{ width: 80, height: 80, borderRadius: 14, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center' }}><Feather name="image" size={22} color={c.muted} /></View>}
                        </Pressable>
                        <View style={{ flex: 1, justifyContent: 'space-between' }}>
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            <View style={{ flex: 1, gap: 2 }}>
                              <Text style={{ color: c.text, fontWeight: '700', fontSize: 14, lineHeight: 19 }} numberOfLines={2}>{name}</Text>
                              <Text style={{ color: c.muted, fontSize: 12 }} numberOfLines={1}>
                                {money(item.price, item.currency)}{item.quantity > 1 ? ' each' : ''} · {Number(item.shippingPrice) > 0 ? `${money(item.shippingPrice, item.currency)} delivery` : 'Free delivery'}
                              </Text>
                            </View>
                            {!locked && <Pressable onPress={() => remove(item)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Remove ${name}`}
                              style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: c.soft }}>
                              <Feather name="x" size={14} color={c.muted} />
                            </Pressable>}
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                            {locked ? <View style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: c.purpleSoft }}><Text style={{ color: c.purple, fontSize: 12, fontWeight: '700' }}>In checkout</Text></View> : (
                              <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 16, backgroundColor: c.soft }}>
                                <Pressable disabled={item.quantity <= 1} onPress={() => { tap(); quantity(item, item.quantity - 1); }} accessibilityLabel={`One fewer ${name}`} hitSlop={4}
                                  style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center', opacity: item.quantity <= 1 ? 0.35 : 1 }}>
                                  <Feather name="minus" size={14} color={c.text} />
                                </Pressable>
                                <Text style={{ color: c.text, fontWeight: '800', fontSize: 14, minWidth: 20, textAlign: 'center' }}>{item.quantity}</Text>
                                <Pressable disabled={item.quantity >= max} onPress={() => { tap(); quantity(item, item.quantity + 1); }} accessibilityLabel={`One more ${name}`} hitSlop={4}
                                  style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center', opacity: item.quantity >= max ? 0.35 : 1 }}>
                                  <Feather name="plus" size={14} color={c.text} />
                                </Pressable>
                              </View>
                            )}
                            <Text style={{ color: c.text, fontWeight: '800', fontSize: 15 }}>{money(Number(item.price) * item.quantity, item.currency)}</Text>
                          </View>
                          {max < 99 && item.quantity >= max && <Text style={{ color: '#B45309', fontSize: 12, marginTop: 4 }}>Only {max} in stock</Text>}
                        </View>
                      </View>
                    );
                  })}
                </View>
              );
            })}

            <View style={{ flexDirection: 'row', gap: 10 }}>
              {[['shield', 'Buyer protection', 'Paid out only when you confirm'], ['lock', 'Secure payment', sellers.length > 1 ? 'One payment for every seller' : 'Processed by Stripe']].map(([icon, title, body]) => (
                <View key={title} style={{ flex: 1, flexDirection: 'row', gap: 8, padding: 12, borderRadius: 14, backgroundColor: c.card, borderWidth: 1, borderColor: c.line }}>
                  <Feather name={icon} size={16} color={c.purple} />
                  <View style={{ flex: 1 }}><Text style={{ color: c.text, fontSize: 12, fontWeight: '800' }}>{title}</Text><Text style={{ color: c.muted, fontSize: 12 }}>{body}</Text></View>
                </View>
              ))}
            </View>
            <Pressable onPress={() => router.push('/(tabs)/explore')} style={{ alignSelf: 'center', paddingVertical: 6 }} hitSlop={8}>
              <Text style={{ color: c.purple, fontWeight: '700', fontSize: 14 }}>Continue shopping</Text>
            </Pressable>
            {!!storageError && <Text style={{ color: c.danger, fontSize: 13 }}>{storageError}</Text>}
          </ScrollView>

          {/* Summary bar */}
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, paddingBottom: insets.bottom + 12, backgroundColor: c.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
            shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: -4 }, elevation: 12, gap: 10 }}>
            {single ? (
              <Pressable onPress={() => { LayoutAnimation.easeInEaseOut(); setDetails(v => !v); }} accessibilityRole="button" accessibilityLabel="Show price breakdown" style={{ gap: 6 }}>
                {details && <>
                  <Row c={c} label={`Items (${count})`} value={money(subtotal, single)} />
                  <Row c={c} label="Delivery" value={delivery ? money(delivery, single) : 'Free'} />
                </>}
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ color: c.text, fontSize: 15, fontWeight: '700', flex: 1 }}>Total <Text style={{ color: c.muted, fontSize: 12, fontWeight: '500' }}>{details ? 'Hide details' : delivery ? 'incl. delivery' : 'Free delivery'}</Text></Text>
                  <Text style={{ color: c.text, fontSize: 20, fontWeight: '900' }}>{money(subtotal + delivery, single)}</Text>
                </View>
              </Pressable>
            ) : <Text style={{ color: c.muted, fontSize: 13 }}>Prices are in {currencies.join(' and ')}, so you pay once per currency.</Text>}
            <Pressable accessibilityRole="button" onPress={() => router.push('/checkout')}
              style={({ pressed }) => ({ height: 54, borderRadius: 27, backgroundColor: c.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: pressed ? 0.88 : 1 })}>
              <Feather name="lock" size={16} color="#FFF" />
              <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 16 }}>Checkout{count ? ` · ${count} item${count === 1 ? '' : 's'}` : ''}</Text>
            </Pressable>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

function Row({ c, label, value }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={{ color: c.muted, fontSize: 13 }}>{label}</Text>
      <Text style={{ color: c.text, fontWeight: '600', fontSize: 13 }}>{value}</Text>
    </View>
  );
}
