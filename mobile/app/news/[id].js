import React, { useCallback } from 'react';
import { Image } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { newsApi } from '../../src/api/client';
import { useRemote } from '../../src/hooks/useRemote';
import { Button, Copy, Notice, Screen, Section } from '../../src/components/native/Kit';
import { openSource } from '../../src/components/native/Editorial';
import { mediaUrl } from '../../src/utils/media';

export default function Article() {
  const { id } = useLocalSearchParams();
  const fetcher = useCallback(async () => (await newsApi.one(id)).data, [id]);
  const { data, loading, error, reload } = useRemote(fetcher);
  return <Screen back title="Read story">{error ? <Notice message={error} onRetry={reload} /> : !data ? <Notice loading={loading} message="Loading story…" /> : <><Section eyebrow={data.category} title={data.title} subtitle={data.publisherName || data.sourceName} />{!!data.coverImageUrl && <Image source={{ uri: mediaUrl(data.coverImageUrl) }} style={{ width: '100%', aspectRatio: 1.5, borderRadius: 20 }} />}<Copy muted>{data.summary}</Copy><Copy selectable style={{ fontSize: 16, lineHeight: 29 }}>{data.body}</Copy>{!!data.sourceUrl && <Button secondary onPress={() => openSource(data.sourceUrl)}>Read original source →</Button>}</>}</Screen>;
}
