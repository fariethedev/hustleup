import React, { useCallback, useRef, useState } from 'react';
import { AppState, RefreshControl, TextInput, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ticketsApi } from '../../../src/api/client';
import { useRemote } from '../../../src/hooks/useRemote';
import { Button, Copy, Notice, Panel, Screen, Section, k, usePalette } from '../../../src/components/native/Kit';
import { errorMessage } from '../../../src/utils/marketplace';
import { ticketStatus } from '../../../src/utils/tickets';

export default function EventDoor() {
  const { listingId } = useLocalSearchParams();
  const c = usePalette();
  const [permission, requestPermission] = useCameraPermissions();
  const [camera, setCamera] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [cameraError, setCameraError] = useState('');
  const locked = useRef(false);
  const fetcher = useCallback(async () => {
    const [tickets, summary] = await Promise.all([ticketsApi.forEvent(listingId), ticketsApi.doorSummary(listingId)]);
    return { tickets: tickets.data, summary: summary.data };
  }, [listingId]);
  const { data, loading, error, reload } = useRemote(fetcher);
  useFocusEffect(useCallback(() => {
    const listener = AppState.addEventListener('change', state => { if (state !== 'active') setCamera(false); });
    return () => { listener.remove(); setCamera(false); };
  }, []));
  const scan = async value => {
    if (!value.trim() || locked.current || error || !data) return;
    locked.current = true; setBusy(true); setCamera(false);
    try { const response = await ticketsApi.scan(listingId, value.trim()); setResult(response.data); await reload(); }
    catch (e) { setResult({ admitted: false, reason: errorMessage(e, 'Could not reach the door service. Check before trying again.') }); }
    finally { setBusy(false); }
    // Deliberately stay locked until Next ticket. One QR must never be submitted per frame.
  };
  const startCamera = async () => {
    setCameraError('');
    try { const granted = permission?.granted || (await requestPermission()).granted; if (granted) setCamera(true); else setCameraError('Camera permission was not granted. Enter the admission code below instead.'); }
    catch { setCameraError('Camera unavailable. Enter the admission code instead.'); }
  };
  return <Screen back title="Event door" refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={c.accent} />}>
    <Section eyebrow="Organiser workspace" title="A good welcome starts here." subtitle="Scan a ticket or enter its admission code. Only a confirmed admission lets a guest in." />
    {!!error && <Notice message={error} onRetry={reload} />}
    {!data ? <Notice loading={loading} message={loading ? 'Checking organiser access…' : 'Door access unavailable.'} /> : <>
      <View style={{ flexDirection: 'row', gap: 8 }}>{[['Issued', data.summary.issued], ['Checked in', data.summary.checkedIn], ['Expected', data.summary.expected]].map(([label, value]) => <Panel key={label} style={{ flex: 1, padding: 12 }}><Copy heading style={{ fontSize: 25 }}>{value ?? '—'}</Copy><Copy muted style={{ fontSize: 10 }}>{label}</Copy></Panel>)}</View>
      {camera && !error && <CameraView style={{ height: 280, borderRadius: 20 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={busy || result ? undefined : event => scan(event.data)} onMountError={() => { setCamera(false); setCameraError('Camera unavailable. Enter the code instead.'); }} />}
      {!!cameraError && <Copy muted>{cameraError}</Copy>}
      {result ? <Panel><Copy heading style={{ color: result.admitted === true ? '#209B57' : '#D55656', fontSize: 25 }}>{result.admitted === true ? 'Admitted' : 'Not admitted'}</Copy><Copy>{result.reason || result.outcome}</Copy>{result.ticket?.ownerName && <Copy>{result.ticket.ownerName}</Copy>}<Button disabled={busy} onPress={() => { locked.current = false; setResult(null); setCode(''); }}>Next ticket</Button></Panel> : <Panel><Button secondary icon="camera" disabled={!!error || loading} onPress={camera ? () => setCamera(false) : startCamera}>{camera ? 'Close camera' : 'Scan QR code'}</Button><TextInput accessibilityLabel="Admission code" placeholder="Enter admission code" autoCapitalize="characters" autoCorrect={false} placeholderTextColor={c.muted} style={[k.input, { color: c.text, borderColor: c.line }]} value={code} onChangeText={setCode} /><Button busy={busy} disabled={!code.trim() || !!error || loading} onPress={() => scan(code)}>Check ticket</Button></Panel>}
      <Section title="Guest list" />{data.tickets.map(ticket => <Panel key={ticket.id}><Copy>{ticket.ownerName}</Copy><Copy muted>{ticketStatus(ticket.status)}</Copy></Panel>)}
    </>}
  </Screen>;
}
