import React from 'react';
import { useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { Copy, Screen, Button, Panel } from '../../src/components/native/Kit';
import { Group, Row } from '../../src/components/native/GroupedList';
import AppearancePicker from '../../src/components/native/AppearancePicker';

export default function MoreScreen() {
  const router = useRouter();
  const user = useSelector(s => s.auth.user);
  const go = route => router.push(route);
  return <Screen title="More">
    <Copy heading accessibilityRole="header" style={{ fontSize: 28 }}>More</Copy>
    <Copy muted>Everything else, in one place.</Copy>
    {!user && <Panel><Copy>Sign in to see your orders, appointments and messages.</Copy><Button onPress={() => go('/login')}>Sign in</Button></Panel>}
    <Group title="Your account">
      <Row icon="user" label="My profile" onPress={() => go(user ? '/profile' : '/login')} />
      <Row icon="shopping-bag" label="Shopping cart" onPress={() => go('/cart')} />
      <Row icon="calendar" label="Orders & appointments" subtitle="Purchases, bookings and their status" onPress={() => go('/profile/orders')} />
      <Row icon="tag" label="My tickets" onPress={() => go('/tickets')} />
      <Row icon="bell" label="Notifications" onPress={() => go('/notifications')} />
    </Group>
    <Group title="Your business">
      <Row icon="shopping-bag" label="Manage my shop" subtitle="Products, services and appointments" onPress={() => go('/shop/manage')} />
      <Row icon="grid" label="Seller dashboard" subtitle="Add listings and manage sales" onPress={() => go('/dashboard')} />
    </Group>
    <Group title="Discover">
      <Row icon="briefcase" label="Jobs & gigs" onPress={() => go('/jobs')} />
      <Row icon="book-open" label="News" onPress={() => go('/news')} />
      <Row icon="repeat" label="Swaps" onPress={() => go('/swaps')} />
      <Row icon="heart" label="Meet people" subtitle="Hustle Bond" onPress={() => go('/bond')} />
      <Row icon="award" label="Community rankings" onPress={() => go('/leaderboard')} />
    </Group>
    <AppearancePicker />
    <Group title="Help & settings"><Row icon="help-circle" label="Help & settings" subtitle="Support, privacy and account preferences" onPress={() => go('/profile/settings')} /></Group>
  </Screen>;
}
