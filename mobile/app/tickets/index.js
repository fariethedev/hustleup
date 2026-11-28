import React, { useState } from 'react';
import { FlatList, Image, Pressable, RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '../../src/components/native/Icon';
import { ticketsApi } from '../../src/api/client';
import { useRemote } from '../../src/hooks/useRemote';
import { Button, Copy, Notice, Panel, Screen, Section, k, usePalette } from '../../src/components/native/Kit';
import { mediaUrl } from '../../src/utils/media';
import { ticketDate, ticketIsPast, ticketStatus } from '../../src/utils/tickets';

const fetchTickets = async () => (await ticketsApi.my()).data;
export default function Tickets() {
  const router = useRouter();
  const c = usePalette();
  const { data, loading, error, reload } = useRemote(fetchTickets);
  const [past, setPast] = useState(false);
  const rows = (data || []).filter(ticket => ticketIsPast(ticket) === past).sort((a, b) => (Date.parse(a.eventStartsAt) || 0) - (Date.parse(b.eventStartsAt) || 0));
  return <Screen back title="My tickets" scroll={false}><FlatList data={rows} keyExtractor={item => String(item.id)} contentContainerStyle={k.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={c.accent} />}
    ListHeaderComponent={<View style={{ gap: 16 }}><Section eyebrow="Your next good memory" title="You're on the list." subtitle="Every event, every ticket, right here. Show your code at the door." /><View style={{ flexDirection: 'row', gap: 8 }}><Button secondary={past} onPress={() => setPast(false)}>Upcoming</Button><Button secondary={!past} onPress={() => setPast(true)}>Past & used</Button></View>{!!error && <Notice message={error} onRetry={reload} />}</View>}
    ListEmptyComponent={<Notice loading={loading} message={loading ? 'Loading your tickets…' : past ? 'No past tickets yet.' : 'Your tickets will appear here once an event booking is confirmed.'} />}
    renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`Ticket for ${item.eventTitle}`} onPress={() => router.push('/tickets/' + item.id)}><Panel style={{ flexDirection: 'row', padding: 0, overflow: 'hidden', borderRadius: 20 }}><View style={{ width: 96, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center' }}>{item.eventImageUrl ? <Image source={{ uri: mediaUrl(item.eventImageUrl) }} style={{ width: 96, height: '100%', minHeight: 156 }} /> : <Feather name="calendar" size={30} color={c.accent} />}</View><View style={{ flex: 1, borderLeftWidth: 1, borderStyle: 'dashed', borderColor: c.line, padding: 15, gap: 6 }}><Copy style={{ color: c.accent, fontSize: 11 }}>{ticketStatus(item.status)}</Copy><Copy heading>{item.eventTitle}</Copy><Copy muted style={{ fontSize: 12 }}>{ticketDate(item.eventStartsAt)}</Copy><Copy muted style={{ fontSize: 12 }}>{item.eventVenue || item.eventCity || 'Venue to be announced'}</Copy><Copy style={{ color: c.accent, fontSize: 12 }}>View ticket</Copy></View></Panel></Pressable>} /></Screen>;
}
