import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCart } from '../src/store/CartProvider';
import { cartKey, money } from '../src/utils/marketplace';
import { mediaUrl } from '../src/utils/media';
import { usePalette } from '../src/components/native/Kit';

/** Who an item is bought from — one group per shop, one per marketplace seller. */
const sellerOf = (item) => item.kind === 'product'
  ? { key: `shop:${item.shopId}`, name: item.shopName || 'Shop', icon: 'shopping-bag', route: item.sellerId ? { pathname: '/shop/[userId]', params: { userId: item.sellerId, shopId: item.shopId } } : null }
  : { key: `seller:${item.sellerId || 'market'}`, name: item.sellerName || item.seller?.fullName || 'Marketplace seller', icon: 'user', route: item.sellerId ? `/profile/${item.sellerId}` : null };
const tap = () => { try { Haptics.selectionAsync(); } catch { /* optional */ } };

/**
 * The bag: review what you picked, change quantities, remove things. Paying happens on the
 * separate checkout screen, so nothing here asks for details or money.
 */
export default function CartScreen() {
  const router = useRouter();
  const c = usePalette();
  const insets = useSafeAreaInsets();
  const { items, quantity, ready, sessions, isPending, storageError } = useCart();

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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10 }}>
        <TouchableOpacity accessibilityLabel="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
          style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: c.card, borderWidth: 1, borderColor: c.line }}>
          <Feather name="arrow-left" size={19} color={c.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.text, fontSize: 20, fontWeight: '900' }}>Your cart</Text>
          <Text style={{ color: c.muted, fontSize: 12 }}>{count ? `${count} item${count === 1 ? '' : 's'} from ${sellers.length} seller${sellers.length === 1 ? '' : 's'}` : 'Nothing added yet'}</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/profile/orders')} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, minHeight: 36, borderRadius: 18, backgroundColor: c.purpleSoft }}>
          <Feather name="package" size={14} color={c.purple} /><Text style={{ color: c.purple, fontWeight: '800', fontSize: 12 }}>Orders</Text>
        </TouchableOpacity>
      </View>

      {!ready ? <ActivityIndicator color={c.purple} style={{ marginTop: 40 }} /> : !items.length ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
          <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: c.purpleSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Feather name="shopping-bag" size={36} color={c.purple} />
          </View>
          <Text style={{ color: c.text, fontSize: 18, fontWeight: '800' }}>Your cart is empty</Text>
          <Text style={{ color: c.muted, textAlign: 'center', lineHeight: 20 }}>Tap the bag icon on any product, listing or shop item to save it here. You can buy from several sellers in one payment.</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/explore')} style={{ marginTop: 6, minHeight: 48, paddingHorizontal: 24, borderRadius: 24, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#111', fontWeight: '900' }}>Start exploring</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 230 + insets.bottom }}>
            {inProgress && (
              <Pressable onPress={() => router.push('/checkout')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, backgroundColor: c.purpleSoft, borderWidth: 1, borderColor: `${c.purple}55` }}>
                <Feather name="clock" size={18} color={c.purple} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.text, fontWeight: '800' }}>Payment in progress</Text>
                  <Text style={{ color: c.muted, fontSize: 12 }}>Some items are locked until you finish or cancel that payment.</Text>
                </View>
                <Text style={{ color: c.purple, fontWeight: '800' }}>Finish</Text>
              </Pressable>
            )}

            {sellers.map(group => (
              <View key={group.key} style={{ backgroundColor: c.card, borderRadius: 22, borderWidth: 1, borderColor: c.line, overflow: 'hidden' }}>
                <Pressable disabled={!group.route} onPress={() => router.push(group.route)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.line }}>
                  <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: c.purpleSoft, alignItems: 'center', justifyContent: 'center' }}><Feather name={group.icon} size={14} color={c.purple} /></View>
                  <Text style={{ color: c.text, fontWeight: '800', flex: 1 }} numberOfLines={1}>{group.name}</Text>
                  {group.route && <Feather name="chevron-right" size={16} color={c.muted} />}
                </Pressable>
                {group.rows.map((item, i) => {
                  const locked = isPending(item);
                  const max = item.stockQuantity != null ? item.stockQuantity : 99;
                  const photo = item.mediaUrls?.[0] || item.imageUrl;
                  return (
                    <View key={cartKey(item)} style={{ flexDirection: 'row', gap: 12, padding: 14, borderTopWidth: i ? 1 : 0, borderTopColor: c.line, opacity: locked ? 0.6 : 1 }}>
                      <Pressable onPress={() => item.kind !== 'product' && router.push({ pathname: '/listing/[id]', params: { id: item.id } })}>
                        {photo ? <Image source={{ uri: mediaUrl(photo) }} style={{ width: 84, height: 84, borderRadius: 16 }} contentFit="cover" />
                          : <View style={{ width: 84, height: 84, borderRadius: 16, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center' }}><Feather name="image" size={22} color={c.muted} /></View>}
                      </Pressable>
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text style={{ color: c.text, fontWeight: '700', fontSize: 14, lineHeight: 19 }} numberOfLines={2}>{item.title || item.name}</Text>
                        <Text style={{ color: c.text, fontWeight: '900', fontSize: 15 }}>{money(Number(item.price) * item.quantity, item.currency)}</Text>
                        <Text style={{ color: c.muted, fontSize: 11 }}>
                          {item.quantity > 1 ? `${money(item.price, item.currency)} each · ` : ''}{Number(item.shippingPrice) > 0 ? `+ ${money(item.shippingPrice, item.currency)} delivery` : 'Free delivery or pickup'}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 18, borderWidth: 1, borderColor: c.line }}>
                            <TouchableOpacity disabled={locked || item.quantity <= 1} onPress={() => { tap(); quantity(item, item.quantity - 1); }} accessibilityLabel={`One fewer ${item.title || item.name}`}
                              style={{ width: 34, height: 32, alignItems: 'center', justifyContent: 'center', opacity: item.quantity <= 1 ? 0.35 : 1 }}>
                              <Feather name="minus" size={15} color={c.text} />
                            </TouchableOpacity>
                            <Text style={{ color: c.text, fontWeight: '800', minWidth: 22, textAlign: 'center' }}>{item.quantity}</Text>
                            <TouchableOpacity disabled={locked || item.quantity >= max} onPress={() => { tap(); quantity(item, item.quantity + 1); }} accessibilityLabel={`One more ${item.title || item.name}`}
                              style={{ width: 34, height: 32, alignItems: 'center', justifyContent: 'center', opacity: item.quantity >= max ? 0.35 : 1 }}>
                              <Feather name="plus" size={15} color={c.text} />
                            </TouchableOpacity>
                          </View>
                          {locked ? <Text style={{ color: c.purple, fontSize: 11, fontWeight: '700' }}>In checkout</Text> : (
                            <TouchableOpacity onPress={() => { tap(); quantity(item, 0); }} hitSlop={8} accessibilityLabel={`Remove ${item.title || item.name}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <Feather name="trash-2" size={14} color={c.muted} /><Text style={{ color: c.muted, fontSize: 12, fontWeight: '600' }}>Remove</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                        {max < 99 && item.quantity >= max && <Text style={{ color: '#F59E0B', fontSize: 11 }}>Only {max} in stock</Text>}
                      </View>
                    </View>
                  );
                })}
              </View>
            ))}
            {!!storageError && <Text style={{ color: '#FF6B6B' }}>{storageError}</Text>}
          </ScrollView>

          {/* Summary + the one way forward */}
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 14, paddingBottom: insets.bottom + 12, backgroundColor: c.bg, borderTopWidth: 1, borderTopColor: c.line, gap: 6 }}>
            {currencies.length === 1 ? <>
              <Row c={c} label="Items" value={money(subtotal, currencies[0])} />
              <Row c={c} label="Delivery" value={delivery ? money(delivery, currencies[0]) : 'Free'} />
              <Row c={c} label="Total" value={money(subtotal + delivery, currencies[0])} strong />
            </> : <Text style={{ color: c.muted, fontSize: 12 }}>Your cart has prices in {currencies.join(' and ')} — you’ll pay once per currency.</Text>}
            <TouchableOpacity accessibilityRole="button" onPress={() => router.push('/checkout')}
              style={{ marginTop: 6, minHeight: 54, borderRadius: 27, backgroundColor: c.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Text style={{ color: '#111', fontWeight: '900', fontSize: 16 }}>Go to checkout</Text>
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Feather name="lock" size={11} color={c.muted} />
              <Text style={{ color: c.muted, fontSize: 11 }}>{sellers.length > 1 ? 'One secure Stripe payment for every seller' : 'Secure payment with Stripe'}</Text>
            </View>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

function Row({ c, label, value, strong }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={{ color: strong ? c.text : c.muted, fontWeight: strong ? '900' : '500', fontSize: strong ? 16 : 13 }}>{label}</Text>
      <Text style={{ color: strong ? c.text : c.text, fontWeight: strong ? '900' : '600', fontSize: strong ? 16 : 13 }}>{value}</Text>
    </View>
  );
}
