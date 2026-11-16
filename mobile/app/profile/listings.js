import React, { useState } from 'react';
import { RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { listingsApi } from '../../src/api/client';
import { useRemote } from '../../src/hooks/useRemote';
import { Button, Copy, Notice, Panel, Screen, Section, usePalette } from '../../src/components/native/Kit';
import CreateListingModal from '../../src/components/listings/CreateListingModal';
import { money } from '../../src/utils/marketplace';

const fetchListings = async () => (await listingsApi.getMyListings()).data;
export default function MyListings() {
  const router = useRouter();
  const c = usePalette();
  const [creating, setCreating] = useState(false);
  const { data, loading, error, reload } = useRemote(fetchListings);
  return <Screen back title="My listings" refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={c.accent} />}><Section title="Made by you." subtitle="Your marketplace products, services and events." /><Button icon="plus" onPress={() => setCreating(true)}>Add listing</Button>{!!error && <Notice message={error} onRetry={reload} />}{(data || []).map(item => <Panel key={item.id}><Copy heading>{item.title}</Copy><Copy muted>{item.status} · {money(item.price, item.currency)}</Copy><Button secondary onPress={() => router.push('/listing/' + item.id)}>View listing</Button>{item.listingType === 'EVENT' && <Button secondary onPress={() => router.push('/events/' + item.id + '/door')}>Guest list & scanner</Button>}</Panel>)}{!data?.length && <Notice loading={loading} message={loading ? 'Loading your listings…' : 'Your listings will appear here once you publish them.'} />}<CreateListingModal visible={creating} onClose={() => setCreating(false)} onCreated={reload} /></Screen>;
}
