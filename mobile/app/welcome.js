import React, { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { listingsApi } from '../src/api/client';
import { mediaUrl } from '../src/utils/media';
import { fonts } from '../src/components/native/Kit';
import BrandLogo from '../src/components/native/BrandLogo';

export const WELCOME_SEEN_KEY = 'hustleup_seen_welcome';

const BG = '#050605';
const LIME = '#CDFF00';
const PURPLE = '#8B5CF6';
const TEXT = '#F7F8F5';
const MUTED = '#9CA096';

/** What a new visitor needs to know before signing up — one idea per page. */
const PAGES = [
  {
    key: 'intro',
    title: 'Your local hustle,\nall in one app',
    body: 'Buy and sell, run a shop, sell event tickets, chat and meet people near you.',
  },
  {
    key: 'sell', icon: 'tag', tint: LIME,
    title: 'Sell anything for free',
    body: 'List goods, food, skills, rentals, jobs or events in a minute. We only take a small fee when you make a sale.',
    points: [['camera', 'Add photos and a price'], ['repeat', 'Accept offers or swaps'], ['share-2', 'Share your listing to the feed']],
  },
  {
    key: 'shop', icon: 'shopping-bag', tint: PURPLE,
    title: 'Open a shop in two steps',
    body: 'Pick what kind of shop you run, add a banner, and start selling products or taking bookings.',
    points: [['package', 'Products with stock and delivery'], ['calendar', 'Services with time slots'], ['star', 'Highlights to show your best work']],
  },
  {
    key: 'pay', icon: 'shield', tint: LIME,
    title: 'Pay safely, track every order',
    body: 'Pay by card or BLIK. The seller is paid once you confirm your order arrived.',
    points: [['lock', 'Payments secured by Stripe'], ['truck', 'Step-by-step order tracking'], ['life-buoy', 'Report a problem if something goes wrong']],
  },
  {
    key: 'connect', icon: 'message-circle', tint: PURPLE,
    title: 'Chat, post and meet people',
    body: 'Message sellers and friends, post a status, join communities and swipe on Bond.',
    points: [['mic', 'Voice notes, photos and reactions'], ['eye-off', 'You choose who sees your status'], ['heart', 'Bond is free for everyone']],
  },
];

/** A loose stack of real listing photos — the one moment of flourish on this screen. */
function Collage({ photos, width }) {
  const w = Math.min(width - 40, 360);
  const tiles = [
    { left: 0, top: 26, size: w * 0.5, rotate: '-7deg' },
    { left: w * 0.47, top: 0, size: w * 0.53, rotate: '5deg' },
    { left: w * 0.2, top: w * 0.44, size: w * 0.46, rotate: '3deg' },
  ];
  return (
    <View style={{ width: w, height: w * 0.92, alignSelf: 'center' }}>
      {tiles.map((t, i) => (
        <View key={i} style={{ position: 'absolute', left: t.left, top: t.top, width: t.size, height: t.size * 1.12, borderRadius: 22, overflow: 'hidden',
          backgroundColor: i === 1 ? PURPLE : '#151814', borderWidth: 3, borderColor: i === 2 ? LIME : '#1C1F1A', transform: [{ rotate: t.rotate }] }}>
          {photos[i]
            ? <Image source={{ uri: photos[i].uri }} style={{ flex: 1 }} contentFit="cover" transition={250} />
            : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Feather name={['shopping-bag', 'calendar', 'coffee'][i]} size={34} color={i === 1 ? '#FFF' : LIME} /></View>}
          {photos[i]?.price ? (
            <View style={{ position: 'absolute', left: 8, bottom: 8, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10, backgroundColor: 'rgba(5,6,5,0.78)' }}>
              <Text style={{ color: TEXT, fontFamily: fonts.medium, fontSize: 11 }}>{photos[i].price}</Text>
            </View>
          ) : null}
        </View>
      ))}
      <View style={{ position: 'absolute', right: 6, bottom: 4 }}><BrandLogo size={58} glow /></View>
    </View>
  );
}

export default function Welcome() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const [photos, setPhotos] = useState([]);
  const list = useRef(null);

  useEffect(() => {
    let alive = true;
    listingsApi.browse({ sort: 'latest', size: 12 })
      .then(({ data }) => {
        const items = (Array.isArray(data) ? data : data?.content || []).filter(l => l.mediaUrls?.[0]);
        if (alive) setPhotos(items.slice(0, 3).map(l => ({ uri: mediaUrl(l.mediaUrls[0]), price: l.price ? `${l.price} ${l.currency || 'PLN'}` : '' })));
      })
      .catch(() => {}); // the collage falls back to icons
    return () => { alive = false; };
  }, []);

  const leave = (to) => {
    AsyncStorage.setItem(WELCOME_SEEN_KEY, '1').catch(() => {});
    router.replace(to);
  };
  const last = page === PAGES.length - 1;
  const next = () => list.current?.scrollToIndex({ index: Math.min(page + 1, PAGES.length - 1), animated: true });

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar style="light" />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 6 }}>
          <Text style={{ color: TEXT, fontFamily: fonts.heading, fontSize: 17 }}>Hustle<Text style={{ color: LIME }}>Space</Text></Text>
          <Pressable accessibilityRole="button" onPress={() => leave('/(tabs)')} hitSlop={10} style={{ minHeight: 36, justifyContent: 'center' }}>
            <Text style={{ color: MUTED, fontFamily: fonts.medium, fontSize: 13 }}>Look around first</Text>
          </Pressable>
        </View>

        <FlatList
          ref={list}
          data={PAGES}
          keyExtractor={p => p.key}
          horizontal pagingEnabled showsHorizontalScrollIndicator={false}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          onMomentumScrollEnd={e => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item: p }) => (
            <View style={{ width, paddingHorizontal: 24, justifyContent: 'center', gap: 22 }}>
              {p.key === 'intro' ? <Collage photos={photos} width={width} /> : (
                <View style={{ width: 76, height: 76, borderRadius: 24, backgroundColor: p.tint, alignItems: 'center', justifyContent: 'center' }}>
                  <Feather name={p.icon} size={34} color={p.tint === LIME ? BG : '#FFF'} />
                </View>
              )}
              <View style={{ gap: 10 }}>
                <Text style={{ color: TEXT, fontFamily: fonts.heading, fontSize: p.key === 'intro' ? 34 : 28, lineHeight: p.key === 'intro' ? 40 : 34, letterSpacing: -0.6 }}>{p.title}</Text>
                <Text style={{ color: MUTED, fontFamily: fonts.body, fontSize: 15, lineHeight: 23, maxWidth: 340 }}>{p.body}</Text>
              </View>
              {p.points && (
                <View style={{ gap: 12 }}>
                  {p.points.map(([icon, label]) => (
                    <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <Feather name={icon} size={17} color={p.tint} />
                      <Text style={{ color: TEXT, fontFamily: fonts.body, fontSize: 14 }}>{label}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        />

        <View style={{ paddingHorizontal: 20, paddingBottom: 14, gap: 14 }}>
          <View style={{ flexDirection: 'row', gap: 6, alignSelf: 'center' }} accessibilityLabel={`Page ${page + 1} of ${PAGES.length}`}>
            {PAGES.map((p, i) => (
              <Pressable key={p.key} hitSlop={6} onPress={() => list.current?.scrollToIndex({ index: i, animated: true })}
                style={{ width: i === page ? 22 : 7, height: 7, borderRadius: 4, backgroundColor: i === page ? LIME : '#2E322B' }} />
            ))}
          </View>
          <Pressable accessibilityRole="button" onPress={() => (last ? leave('/register') : next())}
            style={({ pressed }) => ({ minHeight: 56, borderRadius: 18, backgroundColor: LIME, alignItems: 'center', justifyContent: 'center', transform: [{ scale: pressed ? 0.98 : 1 }] })}>
            <Text style={{ color: BG, fontFamily: fonts.heading, fontSize: 16 }}>{last ? 'Create a free account' : 'Next'}</Text>
          </Pressable>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {!last && (
              <Pressable accessibilityRole="button" onPress={() => leave('/register')}
                style={{ flex: 1, minHeight: 50, borderRadius: 16, borderWidth: 1.5, borderColor: PURPLE, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: TEXT, fontFamily: fonts.medium, fontSize: 14 }}>Sign up</Text>
              </Pressable>
            )}
            <Pressable accessibilityRole="button" onPress={() => leave('/login')}
              style={{ flex: 1, minHeight: 50, borderRadius: 16, borderWidth: 1.5, borderColor: '#2E322B', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: TEXT, fontFamily: fonts.medium, fontSize: 14 }}>I have an account</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}
