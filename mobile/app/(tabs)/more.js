import React, { useCallback, useState } from 'react';
import { Alert, Image, Pressable, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import Constants from 'expo-constants';
import { Screen } from '../../src/components/native/Kit';
import { Feather } from '../../src/components/native/Icon';
import { useAppTheme } from '../../src/theme/ThemeProvider';
import { useCart } from '../../src/store/CartProvider';
import { notificationsApi } from '../../src/api/client';
import { logoutUser } from '../../src/store/authSlice';
import { mediaUrl } from '../../src/utils/media';

const EXPLORE = [
  ['briefcase', 'Jobs & gigs', 'Shifts and roles nearby', '/jobs', '#0284C7'],
  ['heart', 'Hustle Bond', 'Meet new people', '/bond', '#DB2777'],
  ['repeat', 'Swaps', 'Trade what you have', '/swaps', '#16A34A'],
  ['newspaper', 'News', 'What is happening locally', '/news', '#EA580C'],
  ['trophy', 'Rankings', 'Top people this month', '/leaderboard', '#D97706'],
  ['ticket', 'My tickets', 'Events you are going to', '/tickets', '#7D39EB'],
];

function SectionTitle({ children }) {
  const { palette: c } = useAppTheme();
  return <Text style={{ color: c.muted, fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', marginLeft: 4, marginTop: 6 }}>{children}</Text>;
}

/** Square shortcut with a tinted icon and an optional count badge. */
function Shortcut({ icon, label, tint, count, onPress }) {
  const { palette: c } = useAppTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={count ? `${label}, ${count}` : label}
      style={({ pressed }) => ({ flex: 1, alignItems: 'center', gap: 8, paddingVertical: 14, borderRadius: 18, backgroundColor: pressed ? c.soft : c.card, borderWidth: 1, borderColor: c.line })}>
      <View>
        <View style={{ width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: tint + '1F' }}>
          <Feather name={icon} size={20} color={tint} />
        </View>
        {!!count && <View style={{ position: 'absolute', top: -6, right: -8, minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, backgroundColor: c.lime, borderWidth: 2, borderColor: c.card, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: c.onLime, fontSize: 10, fontWeight: '900' }}>{count > 99 ? '99+' : count}</Text>
        </View>}
      </View>
      <Text numberOfLines={1} style={{ color: c.text, fontSize: 12.5, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

/** A full-width row inside a card: icon tile, label and a hint. */
function Item({ icon, label, hint, tint, onPress, danger, last }) {
  const { palette: c } = useAppTheme();
  const color = danger ? c.danger : tint || c.purple;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={hint ? `${label}. ${hint}` : label}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, minHeight: 64, backgroundColor: pressed ? c.soft : 'transparent' })}>
      <View style={{ width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: color + '1A' }}>
        <Feather name={icon} size={18} color={color} />
      </View>
      <View style={{ flex: 1, alignSelf: 'stretch', justifyContent: 'center', borderBottomWidth: last ? 0 : 1, borderBottomColor: c.line }}>
        <Text style={{ color: danger ? c.danger : c.text, fontSize: 15, fontWeight: '700' }}>{label}</Text>
        {!!hint && <Text style={{ color: c.muted, fontSize: 12.5 }} numberOfLines={1}>{hint}</Text>}
      </View>
    </Pressable>
  );
}

function Card({ children }) {
  const { palette: c } = useAppTheme();
  return <View style={{ borderRadius: 20, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, overflow: 'hidden' }}>{children}</View>;
}

export default function MoreScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const user = useSelector(s => s.auth.user);
  const { palette: c, preference, setTheme } = useAppTheme();
  const cart = useCart();
  const [unread, setUnread] = useState(0);
  const go = route => router.push(route);
  const need = route => go(user ? route : '/login');
  const cartCount = (cart.items || []).reduce((n, i) => n + (i.quantity || 1), 0);

  useFocusEffect(useCallback(() => {
    if (!user) return undefined;
    let alive = true;
    notificationsApi.unreadCount().then(({ data }) => { if (alive) setUnread(Number(data?.count ?? data?.unreadCount ?? data) || 0); }).catch(() => {});
    return () => { alive = false; };
  }, [user]));

  const signOut = () => Alert.alert('Sign out?', 'You can sign back in any time.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Sign out', style: 'destructive', onPress: async () => { await dispatch(logoutUser()); router.replace('/login'); } },
  ]);
  const avatar = mediaUrl(user?.avatarUrl);
  const name = user?.fullName || user?.username || 'Your account';

  return <Screen title="More">
    <Text accessibilityRole="header" style={{ color: c.text, fontSize: 24, fontWeight: '800' }}>More</Text>

    {/* Who you are */}
    {user ? (
      <Pressable onPress={() => go('/profile')} accessibilityRole="button" accessibilityLabel={`${name}. View your profile`}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 22, backgroundColor: pressed ? c.soft : c.card, borderWidth: 1, borderColor: c.line })}>
        <View style={{ width: 58, height: 58, borderRadius: 29, overflow: 'hidden', backgroundColor: c.purpleSoft, alignItems: 'center', justifyContent: 'center' }}>
          {avatar ? <Image source={{ uri: avatar }} style={{ width: '100%', height: '100%' }} /> : <Text style={{ color: c.purple, fontSize: 22, fontWeight: '900' }}>{name[0].toUpperCase()}</Text>}
        </View>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ color: c.text, fontSize: 17, fontWeight: '800' }}>{name}</Text>
          <Text numberOfLines={1} style={{ color: c.muted, fontSize: 13 }}>@{user.username || user.email?.split('@')[0]}</Text>
        </View>
        <View style={{ paddingHorizontal: 12, height: 34, borderRadius: 17, backgroundColor: c.soft, justifyContent: 'center' }}>
          <Text style={{ color: c.text, fontSize: 13, fontWeight: '700' }}>View profile</Text>
        </View>
      </Pressable>
    ) : (
      <View style={{ padding: 18, borderRadius: 22, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, gap: 12 }}>
        <Text style={{ color: c.text, fontSize: 18, fontWeight: '800' }}>Join HustleSpace</Text>
        <Text style={{ color: c.muted, fontSize: 14, lineHeight: 20 }}>Sign in to buy, sell, book and chat with people near you.</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable onPress={() => go('/login')} style={({ pressed }) => ({ flex: 1, height: 46, borderRadius: 23, backgroundColor: c.lime, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.85 : 1 })}><Text style={{ color: c.onLime, fontWeight: '800', fontSize: 15 }}>Sign in</Text></Pressable>
          <Pressable onPress={() => go('/register')} style={({ pressed }) => ({ flex: 1, height: 46, borderRadius: 23, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.85 : 1 })}><Text style={{ color: c.text, fontWeight: '700', fontSize: 15 }}>Create account</Text></Pressable>
        </View>
      </View>
    )}

    {/* Everyday shortcuts */}
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <Shortcut icon="package" label="Orders" tint="#0284C7" onPress={() => need('/profile/orders')} />
      <Shortcut icon="shopping-bag" label="Cart" tint="#16A34A" count={cartCount} onPress={() => go('/cart')} />
      <Shortcut icon="bell" label="Alerts" tint="#D97706" count={unread} onPress={() => need('/notifications')} />
      <Shortcut icon="wallet" label="Wallet" tint="#7D39EB" onPress={() => need('/profile/wallet')} />
    </View>

    {/* Selling */}
    <SectionTitle>Sell on HustleSpace</SectionTitle>
    <Card>
      <Item icon="store" label="Manage my shop" hint="Products, services and appointments" tint="#7D39EB" onPress={() => need('/shop/manage')} />
      <Item icon="chart-column" label="Seller dashboard" hint="Sales, earnings and listings" tint="#16A34A" onPress={() => need('/dashboard')} />
      <Item icon="landmark" label="Payouts" hint="Bank account and transfers" tint="#0284C7" onPress={() => need('/profile/bank')} last />
    </Card>

    {/* Discover */}
    <SectionTitle>Discover</SectionTitle>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {EXPLORE.map(([icon, label, hint, route, tint]) => (
        <Pressable key={route} onPress={() => (route === '/tickets' ? need(route) : go(route))} accessibilityRole="button" accessibilityLabel={`${label}. ${hint}`}
          style={({ pressed }) => ({ flexBasis: '47%', flexGrow: 1, padding: 14, gap: 10, borderRadius: 18, backgroundColor: pressed ? c.soft : c.card, borderWidth: 1, borderColor: c.line })}>
          <View style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: tint + '1F' }}>
            <Feather name={icon} size={19} color={tint} />
          </View>
          <View>
            <Text style={{ color: c.text, fontSize: 15, fontWeight: '800' }}>{label}</Text>
            <Text numberOfLines={1} style={{ color: c.muted, fontSize: 12 }}>{hint}</Text>
          </View>
        </Pressable>
      ))}
    </View>

    {/* Appearance: one compact switch */}
    <SectionTitle>Appearance</SectionTitle>
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', padding: 4, borderRadius: 16, backgroundColor: c.soft }}>
      {[['light', 'Light', 'sun'], ['dark', 'Dark', 'moon'], ['system', 'Auto', 'smartphone']].map(([value, label, icon]) => {
        const on = preference === value;
        return (
          <Pressable key={value} onPress={() => setTheme(value)} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={value === 'system' ? 'Follow phone setting' : label}
            style={{ flex: 1, height: 44, borderRadius: 12, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? c.card : 'transparent' }}>
            <Feather name={icon} size={15} color={on ? c.text : c.muted} />
            <Text style={{ color: on ? c.text : c.muted, fontSize: 13, fontWeight: '700' }}>{label}</Text>
          </Pressable>
        );
      })}
    </View>

    {/* Help and account */}
    <SectionTitle>Help & account</SectionTitle>
    <Card>
      <Item icon="settings" label="Settings" hint="Privacy, notifications and account" tint="#596155" onPress={() => go('/profile/settings')} last={!user} />
      {!!user && <Item icon="log-out" label="Sign out" danger onPress={signOut} last />}
    </Card>
    <Text style={{ color: c.muted, fontSize: 12, textAlign: 'center', marginTop: 4 }}>HustleSpace {Constants.expoConfig?.version || ''}</Text>
  </Screen>;
}
