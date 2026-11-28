import React, { useCallback, useState } from 'react';
import { Alert, Image, Pressable, RefreshControl, View } from 'react-native';
import { Feather } from '../../src/components/native/Icon';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { payoutsApi } from '../../src/api/client';
import { useRemote } from '../../src/hooks/useRemote';
import { Copy, fonts, LIME, Notice, Screen, usePalette } from '../../src/components/native/Kit';
import { Group, Row } from '../../src/components/native/GroupedList';
import { money } from '../../src/utils/marketplace';
import { stripeUrl } from '../../src/utils/secureLinks';
import { mediaUrl } from '../../src/utils/media';

const day = iso => iso ? new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short' }) : '';
const sum = (totals, key) => totals.length ? totals.map(t => money(t[key], t.currency)).join(' · ') : money(0, 'PLN');

/** One sale: photo, name, when the money moves, and what the seller receives. */
function Sale({ item, onPress }) {
  const c = usePalette();
  const onTheWay = item.state === 'ON_THE_WAY';
  const when = !onTheWay ? `Sent to Stripe ${day(item.releasedAt)}`
    : item.buyerConfirmed ? 'Buyer confirmed — releasing now'
    : item.releaseAt ? `Releases by ${day(item.releaseAt)}`
    : 'Releases after delivery';
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, backgroundColor: pressed ? c.soft : 'transparent' })}>
      {item.image
        ? <Image source={{ uri: mediaUrl(item.image) }} style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: c.soft }} />
        : <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center' }}><Feather name="package" size={18} color={c.muted} /></View>}
      <View style={{ flex: 1, gap: 2 }}>
        <Copy style={{ fontFamily: fonts.medium, fontSize: 13.5 }} numberOfLines={1}>{item.title}</Copy>
        <Copy style={{ fontSize: 11.5, color: onTheWay ? (item.buyerConfirmed ? c.accent : '#F59E0B') : c.muted }}>{when}</Copy>
      </View>
      <Copy style={{ fontFamily: fonts.medium, fontSize: 14, color: onTheWay ? c.text : c.accent }}>{onTheWay ? '' : '+'}{money(item.net, item.currency)}</Copy>
    </Pressable>
  );
}

export default function EarningsScreen() {
  const router = useRouter();
  const c = usePalette();
  const [opening, setOpening] = useState(false);
  const fetcher = useCallback(() => payoutsApi.earnings().then(r => r.data), []);
  const { data, loading, error, reload } = useRemote(fetcher);

  const totals = data?.totals || [];
  const items = data?.items || [];
  const onTheWay = items.filter(i => i.state === 'ON_THE_WAY');
  const released = items.filter(i => i.state === 'RELEASED');
  const openOrder = () => router.push({ pathname: '/profile/orders', params: { view: 'selling' } });

  const openStripe = async () => {
    setOpening(true);
    try {
      const { data: d } = await payoutsApi.dashboard();
      if (d?.url) await WebBrowser.openBrowserAsync(stripeUrl(d.url));
    } catch {
      Alert.alert('Could not open Stripe', 'Please try again in a moment.');
    } finally { setOpening(false); }
  };

  return (
    <Screen back title="Earnings" refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={c.purple} />}>
      <LinearGradient colors={['#241446', '#0B0B0D']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 26, padding: 20, gap: 16, borderWidth: 1, borderColor: '#FFFFFF14' }}>
        <View style={{ gap: 2 }}>
          <Copy style={{ color: '#A1A1AA', fontSize: 11, letterSpacing: 1, fontFamily: fonts.medium }}>ON ITS WAY TO YOU</Copy>
          <Copy heading style={{ color: LIME, fontSize: 32 }} numberOfLines={1} adjustsFontSizeToFit>{sum(totals, 'onTheWay')}</Copy>
          <Copy style={{ color: '#D4D4D8', fontSize: 12 }}>Paid by buyers and held safely until they confirm receipt.</Copy>
        </View>
        <View style={{ height: 1, backgroundColor: '#FFFFFF1F' }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <Copy style={{ color: '#A1A1AA', fontSize: 11, letterSpacing: 1, fontFamily: fonts.medium }}>RELEASED SO FAR</Copy>
            <Copy heading style={{ color: '#FFFFFF', fontSize: 18 }}>{sum(totals, 'released')}</Copy>
          </View>
          {data?.payoutsEnabled && (
            <Pressable accessibilityRole="button" onPress={openStripe} disabled={opening} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 38, borderRadius: 19, backgroundColor: '#FFFFFF1A', opacity: opening ? 0.6 : 1 }}>
              <Feather name="external-link" size={14} color="#FFF" />
              <Copy style={{ color: '#FFF', fontSize: 12.5, fontFamily: fonts.medium }}>Stripe balance</Copy>
            </Pressable>
          )}
        </View>
      </LinearGradient>

      {error && <Notice message={error} onRetry={reload} />}

      {data && !data.payoutsEnabled && (
        <Group>
          <Row icon="alert-circle" tone="warn" label="Connect your bank to get paid" subtitle="Payouts wait until your Stripe account is set up — nothing is lost in the meantime." onPress={() => router.push('/profile/bank')} />
        </Group>
      )}

      <Group title="How payouts work" footer={data ? `HustleSpace keeps ${Number(data.platformFeePercent || 0)}% of the item price; delivery costs are passed to you in full.` : undefined}>
        <Row icon="credit-card" label="1. The buyer pays" subtitle="The money is held by HustleSpace, protecting both of you." chevron={false} />
        <Row icon="truck" tone="purple" label="2. You send it" subtitle="Update the delivery status so the buyer can follow it." chevron={false} />
        <Row icon="check-circle" label="3. You get paid" subtitle={`Released to your Stripe account when the buyer confirms receipt, or ${data?.holdDays || 7} days after delivery.`} chevron={false} />
      </Group>

      {onTheWay.length > 0 && (
        <Group title={`On its way · ${onTheWay.length}`}>
          {onTheWay.map(i => <Sale key={i.kind + i.id} item={i} onPress={openOrder} />)}
        </Group>
      )}

      {released.length > 0 && (
        <Group title="Released">
          {released.map(i => <Sale key={i.kind + i.id} item={i} onPress={openOrder} />)}
        </Group>
      )}

      {data && items.length === 0 && (
        <Notice message="No sales yet. When a buyer pays for one of your listings, it appears here with the date the money is released." />
      )}
    </Screen>
  );
}
