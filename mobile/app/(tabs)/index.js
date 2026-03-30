import React from 'react';
import {
  ImageBackground,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import StoryBar from '../../src/components/stories/StoryBar';

export default function HomeScreen() {
  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <ImageBackground
          source={{ uri: 'https://images.unsplash.com/photo-1556761175-b413da4baf72?w=1200&q=80' }}
          style={styles.hero}
          imageStyle={styles.heroImage}
        >
          <View style={styles.heroOverlay} />
          <View style={styles.heroBadge}>
            <Feather name="zap" size={14} color="#CDFF00" />
            <Text style={styles.heroBadgeText}>A marketplace for go-getters</Text>
          </View>

          <Text style={styles.heroTitle}>HUSTLE UP</Text>
          <Text style={styles.heroSubtitle}>
            Discover shops, products, and people from the same ecosystem as the web app.
          </Text>

          <TouchableOpacity style={styles.primaryButton} activeOpacity={0.85}>
            <Feather name="shopping-bag" size={18} color="#050505" />
            <Text style={styles.primaryButtonText}>Browse shops</Text>
          </TouchableOpacity>
        </ImageBackground>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Stories</Text>
          <Text style={styles.sectionSubtitle}>Quick updates from the community</Text>
          <StoryBar />
        </View>

        <View style={styles.section}>
          <View style={styles.communityCard}>
            <Feather name="users" size={28} color="#CDFF00" />
            <Text style={styles.communityTitle}>Community preview</Text>
            <Text style={styles.communityBody}>
              Mobile is now using a stable route tree and native components. Feed and shopping flows
              can be layered onto this without the bundler issues.
            </Text>
          </View>
        </View>
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
    paddingBottom: 32,
  },
  hero: {
    minHeight: 520,
    paddingHorizontal: 24,
    paddingTop: 84,
    paddingBottom: 48,
    justifyContent: 'flex-end',
  },
  heroImage: {
    opacity: 0.45,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  heroBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(0,0,0,0.55)',
    marginBottom: 20,
  },
  heroBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 46,
    lineHeight: 46,
    fontWeight: '900',
    letterSpacing: -1.5,
  },
  heroSubtitle: {
    color: '#B0B0B0',
    fontSize: 16,
    lineHeight: 24,
    marginTop: 18,
    maxWidth: 300,
    fontWeight: '600',
  },
  primaryButton: {
    marginTop: 28,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 22,
    paddingVertical: 16,
    borderRadius: 18,
    backgroundColor: '#CDFF00',
  },
  primaryButtonText: {
    color: '#050505',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 4,
  },
  sectionSubtitle: {
    color: '#707070',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
  },
  communityCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: '#101010',
    padding: 24,
    gap: 12,
  },
  communityTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  communityBody: {
    color: '#A3A3A3',
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '500',
  },
});
