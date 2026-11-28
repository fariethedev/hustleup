import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, Text } from 'react-native';
import { Feather } from './Icon';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCart } from '../../store/CartProvider';
import { PURPLE, LIME } from './Kit';

/**
 * A purple cart button that floats over store and product pages while you shop, with a live
 * item count. It pops briefly whenever something is added so the add feels confirmed.
 */
export default function FloatingCart({ bottom = 96 }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { items } = useCart();
  const count = items.reduce((n, item) => n + (item.quantity || 1), 0);
  const [scale] = React.useState(() => new Animated.Value(1));
  const last = useRef(count);

  useEffect(() => {
    if (count > last.current) {
      Animated.sequence([
        Animated.spring(scale, { toValue: 1.18, useNativeDriver: true, speed: 40 }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20 }),
      ]).start();
    }
    last.current = count;
  }, [count, scale]);

  return (
    <Animated.View pointerEvents="box-none" style={{ position: 'absolute', right: 18, bottom: bottom + insets.bottom, transform: [{ scale }] }}>
      <Pressable accessibilityRole="button" accessibilityLabel={count ? `Cart, ${count} items` : 'Cart'} onPress={() => router.push('/cart')}
        style={({ pressed }) => ({ width: 58, height: 58, borderRadius: 29, backgroundColor: PURPLE, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.85 : 1,
          shadowColor: PURPLE, shadowOpacity: 0.5, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 10 })}>
        <Feather name="shopping-bag" size={24} color="#FFF" />
        {count > 0 && (
          <Animated.View style={{ position: 'absolute', top: -2, right: -2, minWidth: 22, height: 22, paddingHorizontal: 5, borderRadius: 11, backgroundColor: LIME, borderWidth: 2, borderColor: PURPLE, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#111', fontSize: 11, fontWeight: '900' }}>{count > 99 ? '99+' : count}</Text>
          </Animated.View>
        )}
      </Pressable>
    </Animated.View>
  );
}
