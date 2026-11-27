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

/** Card height for a given screen width: a tall, poster-like card. Shared with the skeleton. */
export function featuredHeight(screenWidth) {
  return Math.round(Math.min(440, Math.max(340, (screenWidth - 40) * 1.1)));
}

function eventDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' }) + ' · ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function FeaturedBanner({ featured, onOpen }) {
  const c = usePalette();
  const { width } = useWindowDimensions();
  const cardW = width - 40;
  const cardH = featuredHeight(width);
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
              <ImageBackground source={{ uri: mediaUrl(l.mediaUrls?.[0]) }} style={{ width: cardW, height: cardH, justifyContent: 'space-between', backgroundColor: c.soft, borderRadius: 28, overflow: 'hidden' }} imageStyle={{ borderRadius: 28 }}>
                {/* Badge sits on the photo's top edge so the image itself stays the hero. */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', margin: 14, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10, backgroundColor: event ? PURPLE : '#CDFF00' }}>
                  <Feather name={event ? 'calendar' : 'trending-up'} size={10} color={event ? '#FFF' : '#111'} />
                  <Text style={{ color: event ? '#FFF' : '#111', fontSize: 9.5, fontWeight: '800', letterSpacing: 0.8 }}>{event ? eventDate(l.eventStartsAt).toUpperCase() : 'TRENDING NOW'}</Text>
                </View>
                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.45)', 'rgba(10,4,24,0.92)']} locations={[0, 0.35, 1]} style={{ paddingHorizontal: 16, paddingTop: 70, paddingBottom: 16, gap: 6 }}>
                  <Text style={{ color: '#FFF', fontSize: 17, fontWeight: '800', lineHeight: 22 }} numberOfLines={2}>{l.title}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <Text style={{ flex: 1, color: '#E9E4FFCC', fontSize: 11.5 }} numberOfLines={1}>{event ? (l.eventVenue || l.locationCity || '') : `${l.sellerName || ''}${l.locationCity ? ' · ' + l.locationCity : ''}`}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#CDFF00', paddingHorizontal: 11, height: 30, borderRadius: 15 }}>
                      <Text style={{ color: '#111', fontWeight: '800', fontSize: 11.5 }}>{Number(l.price) === 0 ? 'Free' : `${event ? 'From ' : ''}${money(l.price, l.currency)}`}</Text>
                      <Feather name="arrow-right" size={12} color="#111" />
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
