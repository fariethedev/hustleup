import React, { useEffect, useRef, useState } from 'react';
import { FlatList, ImageBackground, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { mediaUrl } from '../../utils/media';
import { money } from '../../utils/marketplace';
import { PURPLE, usePalette } from './Kit';

const ROTATE_MS = 5000;

/**
 * Home-screen hero: the next upcoming events first, then the most trending listings, as a
 * swipeable banner that advances on its own. Replaces the old static stock photo.
 */
export function buildFeatured(events = [], trending = []) {
  const now = Date.now();
  const upcoming = events
    .filter(e => e.eventStartsAt && new Date(e.eventStartsAt).getTime() > now && (!e.status || e.status === 'ACTIVE'))
    .sort((a, b) => new Date(a.eventStartsAt) - new Date(b.eventStartsAt))
    .slice(0, 3)
    .map(item => ({ item, kind: 'event' }));
  const seen = new Set(upcoming.map(f => f.item.id));
  const hot = trending.filter(l => !seen.has(l.id) && l.mediaUrls?.length).slice(0, 5 - upcoming.length).map(item => ({ item, kind: 'trending' }));
  return [...upcoming, ...hot];
}

function eventDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' }) + ' · ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function FeaturedBanner({ featured, onOpen }) {
  const c = usePalette();
  const { width } = useWindowDimensions();
  const cardW = width - 40;
  const list = useRef(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (featured.length < 2) return undefined;
    const t = setInterval(() => {
      setIndex(i => {
        const next = (i + 1) % featured.length;
        list.current?.scrollToOffset({ offset: next * (cardW + 12), animated: true });
        return next;
      });
    }, ROTATE_MS);
    return () => clearInterval(t);
  }, [featured.length, cardW]);

  if (!featured.length) return null;
  return (
    <View style={{ gap: 10 }}>
      <FlatList
        ref={list}
        data={featured}
        horizontal
        pagingEnabled={false}
        snapToInterval={cardW + 12}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        keyExtractor={f => String(f.item.id)}
        ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
        onMomentumScrollEnd={e => setIndex(Math.round(e.nativeEvent.contentOffset.x / (cardW + 12)))}
        renderItem={({ item: f }) => {
          const l = f.item;
          const event = f.kind === 'event';
          return (
            <Pressable onPress={() => onOpen(l)} accessibilityRole="button" accessibilityLabel={`${event ? 'Event' : 'Trending'}: ${l.title}`}>
              <ImageBackground source={{ uri: mediaUrl(l.mediaUrls?.[0]) }} style={{ width: cardW, height: 230, justifyContent: 'flex-end', backgroundColor: c.soft }} imageStyle={{ borderRadius: 26 }}>
                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.55)', 'rgba(10,4,24,0.95)']} style={{ borderRadius: 26, padding: 18, paddingTop: 60, gap: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: event ? PURPLE : '#CDFF00' }}>
                    <Feather name={event ? 'calendar' : 'trending-up'} size={12} color={event ? '#FFF' : '#111'} />
                    <Text style={{ color: event ? '#FFF' : '#111', fontSize: 11, fontWeight: '900', letterSpacing: 0.5 }}>{event ? eventDate(l.eventStartsAt).toUpperCase() : 'TRENDING NOW'}</Text>
                  </View>
                  <Text style={{ color: '#FFF', fontSize: 23, fontWeight: '900' }} numberOfLines={2}>{l.title}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ color: '#E9E4FF', fontSize: 13 }} numberOfLines={1}>{event ? (l.eventVenue || l.locationCity || '') : `${l.sellerName || ''}${l.locationCity ? ' · ' + l.locationCity : ''}`}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#CDFF00', paddingHorizontal: 12, minHeight: 34, borderRadius: 17 }}>
                      <Text style={{ color: '#111', fontWeight: '900', fontSize: 13 }}>{Number(l.price) === 0 ? 'Free' : `${event ? 'From ' : ''}${money(l.price, l.currency)}`}</Text>
                      <Feather name="arrow-right" size={14} color="#111" />
                    </View>
                  </View>
                </LinearGradient>
              </ImageBackground>
            </Pressable>
          );
        }}
      />
      {featured.length > 1 && (
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
          {featured.map((_, i) => <View key={i} style={{ width: i === index ? 20 : 7, height: 7, borderRadius: 4, backgroundColor: i === index ? PURPLE : c.line }} />)}
        </View>
      )}
    </View>
  );
}
