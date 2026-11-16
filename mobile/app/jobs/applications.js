import React from 'react';
import { RefreshControl } from 'react-native';
import { jobsApi } from '../../src/api/client';
import { useRemote } from '../../src/hooks/useRemote';
import { Copy, Notice, Panel, Screen, Section, usePalette } from '../../src/components/native/Kit';
const fetchApplications = async () => (await jobsApi.myApplications()).data;
export default function Applications() {
  const c = usePalette();
  const { data, loading, error, reload } = useRemote(fetchApplications);
  return <Screen back title="My applications" refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={c.accent} />}><Section title="Your next chapter." subtitle="Applications you have sent to employers on HustleSpace." />{!!error && <Notice message={error} onRetry={reload} />}{(data || []).map(item => <Panel key={item.id}><Copy heading>{item.jobTitle}</Copy><Copy muted>{item.companyName}</Copy><Copy style={{ color: c.accent }}>{item.status?.replaceAll('_', ' ')}</Copy><Copy>{item.message}</Copy></Panel>)}{!data?.length && <Notice loading={loading} message={loading ? 'Loading applications…' : 'No applications yet.'} />}</Screen>;
}
