import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, Platform, Animated } from 'react-native';
import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { notificationsApi } from '../../src/api/client';

const LIME = '#CDFF00';
const BAR_HEIGHT = 54; // icon row height (excludes safe area padding)

function TabIcon({ name, color, focused }) {
  const scale = useRef(new Animated.Value(focused ? 1.0 : 0.86)).current;
  const glowOpacity = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: focused ? 1.0 : 0.86,
      useNativeDriver: true,
      tension: 320,
      friction: 22,
    }).start();
    Animated.timing(glowOpacity, {
      toValue: focused ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [focused]);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Animated.View
        style={[styles.iconGlow, { opacity: glowOpacity }]}
        pointerEvents="none"
      />
      <View style={[
        styles.iconContainer,
        focused && styles.iconContainerActive,
      ]}>
        <Feather name={name} size={22} color={focused ? '#000' : color} />
      </View>
    </Animated.View>
  );
}

export default function TabLayout() {
  const [unreadCount, setUnreadCount] = useState(0);
  const insets = useSafeAreaInsets();

  // Total bar height = icon row + device home indicator area
  const totalBarHeight = BAR_HEIGHT + insets.bottom;

  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const res = await notificationsApi.unreadCount();
        setUnreadCount(res.data?.count ?? 0);
      } catch {}
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#000',
        tabBarInactiveTintColor: 'rgba(255,255,255,0.38)',
        tabBarShowLabel: false,
        tabBarPressOpacity: 0.65,        // native dim on press (iOS)
        tabBarPressColor: 'rgba(205,255,0,0.08)', // subtle ripple (Android)
        sceneContainerStyle: { backgroundColor: '#050505' },
        tabBarStyle: {
          height: totalBarHeight,
          backgroundColor: Platform.OS === 'ios'
            ? 'transparent'
            : 'rgba(8,8,8,0.98)',
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: 'rgba(205,255,0,0.22)',
          elevation: 24,
          paddingBottom: insets.bottom,
          paddingTop: 0,
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          overflow: 'hidden',
          shadowColor: LIME,
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.14,
          shadowRadius: 20,
        },
        tabBarItemStyle: {
          flex: 1,
          height: BAR_HEIGHT,
          paddingVertical: 0,
          paddingHorizontal: 0,
          justifyContent: 'center',
          alignItems: 'center',
        },
        tabBarBackground: () =>
          Platform.OS === 'ios' ? (
            <BlurView intensity={95} tint="dark" style={StyleSheet.absoluteFill} />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="home" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="shopping-bag" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle: { backgroundColor: '#FF3B30', color: '#FFF', fontSize: 10 },
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="message-circle" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="bond"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="users" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="user" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen name="feed" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  // Soft lime glow ring behind active pill
  iconGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 26,
    backgroundColor: LIME,
    transform: [{ scale: 1.35 }],
    opacity: 0,
    ...Platform.select({
      default: {
        shadowColor: LIME,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0,
        shadowRadius: 0,
      },
    }),
  },
  iconContainer: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
  },
  iconContainerActive: {
    backgroundColor: LIME,
    ...Platform.select({
      web: { boxShadow: `0 0 18px ${LIME}BB` },
      default: {
        shadowColor: LIME,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.7,
        shadowRadius: 16,
        elevation: 10,
      },
    }),
  },
});


