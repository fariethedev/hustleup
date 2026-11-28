import React from "react";
import { Tabs } from "expo-router";
import FloatingNav from "../../src/components/native/FloatingNav";

export default function TabLayout() {
  return <Tabs tabBar={() => <FloatingNav />} screenOptions={{ headerShown: false }}>
    <Tabs.Screen name="index" /><Tabs.Screen name="explore" /><Tabs.Screen name="feed" /><Tabs.Screen name="messages" /><Tabs.Screen name="more" />
    <Tabs.Screen name="bond" options={{ href: null }} /><Tabs.Screen name="me" options={{ href: null }} />
  </Tabs>;
}
