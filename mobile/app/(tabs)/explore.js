import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

const sections = [
  { icon: 'trending-up', title: 'Trending feed', body: 'Use this tab for a native feed, discovery, and category browsing.' },
  { icon: 'map-pin', title: 'Local sellers', body: 'Surface nearby sellers, service providers, and active listings here.' },
  { icon: 'shield', title: 'Verified shops', body: 'Promote verified profiles and trust signals without fighting route/template errors.' },
];

export default function ExploreScreen() {
  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Feather name="compass" size={26} color="#CDFF00" />
          <Text style={styles.title}>Explore</Text>
        </View>

        {sections.map((section) => (
          <View key={section.title} style={styles.card}>
            <View style={styles.iconBadge}>
              <Feather name={section.icon} size={18} color="#CDFF00" />
            </View>
            <Text style={styles.cardTitle}>{section.title}</Text>
            <Text style={styles.cardBody}>{section.body}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#050505',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 84,
    paddingBottom: 32,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '900',
  },
  card: {
    backgroundColor: '#101010',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 22,
    gap: 12,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(205,255,0,0.08)',
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  cardBody: {
    color: '#A3A3A3',
    fontSize: 14,
    lineHeight: 22,
  },
});
