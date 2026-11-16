import React, { useCallback, useRef, useState } from 'react';
import { Alert, RefreshControl, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import QRCode from 'react-native-qrcode-svg';
import { ticketsApi } from '../../src/api/client';
import { useRemote } from '../../src/hooks/useRemote';
import { Button, Copy, Notice, Panel, Screen, usePalette } from '../../src/components/native/Kit';
import { ticketDate, ticketStatus } from '../../src/utils/tickets';
import { errorMessage, money } from '../../src/utils/marketplace';

export default function TicketDetail() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const user = useSelector(s => s.auth.user);
  const c = usePalette();
  const { width } = useWindowDimensions();
  const fetcher = useCallback(async () => (await ticketsApi.getById(id)).data, [id]);
  const { data: ticket, loading, error, reload } = useRemote(fetcher);
  const [busy, setBusy] = useState(false);
  const [qrError, setQrError] = useState(false);
  const locked = useRef(false);
  const join = async () => {
    if (locked.current) return;
    locked.current = true; setBusy(true);
    try { await ticketsApi.checkInSelf(id); await reload(); }
    catch (e) { Alert.alert('Could not check in', errorMessage(e, 'Please try again.')); }
    finally { locked.current = false; setBusy(false); }
  };
  const owner = ticket?.ownerId === user?.id;
  const usable = ticket?.status === 'VALID';
  return <Screen back title="Your ticket" refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={c.accent} />}>
    {!!error && <Notice message={error} onRetry={reload} />}
    {!ticket ? <Notice loading={loading} message={loading ? 'Loading ticket…' : 'Ticket unavailable.'} /> : <Panel style={{ gap: 20 }}>
      <Copy style={{ color: usable ? c.accent : c.muted, textAlign: 'center' }}>{ticketStatus(ticket.status)}</Copy>
      <View style={{ alignItems: 'center', gap: 16, paddingBottom: 24, borderBottomWidth: 1, borderStyle: 'dashed', borderColor: c.line }}>
        {owner && usable && ticket.qrPayload && !qrError ? <View accessibilityLabel="Private admission QR code" style={{ backgroundColor: '#FFF', padding: 16, borderRadius: 16 }}><QRCode value={ticket.qrPayload} size={Math.max(120, Math.min(230, width - 116))} ecl="M" quietZone={8} onError={() => setQrError(true)} /></View> : <Copy muted style={{ textAlign: 'center' }}>{!usable ? 'This ticket is no longer available for admission.' : owner ? 'Show the admission code below at the door.' : 'Only the ticket holder can view the admission QR.'}</Copy>}
        {owner && <Copy heading selectable style={{ fontSize: 22, letterSpacing: 2, textAlign: 'center' }}>{ticket.ticketCode}</Copy>}
        {ticket.ticketsInBooking > 1 && <Copy muted>Ticket {ticket.ticketNumber} of {ticket.ticketsInBooking}</Copy>}
      </View>
      <Copy heading style={{ fontSize: 25, lineHeight: 31 }}>{ticket.eventTitle}</Copy><Copy muted>Hosted by {ticket.organiserName}</Copy>
      {[['When', ticketDate(ticket.eventStartsAt)], ['Where', ticket.eventVenue || ticket.eventCity || 'To be announced'], ['Admits', ticket.ownerName], ['Paid', ticket.pricePaid == null ? null : money(ticket.pricePaid, ticket.currency)]].filter(([, value]) => value).map(([label, value]) => <View key={label}><Copy muted style={{ fontSize: 11 }}>{label.toUpperCase()}</Copy><Copy>{value}</Copy></View>)}
      {owner && usable && <Button icon="check-circle" disabled={!!error || loading} busy={busy} onPress={() => Alert.alert('Join the event?', 'This marks your ticket as used. At a staffed door, let the organiser scan your code instead.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Join event', onPress: join }])}>Join the event</Button>}
      {ticket.status === 'CHECKED_IN' && <Copy style={{ color: c.accent }}>You’re in. Have a good one.</Copy>}
      {ticket.status === 'CANCELLED' && <Copy muted>This ticket is void. If that is wrong, message the organiser.</Copy>}
      {ticket.organiserId === user?.id && <Button secondary icon="camera" onPress={() => router.push('/events/' + ticket.listingId + '/door')}>Open door scanner</Button>}
      <Button secondary onPress={() => router.push('/listing/' + ticket.listingId)}>View event</Button>
      <Copy muted style={{ fontSize: 11, textAlign: 'center' }}>Keep this code to yourself — anyone who scans it can take your place.</Copy>
    </Panel>}
  </Screen>;
}
