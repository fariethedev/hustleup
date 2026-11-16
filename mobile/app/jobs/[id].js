import React, { useCallback, useRef, useState } from 'react';
import { Alert, Platform, TextInput } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { jobsApi } from '../../src/api/client';
import { useRemote } from '../../src/hooks/useRemote';
import { Button, Copy, Notice, Panel, Screen, Section, k, usePalette } from '../../src/components/native/Kit';
import { openSource } from '../../src/components/native/Editorial';
import { errorMessage, money } from '../../src/utils/marketplace';

export default function Job() {
  const { id } = useLocalSearchParams();
  const c = usePalette();
  const fetcher = useCallback(async () => (await jobsApi.one(id)).data, [id]);
  const { data, loading, error, reload } = useRemote(fetcher);
  const [message, setMessage] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState(false);
  const [failure, setFailure] = useState('');
  const lock = useRef(false);
  const pick = async () => {
    try { const result = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'video/*'], copyToCacheDirectory: true }); if (!result.canceled) setAttachment(result.assets[0]); }
    catch { Alert.alert('Attachment unavailable', 'Please select the file again.'); }
  };
  const apply = async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setFailure('');
    try {
      const form = new FormData();
      if (message.trim()) form.append('message', message.trim());
      if (attachment) form.append('attachment', Platform.OS === 'web' ? attachment.file : { uri: attachment.uri, name: attachment.name, type: attachment.mimeType });
      await jobsApi.apply(id, form); setApplied(true); await reload();
    } catch (e) { setFailure(errorMessage(e, 'Your application could not be sent. Your message and attachment have been kept.')); }
    finally { lock.current = false; setBusy(false); }
  };
  return <Screen back title="Job details">{error ? <Notice message={error} onRetry={reload} /> : !data ? <Notice loading={loading} message="Loading role…" /> : <><Section eyebrow={data.companyName} title={data.title} subtitle={[data.location, data.remote ? 'Remote' : '', data.jobType?.replaceAll('_', ' ')].filter(Boolean).join(' · ')} />{(data.salaryMin != null || data.salaryMax != null) && <Copy heading>{money(data.salaryMin ?? data.salaryMax, data.salaryCurrency)}{data.salaryMax != null && data.salaryMin != null ? ' – ' + money(data.salaryMax, data.salaryCurrency) : ''} / {data.salaryPeriod?.toLowerCase()}</Copy>}<Copy selectable style={{ fontSize: 16, lineHeight: 28 }}>{data.description}</Copy>
    {data.sourceUrl ? <Button onPress={() => openSource(data.sourceUrl)}>Apply on {data.sourceName || 'source website'} →</Button> : applied || data.appliedByCurrentUser ? <Panel><Copy heading>Application sent</Copy><Copy muted>You can track this in My applications.</Copy></Panel> : data.ownedByCurrentUser ? <Notice message="This is your job advert." /> : <Panel><Copy heading>Make your introduction.</Copy><TextInput accessibilityLabel="Message to employer" value={message} onChangeText={setMessage} multiline placeholder="Why you’re a fit, and when you can start…" placeholderTextColor={c.muted} style={[k.input, { color: c.text, borderColor: c.line, minHeight: 130, paddingTop: 12, textAlignVertical: 'top' }]} /><Button secondary icon="paperclip" onPress={pick}>{attachment?.name || 'Attach portfolio image or video'}</Button><Copy muted style={{ fontSize: 11 }}>The current upload service accepts images and video, not PDF documents. You can include a CV link in your message.</Copy>{attachment && <Button secondary onPress={() => setAttachment(null)}>Remove attachment</Button>}{!!failure && <Copy style={{ color: '#D55656' }}>{failure}</Copy>}<Button busy={busy} onPress={apply}>Send application</Button></Panel>}</>}</Screen>;
}
