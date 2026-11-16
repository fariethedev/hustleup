import React, { useCallback } from 'react';
import { View } from 'react-native';
import { Check, Star } from 'lucide-react-native';
import { Screen, Section, Panel, Copy, Button, Notice, usePalette } from '../src/components/native/Kit';
import { useRemote } from '../src/hooks/useRemote';
import { subscriptionsApi } from '../src/api/client';
import { currentTier, membershipTiers } from '../src/utils/subscriptions';

export default function Plans() {
  const colors = usePalette();
  const { data, loading, error, reload } = useRemote(useCallback(async () => {
    const [catalog, subscription] = await Promise.all([subscriptionsApi.plans(), subscriptionsApi.my()]);
    for (const id of ['MONTHLY', 'ALL_ACCESS']) {
      const plan = catalog.data?.plans?.find(p => p.id === id);
      if (!plan || !Number.isFinite(Number(plan.price)) || !(Number(plan.months) > 0)) {
        throw new Error('The backend returned an incomplete membership price list. Check the subscription service version and its logs.');
      }
    }
    return { catalog: catalog.data, subscription: subscription.data };
  }, []));
  const current = data ? currentTier(data.subscription) : null;
  return <Screen back title="Membership">
    <Section title="Choose your plan" subtitle="Start free. Sell with Plus. Connect with All Access." />
    {!!error && <Notice message={error} onRetry={reload} />}
    {loading && !data && <Notice loading message="Loading plans…" />}
    {data && <>
      <Panel><Copy heading>Your plan: {membershipTiers.find(p => p.id === current)?.name}</Copy>
        {!!data.subscription.expiresAt && <Copy muted>{current === 'FREE' ? 'Previous membership ended: ' : 'Access until: '}{new Date(data.subscription.expiresAt).toLocaleDateString()}</Copy>}
        <Copy muted>Your existing HustleSpace membership is recognised when you sign in with the same account.</Copy>
        <Button secondary busy={loading} onPress={reload}>Refresh membership</Button>
      </Panel>
      {membershipTiers.map(tier => {
        const price = data.catalog.plans.find(p => p.id === tier.id);
        const active = current === tier.id;
        return <Panel key={tier.id} style={{ borderColor: active ? colors.accent : colors.line, gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Star size={20} color={colors.accent} /><Copy heading style={{ fontSize: 21 }}>{tier.name}</Copy>{active && <Copy style={{ marginLeft: 'auto', color: colors.accent }}>Current plan</Copy>}</View>
          <Copy heading style={{ fontSize: 30 }}>{Number(price?.price || 0).toLocaleString('pl-PL')} zł</Copy>
          <Copy muted>{price ? `Website price · ${price.months} month${Number(price.months) === 1 ? '' : 's'} of access · no automatic renewal` : 'No membership fee'}</Copy>
          {tier.features.map(feature => <View key={feature} style={{ flexDirection: 'row', gap: 10 }}><Check size={18} color={colors.accent} /><Copy style={{ flex: 1 }}>{feature}</Copy></View>)}
          {!!tier.excluded && <Copy muted>{tier.excluded}</Copy>}
        </Panel>;
      })}
      <Notice message="Purchases in the Android and iPhone app are not available yet. Apple and Google billing setup is pending. Existing memberships continue to work; refresh above to check your access. Native store prices will be confirmed when billing is enabled." />
      <Copy muted>Membership does not include the price of goods, tickets, shipping, or other purchases. Some website tools are still being transferred to the native app.</Copy>
    </>}
  </Screen>;
}
