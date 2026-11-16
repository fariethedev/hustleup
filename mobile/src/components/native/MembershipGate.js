import React, { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { subscriptionsApi } from '../../api/client';
import { useRemote } from '../../hooks/useRemote';
import { isAllAccessActive, isPremiumActive } from '../../utils/subscriptions';
import { Screen, Section, Button, Notice } from './Kit';

export default function MembershipGate({ children, allAccess = false, feature }) {
  const router = useRouter();
  const { data, loading, error, reload } = useRemote(useCallback(async () => (await subscriptionsApi.my()).data, []));
  if (loading || error || !(allAccess ? isAllAccessActive(data) : isPremiumActive(data))) return <Screen back title={feature}>
    <Section title={feature} subtitle={allAccess ? 'Included with All Access' : 'Included with Plus and All Access'} />
    {loading ? <Notice loading message="Checking membership…" /> : error ? <Notice message={error} onRetry={reload} /> : <><Notice message="Your current membership does not include this feature." /><Button onPress={() => router.push('/plans')}>View membership plans</Button><Button secondary onPress={reload}>Refresh access</Button></>}
  </Screen>;
  return children;
}
