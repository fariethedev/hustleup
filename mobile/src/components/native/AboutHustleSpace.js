import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from './Icon';
import { LinearGradient } from 'expo-linear-gradient';
import BrandLogo from './BrandLogo';
import { LIME, PURPLE, fonts, usePalette } from './Kit';

/** What HustleSpace is, plus a step-by-step guide where every step links to the place it describes. */
const STEPS = [
  { icon: 'user-check', title: 'Set up your profile', body: 'Add a photo, your city and a short bio so people know who they’re dealing with.', cta: 'Edit profile', route: 'profile' },
  { icon: 'compass', title: 'Discover & buy', body: 'Browse products, services, events and shops. Add to cart or tap Buy now — you can also make an offer on negotiable items.', cta: 'Explore', route: '/(tabs)/explore' },
  { icon: 'plus-circle', title: 'Sell anything — free', body: 'Tap + to list goods, food, skills, rentals, luggage space, jobs or events with ticket tiers. Listing is free; we only take a small fee when you make a sale.', cta: 'Add a listing', action: 'create' },
  { icon: 'shopping-bag', title: 'Open a shop', body: 'Run a storefront with products or bookable appointments, plus highlights to showcase your best work.', cta: 'Open my shop', route: '/shop/manage' },
  { icon: 'shield', title: 'Pay safely, track orders', body: 'Pay securely by card or BLIK. Your money is held until you confirm you received your order, and you can track delivery step by step.', cta: 'My orders', route: '/profile/orders' },
  { icon: 'message-circle', title: 'Chat & share status', body: 'Message sellers and friends with voice notes, photos and reactions. Post a status and control who sees it in Privacy.', cta: 'Messages', route: '/(tabs)/messages' },
  { icon: 'heart', title: 'Make connections on Bond', body: 'Swipe to meet people for friendship, networking or dating. Match, then chat — it’s free for everyone.', cta: 'Open Bond', route: '/bond' },
  { icon: 'users', title: 'Join the community', body: 'Post to the feed, join communities around what you love and climb the leaderboard by selling and earning great reviews.', cta: 'Go to feed', route: '/(tabs)/feed' },
];

export default function AboutHustleSpace({ onNavigate, onCreateListing, userId }) {
  const c = usePalette();
  const [expanded, setExpanded] = useState(false);
  const steps = expanded ? STEPS : STEPS.slice(0, 4);

  const go = (step) => {
    if (step.action === 'create') onCreateListing();
    else if (step.route === 'profile') onNavigate(userId ? `/profile/${userId}` : '/login');
    else onNavigate(step.route);
  };

  return (
    <View style={{ gap: 16 }}>
      {/* About */}
      <LinearGradient colors={c.light ? ['#EDE9FE', '#F7FEE7'] : ['#1E1533', '#0F1A05']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ borderRadius: 26, padding: 20, gap: 12, borderWidth: 1, borderColor: c.light ? '#DDD6FE' : '#2E2347' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <BrandLogo size={44} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.purple, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>ABOUT US</Text>
            <Text style={{ color: c.text, fontFamily: fonts.heading, fontSize: 20 }}>What is HustleSpace?</Text>
          </View>
        </View>
        <Text style={{ color: c.text, fontSize: 14, lineHeight: 22 }}>
          HustleSpace is one app for your local hustle: a marketplace to buy and sell, storefronts for small businesses,
          events with tickets, a community feed, private messaging and Bond for meeting new people.
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {[['gift', 'Free to join & sell'], ['lock', 'Buyer protection'], ['zap', 'Fast payouts']].map(([icon, label]) => (
            <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: c.light ? '#FFFFFFAA' : '#00000055' }}>
              <Feather name={icon} size={13} color={c.light ? c.purple : LIME} />
              <Text style={{ color: c.text, fontSize: 12, fontWeight: '700' }}>{label}</Text>
            </View>
          ))}
        </View>
      </LinearGradient>

      {/* How to use it */}
      <View style={{ gap: 4 }}>
        <Text style={{ color: c.purple, fontSize: 12, fontWeight: '800', letterSpacing: 0.4 }}>GETTING STARTED</Text>
        <Text style={{ color: c.text, fontFamily: fonts.heading, fontSize: 24 }}>How to use HustleSpace</Text>
      </View>
      {steps.map((step, i) => (
        <View key={step.title} style={{ flexDirection: 'row', gap: 14 }}>
          <View style={{ alignItems: 'center' }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: i % 2 ? PURPLE : LIME, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: i % 2 ? '#FFF' : '#111', fontWeight: '900', fontSize: 16 }}>{i + 1}</Text>
            </View>
            {i < steps.length - 1 && <View style={{ width: 2, flex: 1, backgroundColor: c.line, marginTop: 4 }} />}
          </View>
          <View style={{ flex: 1, backgroundColor: c.card, borderRadius: 20, borderWidth: 1, borderColor: c.line, padding: 16, gap: 8, marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Feather name={step.icon} size={18} color={c.purple} />
              <Text style={{ color: c.text, fontWeight: '800', fontSize: 16, flex: 1 }}>{step.title}</Text>
            </View>
            <Text style={{ color: c.muted, fontSize: 13, lineHeight: 20 }}>{step.body}</Text>
            <Pressable accessibilityRole="button" onPress={() => go(step)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', minHeight: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: c.purple }}>
              <Text style={{ color: c.purple, fontWeight: '800', fontSize: 13 }}>{step.cta}</Text>
              
            </Pressable>
          </View>
        </View>
      ))}
      <Pressable accessibilityRole="button" onPress={() => setExpanded(v => !v)} style={{ alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 18, borderRadius: 22, backgroundColor: c.lime }}>
        <Text style={{ color: '#151A00', fontWeight: '800' }}>{expanded ? 'Show less' : `Show all ${STEPS.length} steps`}</Text>
        <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color="#151A00" />
      </Pressable>
    </View>
  );
}
