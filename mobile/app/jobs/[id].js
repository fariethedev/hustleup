import React, { useCallback, useRef, useState } from 'react';
import { Alert, Platform, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { jobsApi } from '../../src/api/client';
import { useRemote } from '../../src/hooks/useRemote';
import { Button, Notice, Panel, Screen, k, usePalette } from '../../src/components/native/Kit';
import { payLabel, shiftWhen } from '../../src/components/jobs/JobsBoard';
import { openSource } from '../../src/components/native/Editorial';
import { errorMessage } from '../../src/utils/marketplace';

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
  const shift = data ? shiftWhen(data) : null;
  const pay = data ? payLabel(data) : null;
  const facts = data ? [
    shift && ['clock', 'When', shift],
    pay && ['dollar-sign', 'Pay', pay],
    (data.location || data.remote) && ['map-pin', 'Where', data.remote ? 'Remote' : data.location],
    !shift && data.jobType && ['briefcase', 'Type', data.jobType.replaceAll('_', ' ').toLowerCase().replace(/^./, ch => ch.toUpperCase())],
  ].filter(Boolean) : [];
  const input = [k.input, { color: c.text, borderColor: c.line, backgroundColor: c.card, fontSize: 15, minHeight: 110, paddingTop: 12, textAlignVertical: 'top' }];
  return <Screen back title={shift ? 'Shift' : 'Job details'}>{error ? <Notice message={error} onRetry={reload} /> : !data ? <Notice loading={loading} message="Loading…" /> : <>
    <View style={{ gap: 4 }}>
      {!!shift && <Text style={{ color: '#B45309', fontSize: 12, fontWeight: '800', letterSpacing: 0.4 }}>SHIFT UP FOR GRABS</Text>}
      <Text style={{ color: c.text, fontSize: 21, fontWeight: '800', lineHeight: 27 }}>{data.title}</Text>
      <Text style={{ color: c.muted, fontSize: 14 }}>{data.companyName}</Text>
    </View>
    {facts.length > 0 && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {facts.map(([icon, label, value]) => <View key={label} style={{ flexGrow: 1, flexBasis: '45%', padding: 12, borderRadius: 14, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, gap: 3 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Feather name={icon} size={13} color={c.muted} /><Text style={{ color: c.muted, fontSize: 12 }}>{label}</Text></View>
        <Text style={{ color: c.text, fontSize: 14, fontWeight: '700' }}>{value}</Text>
      </View>)}
    </View>}
    <View style={{ gap: 6 }}>
      <Text style={{ color: c.text, fontSize: 15, fontWeight: '800' }}>{shift ? 'About the shift' : 'About the role'}</Text>
      <Text selectable style={{ color: c.text, fontSize: 14.5, lineHeight: 22 }}>{data.description}</Text>
    </View>
    {data.sourceUrl ? <Button onPress={() => openSource(data.sourceUrl)}>Apply on {data.sourceName || 'source website'} →</Button>
      : applied || data.appliedByCurrentUser ? <Panel><Text style={{ color: c.text, fontWeight: '800', fontSize: 15 }}>{shift ? 'Offer sent' : 'Application sent'}</Text><Text style={{ color: c.muted, fontSize: 13 }}>Track it in My applications.</Text></Panel>
      : data.ownedByCurrentUser ? <Notice message={shift ? 'This is your shift. Offers to take it appear in Applications.' : 'This is your job advert.'} />
      : <Panel>
        <Text style={{ color: c.text, fontWeight: '800', fontSize: 15 }}>{shift ? 'Can you take this shift?' : 'Introduce yourself'}</Text>
        <TextInput accessibilityLabel="Message" value={message} onChangeText={setMessage} multiline placeholder={shift ? 'Your experience and how to reach you…' : 'Why you’re a fit, and when you can start…'} placeholderTextColor={c.muted} style={input} />
        {!shift && <Button secondary icon="paperclip" onPress={pick}>{attachment?.name || 'Attach a portfolio image or video'}</Button>}
        {!shift && <Text style={{ color: c.muted, fontSize: 12 }}>Images and video only. Put a CV link in your message.</Text>}
        {attachment && <Button secondary onPress={() => setAttachment(null)}>Remove attachment</Button>}
        {!!failure && <Text style={{ color: c.danger, fontSize: 13 }}>{failure}</Text>}
        <Button busy={busy} onPress={apply}>{shift ? 'I can take it' : 'Send application'}</Button>
      </Panel>}
  </>}</Screen>;
}
